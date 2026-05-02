'use client'

import Link from 'next/link'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface StatsSummary {
  totalEvents: number
  militaryEvents: number
  uniqueTypes: number
  busiestHour: number | null
}

interface TypeEntry {
  typeCode: string
  count: number
}

interface HourEntry {
  hour: number
  count: number
}

interface StatsResponse {
  summary: StatsSummary
  topTypes: TypeEntry[]
  hourlyActivity: HourEntry[]
}

function formatHour(h: number) {
  if (h === 0) return '12am'
  if (h < 12) return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

export default function StatsPage() {
  const { data, isLoading } = useSWR<StatsResponse>('/api/stats', fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  })

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-card/80 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-lg">✈</span>
          <h1 className="text-sm font-semibold tracking-tight text-zinc-100">AirWatch SD</h1>
          <span className="text-xs text-zinc-600">/</span>
          <span className="text-sm text-zinc-400">Statistics</span>
        </div>
        <nav className="flex items-center gap-4 text-xs text-zinc-500">
          <Link href="/" className="hover:text-zinc-200 transition-colors">Dashboard</Link>
          <Link href="/history" className="hover:text-zinc-200 transition-colors">History</Link>
        </nav>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && (
          <div className="flex items-center justify-center pt-24 text-zinc-600 text-sm">
            Loading statistics…
          </div>
        )}

        {data && (
          <div className="mx-auto max-w-3xl space-y-8">

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Aircraft (7d)" value={data.summary.totalEvents.toLocaleString()} />
              <StatCard
                label="Military (7d)"
                value={data.summary.militaryEvents.toLocaleString()}
                accent="text-orange-400"
              />
              <StatCard label="Unique types" value={data.summary.uniqueTypes.toLocaleString()} />
              <StatCard
                label="Busiest hour"
                value={data.summary.busiestHour != null ? formatHour(data.summary.busiestHour) : '—'}
              />
            </div>

            {/* Hourly activity chart */}
            <section>
              <h2 className="mb-4 text-xs uppercase tracking-widest text-zinc-600">
                Activity — last 24 h
              </h2>
              <HourlyChart data={data.hourlyActivity} />
            </section>

            {/* Type breakdown */}
            {data.topTypes.length > 0 && (
              <section>
                <h2 className="mb-4 text-xs uppercase tracking-widest text-zinc-600">
                  Top aircraft types — last 7 d
                </h2>
                <TypeBreakdown types={data.topTypes} />
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  accent = 'text-zinc-100',
}: {
  label: string
  value: string
  accent?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-600">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  )
}

function HourlyChart({ data }: { data: HourEntry[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)
  const now = new Date().getHours()

  return (
    <div className="flex h-28 items-end gap-px rounded-xl border border-border bg-card p-3">
      {data.map(({ hour, count }) => {
        const heightPct = (count / maxCount) * 100
        const isNow = hour === now
        return (
          <div
            key={hour}
            className="group relative flex flex-1 flex-col items-center justify-end"
            title={`${formatHour(hour)}: ${count}`}
          >
            <div
              className={`w-full rounded-t transition-all ${
                isNow ? 'bg-sky-400' : 'bg-zinc-700 group-hover:bg-zinc-500'
              }`}
              style={{ height: `${Math.max(heightPct, count > 0 ? 4 : 0)}%` }}
            />
          </div>
        )
      })}
    </div>
  )
}

function TypeBreakdown({ types }: { types: TypeEntry[] }) {
  const max = Math.max(...types.map((t) => t.count), 1)

  return (
    <div className="space-y-2">
      {types.map(({ typeCode, count }) => (
        <div key={typeCode} className="flex items-center gap-3">
          <span className="w-12 shrink-0 font-mono text-xs text-zinc-400">{typeCode}</span>
          <div className="flex-1 overflow-hidden rounded-full bg-zinc-800 h-2">
            <div
              className="h-full rounded-full bg-sky-500 transition-all"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right font-mono text-xs text-zinc-500">{count}</span>
        </div>
      ))}
    </div>
  )
}
