'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import useSWR from 'swr'
import StatsBanner from '@/components/StatsBanner'
import AircraftList from '@/components/AircraftList'
import StatusBar from '@/components/StatusBar'
import DetailPanel from '@/components/DetailPanel'
import DigestBanner from '@/components/DigestBanner'
import { useFavorites } from '@/lib/useFavorites'
import type { Aircraft, AppStatus } from '@/lib/providers/types'

const AircraftMap = dynamic(() => import('@/components/Map'), { ssr: false })

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface AircraftResponse {
  aircraft: Aircraft[]
  config: { lat: number; lon: number; radiusNm: number }
  fetchedAt: number
}

interface DigestResponse {
  digest: {
    todayCount: number
    militaryCount: number
    newFirstSightings: number
    topCallsign: string | null
  }
}

export default function Dashboard() {
  const { data, error, isValidating } = useSWR<AircraftResponse>('/api/aircraft', fetcher, {
    refreshInterval: 10_000,
    revalidateOnFocus: false,
  })

  const { data: statusData } = useSWR('/api/status', fetcher, {
    refreshInterval: 10_000,
    revalidateOnFocus: false,
  })

  const { data: digestData } = useSWR<DigestResponse>('/api/stats', fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  })

  const aircraft = data?.aircraft ?? []
  const config = data?.config
  const status: AppStatus | null = statusData?.status ?? null

  const [mapReady, setMapReady] = useState(false)
  const [selectedHex, setSelectedHex] = useState<string | null>(null)
  const [newHexes, setNewHexes] = useState<Set<string>>(new Set())
  const prevHexes = useRef<Set<string>>(new Set())

  const { favs, toggle: toggleFavorite, isFavorite } = useFavorites()

  useEffect(() => { setMapReady(true) }, [])

  // Track which aircraft are new since the last refresh
  useEffect(() => {
    if (!data?.aircraft) return
    const current = new Set(data.aircraft.map((a) => a.hex))
    const fresh = new Set(Array.from(current).filter((h) => !prevHexes.current.has(h)))
    prevHexes.current = current
    if (fresh.size === 0) return
    setNewHexes(fresh)
    const t = setTimeout(() => setNewHexes(new Set()), 3000)
    return () => clearTimeout(t)
  }, [data])

  // Sorted aircraft list — shared with keyboard navigation
  const sortedAircraft = useMemo(
    () => [...aircraft].sort((a, b) => (a.distanceNm ?? 999) - (b.distanceNm ?? 999)),
    [aircraft],
  )

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === 'Escape') {
        setSelectedHex(null)
        return
      }

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        setSelectedHex((prev) => {
          if (sortedAircraft.length === 0) return prev
          const idx = sortedAircraft.findIndex((a) => a.hex === prev)
          return sortedAircraft[(idx + 1) % sortedAircraft.length].hex
        })
        return
      }

      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        setSelectedHex((prev) => {
          if (sortedAircraft.length === 0) return prev
          const idx = sortedAircraft.findIndex((a) => a.hex === prev)
          const next = idx <= 0 ? sortedAircraft.length - 1 : idx - 1
          return sortedAircraft[next].hex
        })
        return
      }

      if (e.key === 'f' && selectedHex) {
        toggleFavorite(selectedHex)
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sortedAircraft, selectedHex, toggleFavorite])

  // Fetch per-aircraft track when something is selected
  const { data: detailData } = useSWR(
    selectedHex ? `/api/aircraft/${selectedHex}` : null,
    fetcher,
    { refreshInterval: 15_000, revalidateOnFocus: false },
  )

  const trackPoints: { lat: number; lon: number }[] = (detailData?.track ?? [])
    .filter((p: { lat: number | null; lon: number | null }) => p.lat != null && p.lon != null)
    .map((p: { lat: number; lon: number }) => ({ lat: p.lat, lon: p.lon }))

  const selectedAircraft = aircraft.find((a) => a.hex === selectedHex) ?? null

  const handleSelect = (hex: string) =>
    setSelectedHex((prev) => (prev === hex ? null : hex))

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-card/80 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-lg">✈</span>
          <h1 className="text-sm font-semibold tracking-tight text-zinc-100">AirWatch SD</h1>
          <span className="hidden text-xs text-zinc-600 sm:inline">San Diego</span>
        </div>

        <StatusBar status={status} isLoading={isValidating} />

        <nav className="flex items-center gap-4 text-xs text-zinc-500">
          <Link href="/history" className="hover:text-zinc-200 transition-colors">
            History
          </Link>
          <Link href="/stats" className="hover:text-zinc-200 transition-colors">
            Stats
          </Link>
          <span className="h-3 w-px bg-zinc-700" />
          {config && (
            <span className="font-mono text-zinc-600">{config.radiusNm.toFixed(0)} nm</span>
          )}
        </nav>
      </header>

      {/* Digest banner — only shown when there's something interesting */}
      {digestData?.digest && <DigestBanner digest={digestData.digest} />}

      {/* Stats */}
      <div className="flex shrink-0 items-center gap-8 border-b border-border bg-card/40 px-6 py-3">
        <StatsBanner aircraft={aircraft} />
        {error && (
          <p className="ml-auto text-xs text-red-400">API error — showing cached data</p>
        )}
      </div>

      {/* Main content */}
      <div className="flex min-h-0 flex-1">
        {/* Map */}
        <div className="relative flex-1">
          {mapReady && config ? (
            <AircraftMap
              aircraft={aircraft}
              homeLat={config.lat}
              homeLon={config.lon}
              radiusNm={config.radiusNm}
              selectedHex={selectedHex}
              onAircraftClick={handleSelect}
              trackPoints={trackPoints}
            />
          ) : (
            <MapPlaceholder />
          )}
          <div className="pointer-events-none absolute bottom-4 left-4 text-xs text-zinc-700">
            Scroll to zoom · Click to inspect · j/k cycle · Esc close · f favorite
          </div>
        </div>

        {/* Right panel — list + slide-in detail */}
        <div className="relative flex w-[440px] shrink-0 flex-col overflow-hidden border-l border-border">
          {/* List (fades out when detail is open) */}
          <div
            className={`flex-1 min-h-0 overflow-hidden p-4 transition-opacity duration-200 ${
              selectedAircraft ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            {isValidating && aircraft.length === 0 ? (
              <LoadingState />
            ) : (
              <AircraftList
                aircraft={aircraft}
                newHexes={newHexes}
                selectedHex={selectedHex}
                favHexes={favs}
                onSelect={handleSelect}
                onFavoriteToggle={toggleFavorite}
              />
            )}
          </div>

          {/* Detail panel slides in from the right */}
          <div
            className={`absolute inset-0 transition-transform duration-300 ease-out ${
              selectedAircraft ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <DetailPanel
              aircraft={selectedAircraft}
              onClose={() => setSelectedHex(null)}
              trackPointCount={trackPoints.length}
              isFavorite={selectedHex ? isFavorite(selectedHex) : false}
              onFavoriteToggle={selectedHex ? () => toggleFavorite(selectedHex) : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function MapPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-3 text-zinc-700">
        <span className="text-3xl animate-pulse">🗺</span>
        <p className="text-sm">Loading map…</p>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-3 pt-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-xl bg-card" />
      ))}
    </div>
  )
}
