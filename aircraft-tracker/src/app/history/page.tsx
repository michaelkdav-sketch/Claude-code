'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { formatDistanceToNowStrict, format } from 'date-fns'
import MilitaryBadge from '@/components/MilitaryBadge'
import { compassPoint } from '@/lib/geo'
import type { OverheadEvent } from '@/lib/providers/types'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function HistoryPage() {
  const { data, isLoading } = useSWR<{ events: OverheadEvent[] }>(
    '/api/history?limit=200',
    fetcher,
    { refreshInterval: 30_000 },
  )

  const events = data?.events ?? []
  const milEvents = events.filter(
    (e) => e.militaryLabel === 'likely_military' || e.militaryLabel === 'maybe_military',
  )

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-4 border-b border-border bg-card/80 px-6 py-3 backdrop-blur">
        <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors">
          ← Dashboard
        </Link>
        <span className="h-3 w-px bg-zinc-700" />
        <h1 className="text-sm font-semibold text-zinc-100">Recent Sightings</h1>
        <span className="ml-2 rounded-full bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-400">
          {events.length}
        </span>
        {milEvents.length > 0 && (
          <span className="rounded-full bg-orange-500/20 px-2 py-0.5 font-mono text-xs text-orange-300">
            {milEvents.length} military
          </span>
        )}
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <LoadingGrid />
        ) : events.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {milEvents.length > 0 && (
              <div className="mb-8">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-orange-400/80">
                  Interesting Sightings
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {milEvents.map((e) => (
                    <EventCard key={e.id} event={e} highlight />
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-600">
                All Recent ({events.length})
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {events.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function EventCard({ event: e, highlight }: { event: OverheadEvent; highlight?: boolean }) {
  const duration =
    e.snapshotCount > 1
      ? `${Math.round((e.lastSeen - e.firstSeen) / 60_000)} min`
      : null

  const isMil =
    e.militaryLabel === 'likely_military' || e.militaryLabel === 'maybe_military'

  return (
    <Link
      href={`/aircraft/${e.hex}`}
      className={`group block rounded-xl border p-4 transition-all duration-150 hover:bg-card-hover animate-fade-in ${
        highlight
          ? 'border-orange-500/30 bg-card'
          : 'border-border bg-card hover:border-border-bright'
      }`}
    >
      {/* Time */}
      <p className="text-xs text-zinc-600">
        {formatDistanceToNowStrict(e.lastSeen, { addSuffix: true })}
      </p>
      <p className="text-xs text-zinc-700">
        {format(e.firstSeen, 'MMM d, HH:mm')}
      </p>

      {/* Callsign / hex */}
      <div className="mt-2">
        <p className="font-mono text-sm font-semibold text-zinc-100 truncate">
          {e.callsign ?? e.hex.toUpperCase()}
        </p>
        {e.callsign && (
          <p className="font-mono text-xs text-zinc-600">{e.hex.toUpperCase()}</p>
        )}
      </div>

      {/* Type */}
      {(e.typeCode || e.typeDescription) && (
        <div className="mt-1 flex items-center gap-1.5">
          {e.typeCode && (
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-300">
              {e.typeCode}
            </span>
          )}
          {e.typeDescription && (
            <span className="truncate text-xs text-zinc-500">{e.typeDescription}</span>
          )}
        </div>
      )}

      {/* Metrics */}
      <div className="mt-3 space-y-1">
        {e.closestDistanceNm != null && (
          <p className="text-xs text-zinc-500">
            Closest:{' '}
            <span className="text-sky-400">{e.closestDistanceNm.toFixed(1)} nm</span>
          </p>
        )}
        {e.maxAltitudeFt != null && (
          <p className="text-xs text-zinc-500">
            Max alt:{' '}
            <span className="text-zinc-300">{e.maxAltitudeFt.toLocaleString()} ft</span>
          </p>
        )}
        {duration && (
          <p className="text-xs text-zinc-500">
            Overhead: <span className="text-zinc-300">{duration}</span>
          </p>
        )}
      </div>

      {/* Badge */}
      <div className="mt-3">
        <MilitaryBadge label={e.militaryLabel} />
      </div>
    </Link>
  )
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="h-44 animate-pulse rounded-xl bg-card" />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-4xl opacity-20">📋</p>
      <p className="mt-4 text-sm text-zinc-500">No sightings recorded yet.</p>
      <p className="mt-1 text-xs text-zinc-700">
        Keep the dashboard open to start building history.
      </p>
      <Link href="/" className="mt-4 text-sm text-sky-400 hover:text-sky-300">
        Go to dashboard →
      </Link>
    </div>
  )
}
