'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import useSWR from 'swr'
import { formatDistanceToNowStrict } from 'date-fns'
import MilitaryBadge from '@/components/MilitaryBadge'
import { compassPoint } from '@/lib/geo'
import type { Aircraft } from '@/lib/providers/types'

const AircraftMap = dynamic(() => import('@/components/Map'), { ssr: false })

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface DetailResponse {
  aircraft: Aircraft | null
  track: { lat: number; lon: number; altitudeFt: number | null; fetchedAt: number }[]
  rawPayload: Record<string, unknown> | null
}

export default function AircraftDetail({ params }: { params: { hex: string } }) {
  const { hex } = params
  const [showRaw, setShowRaw] = useState(false)

  const { data, error, isLoading } = useSWR<DetailResponse>(
    `/api/aircraft/${hex}`,
    fetcher,
    { refreshInterval: 15_000 },
  )

  const { data: configData } = useSWR('/api/status', fetcher)
  const config = configData?.config

  const ac = data?.aircraft
  const track = (data?.track ?? []).map((p) => ({ lat: p.lat, lon: p.lon }))

  if (isLoading) return <Skeleton />
  if (error || !ac) return <NotFound hex={hex} />

  const milConf = Math.min(Math.round(ac.military.confidence * 100), 99)

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-4 border-b border-border bg-card/80 px-6 py-3 backdrop-blur">
        <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors">
          ← Back
        </Link>
        <span className="h-3 w-px bg-zinc-700" />
        <h1 className="font-mono text-sm font-semibold text-zinc-100">
          {ac.callsign ?? ac.hex.toUpperCase()}
        </h1>
        {ac.callsign && (
          <span className="font-mono text-xs text-zinc-600">{ac.hex.toUpperCase()}</span>
        )}
        <MilitaryBadge label={ac.military.label} score={milConf} size="md" />
        <span className="ml-auto text-xs text-zinc-600">
          Updated {formatDistanceToNowStrict(ac.fetchedAt, { addSuffix: true })}
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Mini map */}
        <div className="w-[55%] shrink-0">
          {config && (
            <AircraftMap
              aircraft={[ac]}
              homeLat={config.lat}
              homeLon={config.lon}
              radiusNm={config.radiusNm}
              selectedHex={ac.hex}
              trackPoints={track}
            />
          )}
        </div>

        {/* Detail panel */}
        <div className="flex-1 overflow-y-auto border-l border-border p-6 space-y-6">
          {/* Aircraft identity */}
          <Section title="Identity">
            <Grid>
              <Field label="Hex" value={<Mono>{ac.hex.toUpperCase()}</Mono>} />
              <Field label="Callsign" value={ac.callsign ? <Mono>{ac.callsign}</Mono> : '—'} />
              <Field label="Registration" value={ac.registration ? <Mono>{ac.registration}</Mono> : '—'} />
              <Field label="Type" value={ac.typeCode ? <Mono>{ac.typeCode}</Mono> : '—'} />
              <Field label="Description" value={ac.typeDescription ?? '—'} span />
              <Field label="Squawk" value={ac.squawk ? <Mono>{ac.squawk}</Mono> : '—'} />
              <Field label="Category" value={ac.category ?? '—'} />
            </Grid>
          </Section>

          {/* Flight data */}
          <Section title="Flight Data">
            <Grid>
              <Field
                label="Altitude"
                value={ac.onGround ? 'On ground' : ac.altitudeFt != null ? `${ac.altitudeFt.toLocaleString()} ft` : '—'}
              />
              <Field
                label="Ground Speed"
                value={ac.groundSpeedKt != null ? `${ac.groundSpeedKt} kt` : '—'}
              />
              <Field
                label="Track"
                value={ac.trackDeg != null ? `${Math.round(ac.trackDeg)}° ${compassPoint(ac.trackDeg)}` : '—'}
              />
              <Field
                label="Position"
                value={
                  ac.lat != null && ac.lon != null
                    ? <Mono>{ac.lat.toFixed(4)}, {ac.lon.toFixed(4)}</Mono>
                    : '—'
                }
                span
              />
              <Field
                label="Distance"
                value={ac.distanceNm != null ? `${ac.distanceNm.toFixed(1)} nm` : '—'}
              />
              <Field
                label="Bearing"
                value={
                  ac.bearingDeg != null
                    ? `${Math.round(ac.bearingDeg)}° ${compassPoint(ac.bearingDeg)}`
                    : '—'
                }
              />
            </Grid>
          </Section>

          {/* Military classification */}
          <Section title="Classification">
            <div className="flex items-center gap-3 mb-4">
              <MilitaryBadge label={ac.military.label} size="md" />
              <div className="flex-1 h-1.5 rounded-full bg-zinc-800">
                <div
                  className={`h-1.5 rounded-full transition-all ${milBarColor(ac.military.label)}`}
                  style={{ width: `${milConf}%` }}
                />
              </div>
              <span className="font-mono text-sm text-zinc-400">{milConf}%</span>
            </div>

            <p className="mb-3 text-xs text-zinc-600 italic">
              Heuristic scoring — not definitive. Based on publicly available ADS-B data.
            </p>

            <ul className="space-y-1.5">
              {ac.military.reasons.map((reason, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 text-zinc-600">·</span>
                  <span className="text-zinc-300">{reason}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Track summary */}
          {track.length > 0 && (
            <Section title={`Track (${track.length} points)`}>
              <p className="text-xs text-zinc-500">
                Recent path shown on map. Oldest point to newest, left to right.
              </p>
            </Section>
          )}

          {/* Raw payload */}
          <Section
            title="Raw API Payload"
            action={
              <button
                onClick={() => setShowRaw((v) => !v)}
                className="text-xs text-sky-400 hover:text-sky-300"
              >
                {showRaw ? 'Hide' : 'Show'}
              </button>
            }
          >
            {showRaw && (
              <pre className="max-h-64 overflow-auto rounded-lg bg-zinc-900 p-4 font-mono text-xs text-zinc-400">
                {JSON.stringify(data?.rawPayload, null, 2)}
              </pre>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}

function milBarColor(label: string) {
  if (label === 'likely_military') return 'bg-orange-500'
  if (label === 'maybe_military') return 'bg-amber-400'
  if (label === 'likely_civilian') return 'bg-emerald-500'
  return 'bg-zinc-600'
}

function Section({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-600">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-6 gap-y-3">{children}</div>
}

function Field({
  label,
  value,
  span,
}: {
  label: string
  value: React.ReactNode
  span?: boolean
}) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <p className="text-xs text-zinc-600">{label}</p>
      <div className="mt-0.5 text-sm text-zinc-200">{value}</div>
    </div>
  )
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono">{children}</span>
}

function Skeleton() {
  return (
    <div className="p-6 space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-card" />
      <div className="h-64 animate-pulse rounded-xl bg-card" />
    </div>
  )
}

function NotFound({ hex }: { hex: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <p className="text-zinc-400">Aircraft {hex.toUpperCase()} not found or out of range.</p>
      <Link href="/" className="text-sm text-sky-400 hover:text-sky-300">
        ← Back to dashboard
      </Link>
    </div>
  )
}
