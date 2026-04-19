'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Circle, Tooltip, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { compassPoint } from '@/lib/geo'
import type { Aircraft } from '@/lib/providers/types'

const MIL_COLORS: Record<string, string> = {
  likely_military: '#fb923c',
  maybe_military: '#fbbf24',
  likely_civilian: '#34d399',
  unknown: '#71717a',
}

function makeAircraftIcon(ac: Aircraft, selected: boolean): L.DivIcon {
  const color = MIL_COLORS[ac.military.label] ?? '#71717a'
  const rotation = ac.trackDeg ?? 0
  const size = selected ? 30 : 22
  const border = selected ? `2px solid ${color}` : '1px solid rgba(0,0,0,0.6)'
  const glow = selected ? `0 0 8px ${color}80` : 'none'

  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;transform:rotate(${rotation}deg);transition:transform 0.3s;filter:drop-shadow(${glow})">
      <svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}" xmlns="http://www.w3.org/2000/svg">
        <path style="stroke:rgba(0,0,0,0.5);stroke-width:0.5" d="M12 2L15.5 9.5H21L16 14.5L17.5 22L12 18.5L6.5 22L8 14.5L3 9.5H8.5Z"/>
      </svg>
    </div>`,
  })
}

function makeHomeIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<div style="position:relative;width:24px;height:24px">
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:24px;height:24px;background:rgba(96,165,250,0.2);border-radius:50%;animation:ping 2s ease-in-out infinite"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:10px;height:10px;background:#60a5fa;border:2px solid rgba(255,255,255,0.8);border-radius:50%;box-shadow:0 0 8px #60a5fa80"></div>
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
}

export default function AircraftMap({
  aircraft,
  homeLat,
  homeLon,
  radiusNm,
  selectedHex,
  trackPoints,
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
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={20}
      />

      <FlyToHome lat={homeLat} lon={homeLon} />

      {/* Home radius ring */}
      <Circle
        center={[homeLat, homeLon]}
        radius={radiusMeters}
        pathOptions={{ color: '#60a5fa', fillColor: '#60a5fa', fillOpacity: 0.03, weight: 1, dashArray: '4 8' }}
      />

      {/* Home marker */}
      <Marker position={[homeLat, homeLon]} icon={makeHomeIcon()} zIndexOffset={1000}>
        <Tooltip permanent={false} direction="top">Home</Tooltip>
      </Marker>

      {/* Track polyline for detail view */}
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
          >
            <Tooltip direction="top" offset={[0, -10]}>
              <div className="text-xs">
                <p className="font-semibold">{ac.callsign ?? ac.hex.toUpperCase()}</p>
                {ac.typeCode && <p className="text-zinc-400">{ac.typeCode}</p>}
                {ac.altitudeFt != null && (
                  <p>{ac.altitudeFt.toLocaleString()} ft · {ac.groundSpeedKt} kt</p>
                )}
                {ac.distanceNm != null && ac.bearingDeg != null && (
                  <p>{ac.distanceNm.toFixed(1)} nm {compassPoint(ac.bearingDeg)}</p>
                )}
              </div>
            </Tooltip>
          </Marker>
        ))}
    </MapContainer>
  )
}
