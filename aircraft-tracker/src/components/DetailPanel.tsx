'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { compassPoint } from '@/lib/geo'
import MilitaryBadge from './MilitaryBadge'
import type { Aircraft } from '@/lib/providers/types'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Props {
  aircraft: Aircraft | null
  onClose: () => void
  trackPointCount?: number
  isFavorite?: boolean
  onFavoriteToggle?: () => void
}

export default function DetailPanel({
  aircraft: ac,
  onClose,
  trackPointCount = 0,
  isFavorite,
  onFavoriteToggle,
}: Props) {
  if (!ac) return null

  const milConf = Math.min(Math.round(ac.military.confidence * 100), 99)

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors text-sm"
          aria-label="Close"
        >
          ✕
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-zinc-100 truncate">
              {ac.callsign ?? ac.hex.toUpperCase()}
            </span>
            {ac.callsign && (
              <span className="font-mono text-xs text-zinc-600 shrink-0">
                {ac.hex.toUpperCase()}
              </span>
            )}
            {ac.inFormation && (
              <span className="text-xs text-violet-400 shrink-0" title="Formation flight">⟡</span>
            )}
          </div>
          {ac.typeDescription && (
            <p className="text-xs text-zinc-500 truncate">{ac.typeDescription}</p>
          )}
        </div>
        {onFavoriteToggle && (
          <button
            onClick={onFavoriteToggle}
            className={`mr-1 text-base transition-colors ${
              isFavorite ? 'text-yellow-400' : 'text-zinc-600 hover:text-zinc-400'
            }`}
            aria-label={isFavorite ? 'Remove favorite' : 'Add favorite'}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            ★
          </button>
        )}
        <MilitaryBadge label={ac.military.label} />
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Photo thumbnail */}
        <PhotoThumbnail hex={ac.hex} />

        {/* Tags row */}
        <div className="flex flex-wrap gap-2">
          {ac.typeCode && (
            <span className="rounded-md bg-zinc-800 px-2 py-1 font-mono text-xs text-zinc-300">
              {ac.typeCode}
            </span>
          )}
          {ac.registration && (
            <span className="rounded-md bg-zinc-800 px-2 py-1 font-mono text-xs text-zinc-400">
              {ac.registration}
            </span>
          )}
          {ac.squawk && (
            <span className="rounded-md bg-zinc-800 px-2 py-1 font-mono text-xs text-zinc-500">
              sq {ac.squawk}
            </span>
          )}
        </div>

        {/* FAA owner lookup */}
        {ac.registration && <FaaOwner registration={ac.registration} />}

        {/* Flight metrics grid */}
        <div className="grid grid-cols-2 gap-2">
          <MetricBox
            label="Altitude"
            value={
              ac.onGround
                ? 'On ground'
                : ac.altitudeFt != null
                ? `${ac.altitudeFt.toLocaleString()} ft`
                : '—'
            }
          />
          <MetricBox
            label="Speed"
            value={ac.groundSpeedKt != null ? `${ac.groundSpeedKt} kt` : '—'}
          />
          <MetricBox
            label="Track"
            value={
              ac.trackDeg != null
                ? `${Math.round(ac.trackDeg)}° ${compassPoint(ac.trackDeg)}`
                : '—'
            }
          />
          <MetricBox
            label="Distance"
            value={
              ac.distanceNm != null && ac.bearingDeg != null
                ? `${ac.distanceNm.toFixed(1)} nm ${compassPoint(ac.bearingDeg)}`
                : ac.distanceNm != null
                ? `${ac.distanceNm.toFixed(1)} nm`
                : '—'
            }
          />
        </div>

        {/* Military classification */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-zinc-600">Classification</p>
            <span className="font-mono text-xs text-zinc-500">{milConf}%</span>
          </div>

          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${milBarColor(ac.military.label)}`}
              style={{ width: `${milConf}%` }}
            />
          </div>

          <MilitaryBadge label={ac.military.label} size="md" />

          <ul className="mt-3 space-y-1.5">
            {ac.military.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5 shrink-0 text-zinc-600">·</span>
                <span className="text-zinc-400">{r}</span>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-xs italic text-zinc-700">
            Heuristic scoring — not definitive.
          </p>

        {/* Track status */}
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs uppercase tracking-wider text-zinc-600">Flight Path</p>
          {trackPointCount > 1 ? (
            <p className="mt-1 text-sm text-zinc-300">
              Showing last{' '}
              <span className="font-mono text-sky-400">{trackPointCount}</span> positions on map
            </p>
          ) : (
            <p className="mt-1 text-xs text-zinc-600">
              No track yet — path builds while the aircraft stays in range.
            </p>
          )}
        </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="shrink-0 border-t border-border px-4 py-3">
        <Link
          href={`/aircraft/${ac.hex}`}
          className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-2 text-xs text-zinc-400 transition-colors hover:border-border-bright hover:text-zinc-200"
        >
          Full details & track history →
        </Link>
      </div>
    </div>
  )
}

function PhotoThumbnail({ hex }: { hex: string }) {
  const { data } = useSWR<{ photo: { src: string; link?: string; photographer?: string } | null }>(
    `/api/photo/${hex}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 3_600_000 },
  )

  if (!data?.photo) return null

  return (
    <a
      href={data.photo.link ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="block overflow-hidden rounded-lg border border-border"
    >
      <img
        src={data.photo.src}
        alt="Aircraft photo"
        className="w-full object-cover"
        style={{ maxHeight: 160 }}
      />
      {data.photo.photographer && (
        <p className="px-2 py-1 text-xs text-zinc-600">© {data.photo.photographer}</p>
      )}
    </a>
  )
}

function FaaOwner({ registration }: { registration: string }) {
  const { data } = useSWR<{ owner: string | null; state: string | null }>(
    `/api/faa/${encodeURIComponent(registration)}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 3_600_000 },
  )

  if (!data?.owner) return null

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-xs uppercase tracking-wider text-zinc-600">Registered Owner</p>
      <p className="mt-0.5 text-sm text-zinc-300">{data.owner}</p>
      {data.state && <p className="text-xs text-zinc-600">{data.state}</p>}
    </div>
  )
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs uppercase tracking-wider text-zinc-600">{label}</p>
      <p className="mt-1 font-mono text-sm text-zinc-200">{value}</p>
    </div>
  )
}

function milBarColor(label: string) {
  if (label === 'likely_military') return 'bg-orange-500'
  if (label === 'maybe_military') return 'bg-amber-400'
  if (label === 'likely_civilian') return 'bg-emerald-500'
  return 'bg-zinc-600'
}
