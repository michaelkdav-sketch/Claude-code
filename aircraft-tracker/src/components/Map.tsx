'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Circle, Tooltip, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { compassPoint } from '@/lib/geo'
import type { Aircraft } from '@/lib/providers/types'

function altitudeColor(ac: Aircraft): string {
  if (ac.onGround) return '#71717a'
  const ft = ac.altitudeFt ?? 0
  if (ft < 3_000) return '#ef4444'
  if (ft < 10_000) return '#f97316'
  if (ft < 25_000) return '#eab308'
  if (ft < 40_000) return '#3b82f6'
  return '#818cf8'
}

function isMilitary(ac: Aircraft): boolean {
  return ac.military.label === 'likely_military' || ac.military.label === 'maybe_military'
}

function makeAircraftIcon(ac: Aircraft, selected: boolean): L.DivIcon {
  const color = altitudeColor(ac)
  const rotation = ac.trackDeg ?? 0
  const size = selected ? 30 : 22
  const glow = selected ? `drop-shadow(0 0 6px ${color})` : 'none'
  const mil = isMilitary(ac)

  // Military → diamond shape; civilian → arrow
  const svgPath = mil
    ? `M12 2L22 12L12 22L2 12Z`
    : `M12 2.5L15.5 9.5H21L16.5 14.5L17.5 22L12 18.5L6.5 22L7.5 14.5L3 9.5H8.5Z`

  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;transform:rotate(${rotation}deg);transition:transform 0.4s;filter:${glow}">
      <svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}" xmlns="http://www.w3.org/2000/svg">
        <path stroke="rgba(0,0,0,0.4)" stroke-width="0.8" d="${svgPath}"/>
      </svg>
    </div>`,
  })
}

function makeHomeIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    // Inline <style> ensures the keyframe animation works inside Leaflet's isolated DOM
    html: `<style>@keyframes hping{75%,100%{transform:translate(-50%,-50%) scale(2.5);opacity:0;}}</style>
    <div style="position:relative;width:28px;height:28px">
      <div style="position:absolute;top:50%;left:50%;width:28px;height:28px;background:rgba(96,165,250,0.18);border-radius:50%;animation:hping 2s ease-in-out infinite"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:10px;height:10px;background:#60a5fa;border:2px solid rgba(255,255,255,0.85);border-radius:50%;box-shadow:0 0 10px rgba(96,165,250,0.55)"></div>
    </div>`,
  })
}

function FlyToHome({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap()
  const didFly = useRef(false)
  useEffect(() => {
    if (!didFly.current) {
      map.setView([lat, lon], 11)
      didFly.current = true
    }
  }, [map, lat, lon])
  return null
}

interface Props {
  aircraft: Aircraft[]
  homeLat: number
  homeLon: number
  radiusNm: number
  selectedHex?: string | null
  trackPoints?: { lat: number; lon: number }[]
  onAircraftClick?: (hex: string) => void
}

export default function AircraftMap({
  aircraft,
  homeLat,
  homeLon,
  radiusNm,
  selectedHex,
  trackPoints,
  onAircraftClick,
}: Props) {
  const radiusMeters = radiusNm * 1852

  return (
    <MapContainer
      center={[homeLat, homeLon]}
      zoom={11}
      style={{ height: '100%', width: '100%', background: '#0d0d14' }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={20}
      />

      <FlyToHome lat={homeLat} lon={homeLon} />

      {/* Radius ring */}
      <Circle
        center={[homeLat, homeLon]}
        radius={radiusMeters}
        pathOptions={{
          color: '#60a5fa',
          fillColor: '#60a5fa',
          fillOpacity: 0.03,
          weight: 1,
          dashArray: '4 8',
        }}
      />

      {/* Home marker */}
      <Marker position={[homeLat, homeLon]} icon={makeHomeIcon()} zIndexOffset={1000}>
        <Tooltip permanent={false} direction="top">Home</Tooltip>
      </Marker>

      {/* Track path for detail view */}
      {trackPoints && trackPoints.length > 1 && (
        <Polyline
          positions={trackPoints.map((p) => [p.lat, p.lon])}
          pathOptions={{ color: '#60a5fa', weight: 2, opacity: 0.6, dashArray: '4 4' }}
        />
      )}

      {/* Aircraft markers */}
      {aircraft
        .filter((ac) => ac.lat != null && ac.lon != null)
        .map((ac) => (
          <Marker
            key={ac.hex}
            position={[ac.lat!, ac.lon!]}
            icon={makeAircraftIcon(ac, ac.hex === selectedHex)}
            zIndexOffset={ac.hex === selectedHex ? 500 : 0}
            eventHandlers={{ click: () => onAircraftClick?.(ac.hex) }}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                <p style={{ fontWeight: 600 }}>
                  {ac.callsign ?? ac.hex.toUpperCase()}
                  {ac.inFormation && <span style={{ marginLeft: 4, color: '#a78bfa' }}>⟡ formation</span>}
                </p>
                {ac.typeCode && <p style={{ color: '#aaa' }}>{ac.typeCode}{ac.typeDescription ? ` · ${ac.typeDescription}` : ''}</p>}
                {ac.altitudeFt != null && (
                  <p>{ac.altitudeFt.toLocaleString()} ft · {ac.groundSpeedKt} kt</p>
                )}
                {ac.distanceNm != null && ac.bearingDeg != null && (
                  <p>{ac.distanceNm.toFixed(1)} nm {compassPoint(ac.bearingDeg)}</p>
                )}
                <p style={{ color: '#888', marginTop: 2 }}>Click to inspect</p>
              </div>
            </Tooltip>
          </Marker>
        ))}
    </MapContainer>
  )
}
