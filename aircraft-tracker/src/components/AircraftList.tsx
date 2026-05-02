'use client'

import { useState } from 'react'
import AircraftCard from './AircraftCard'
import type { Aircraft, MilitaryLabel } from '@/lib/providers/types'

type SortKey = 'distance' | 'altitude' | 'military' | 'callsign'
type FilterKey = 'all' | MilitaryLabel

interface Props {
  aircraft: Aircraft[]
  newHexes?: Set<string>
  selectedHex?: string | null
  favHexes?: Set<string>
  onSelect?: (hex: string) => void
  onFavoriteToggle?: (hex: string) => void
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'likely_military', label: 'Military' },
  { key: 'maybe_military', label: 'Maybe Mil' },
  { key: 'likely_civilian', label: 'Civilian' },
]

export default function AircraftList({
  aircraft,
  newHexes,
  selectedHex,
  favHexes,
  onSelect,
  onFavoriteToggle,
}: Props) {
  const [sort, setSort] = useState<SortKey>('distance')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const [compact, setCompact] = useState(false)

  const filtered = aircraft
    .filter((a) => filter === 'all' || a.military.label === filter)
    .filter((a) => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        a.hex.includes(q) ||
        a.callsign?.toLowerCase().includes(q) ||
        a.typeCode?.toLowerCase().includes(q) ||
        a.typeDescription?.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      // Favorites always sort to top
      const aFav = favHexes?.has(a.hex) ? 0 : 1
      const bFav = favHexes?.has(b.hex) ? 0 : 1
      if (aFav !== bFav) return aFav - bFav

      switch (sort) {
        case 'distance':
          return (a.distanceNm ?? 999) - (b.distanceNm ?? 999)
        case 'altitude':
          return (b.altitudeFt ?? 0) - (a.altitudeFt ?? 0)
        case 'military':
          return b.military.score - a.military.score
        case 'callsign':
          return (a.callsign ?? a.hex).localeCompare(b.callsign ?? b.hex)
      }
    })

  return (
    <div className="flex h-full flex-col gap-3">
      <input
        type="search"
        placeholder="Search callsign, type…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30"
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'bg-sky-500/20 text-sky-300'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-md border border-border bg-card px-2 py-1 text-xs text-zinc-400 outline-none"
          >
            <option value="distance">Distance</option>
            <option value="altitude">Altitude</option>
            <option value="military">Military score</option>
            <option value="callsign">Callsign</option>
          </select>

          {/* Compact / card toggle */}
          <button
            onClick={() => setCompact((c) => !c)}
            className={`rounded-md px-2 py-1 text-xs transition-colors ${
              compact ? 'bg-sky-500/20 text-sky-300' : 'text-zinc-600 hover:text-zinc-300'
            }`}
            title={compact ? 'Card view' : 'Compact view'}
            aria-label={compact ? 'Switch to card view' : 'Switch to compact view'}
          >
            {compact ? '▤' : '☰'}
          </button>
        </div>
      </div>

      <p className="text-xs text-zinc-600">
        {filtered.length} of {aircraft.length} aircraft
      </p>

      <div className={`flex-1 overflow-y-auto pb-4 ${compact ? 'space-y-px' : 'space-y-2'}`}>
        {filtered.length === 0 ? (
          <EmptyState hasAircraft={aircraft.length > 0} />
        ) : (
          filtered.map((ac) => (
            <AircraftCard
              key={ac.hex}
              aircraft={ac}
              selected={ac.hex === selectedHex}
              isNew={newHexes?.has(ac.hex)}
              isFavorite={favHexes?.has(ac.hex)}
              compact={compact}
              onClick={() => onSelect?.(ac.hex)}
              onFavoriteToggle={
                onFavoriteToggle
                  ? (e) => {
                      e.stopPropagation()
                      onFavoriteToggle(ac.hex)
                    }
                  : undefined
              }
            />
          ))
        )}
      </div>
    </div>
  )
}

function EmptyState({ hasAircraft }: { hasAircraft: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 text-4xl opacity-20">✈</div>
      <p className="text-sm text-zinc-500">
        {hasAircraft ? 'No aircraft match the current filter.' : 'No aircraft detected nearby.'}
      </p>
      <p className="mt-1 text-xs text-zinc-700">
        {hasAircraft ? 'Try adjusting the filter.' : 'Check back in a moment.'}
      </p>
    </div>
  )
}
