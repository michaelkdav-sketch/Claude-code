'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import useSWR from 'swr'
import StatsBanner from '@/components/StatsBanner'
import AircraftList from '@/components/AircraftList'
import StatusBar from '@/components/StatusBar'
import DetailPanel from '@/components/DetailPanel'
import type { Aircraft, AppStatus } from '@/lib/providers/types'

const AircraftMap = dynamic(() => import('@/components/Map'), { ssr: false })

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface AircraftResponse {
  aircraft: Aircraft[]
  config: { lat: number; lon: number; radiusNm: number }
  fetchedAt: number
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

  const aircraft = data?.aircraft ?? []
  const config = data?.config
  const status: AppStatus | null = statusData?.status ?? null

  const [mapReady, setMapReady] = useState(false)
  const [selectedHex, setSelectedHex] = useState<string | null>(null)
  const [newHexes, setNewHexes] = useState<Set<string>>(new Set())
  const prevHexes = useRef<Set<string>>(new Set())

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
          <span className="h-3 w-px bg-zinc-700" />
          {config && (
            <span className="font-mono text-zinc-600">{config.radiusNm.toFixed(0)} nm</span>
          )}
        </nav>
      </header>

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
            />
          ) : (
            <MapPlaceholder />
          )}
          <div className="pointer-events-none absolute bottom-4 left-4 text-xs text-zinc-700">
            Scroll to zoom · Click aircraft to inspect
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
                onSelect={handleSelect}
              />
            )}
          </div>

          {/* Detail panel slides in from the right */}
          <div
            className={`absolute inset-0 transition-transform duration-300 ease-out ${
              selectedAircraft ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <DetailPanel aircraft={selectedAircraft} onClose={() => setSelectedHex(null)} />
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
