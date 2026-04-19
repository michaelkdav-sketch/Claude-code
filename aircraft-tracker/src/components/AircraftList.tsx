'use client'

import { useState } from 'react'
import AircraftCard from './AircraftCard'
import type { Aircraft, MilitaryLabel } from '@/lib/providers/types'

type SortKey = 'distance' | 'altitude' | 'military' | 'callsign'
type FilterKey = 'all' | MilitaryLabel

interface Props {
  aircraft: Aircraft[]
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'likely_military', label: 'Military' },
  { key: 'maybe_military', label: 'Maybe Mil' },
  { key: 'likely_civilian', label: 'Civilian' },
]

export default function AircraftList({ aircraft }: Props) {
  const [sort, setSort] = useState<SortKey>('distance')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')

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
      {/* Search */}
      <input
        type="search"
        placeholder="Search callsign, type…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30"
      />

      {/* Filters + sort */}
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
      </div>

      {/* Count */}
      <p className="text-xs text-zinc-600">
        {filtered.length} of {aircraft.length} aircraft
      </p>

      {/* List */}
      <div className="flex-1 space-y-2 overflow-y-auto pb-4">
        {filtered.length === 0 ? (
          <EmptyState hasAircraft={aircraft.length > 0} />
        ) : (
          filtered.map((ac) => <AircraftCard key={ac.hex} aircraft={ac} />)
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
