import clsx from 'clsx'
import { compassPoint } from '@/lib/geo'
import MilitaryBadge from './MilitaryBadge'
import type { Aircraft } from '@/lib/providers/types'

interface Props {
  aircraft: Aircraft
  selected?: boolean
  isNew?: boolean
  onClick?: () => void
}

export default function AircraftCard({ aircraft: ac, selected, isNew, onClick }: Props) {
  const isMil =
    ac.military.label === 'likely_military' || ac.military.label === 'maybe_military'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      className={clsx(
        'group rounded-xl border p-4 cursor-pointer transition-all duration-150',
        'hover:bg-card-hover',
        isNew && 'aircraft-new',
        selected
          ? 'border-sky-500/60 bg-sky-500/5'
          : isMil
          ? 'border-orange-500/30 bg-card'
          : 'border-border bg-card hover:border-border-bright',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-zinc-100">
              {ac.callsign ?? ac.hex.toUpperCase()}
            </span>
            {ac.callsign && (
              <span className="font-mono text-xs text-zinc-600">{ac.hex.toUpperCase()}</span>
            )}
          </div>
          {ac.typeDescription && (
            <p className="mt-0.5 truncate text-xs text-zinc-500">{ac.typeDescription}</p>
          )}
        </div>
        <MilitaryBadge label={ac.military.label} />
      </div>

      <div className="mt-2 flex items-center gap-2">
        {ac.typeCode && (
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-300">
            {ac.typeCode}
          </span>
        )}
        {ac.registration && (
          <span className="font-mono text-xs text-zinc-500">{ac.registration}</span>
        )}
        {ac.squawk && (
          <span className="font-mono text-xs text-zinc-600">sq:{ac.squawk}</span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-1">
        <Metric
          label="Alt"
          value={
            ac.onGround
              ? 'GND'
              : ac.altitudeFt != null
              ? `${ac.altitudeFt.toLocaleString()} ft`
              : '—'
          }
        />
        <Metric label="Spd" value={ac.groundSpeedKt != null ? `${ac.groundSpeedKt} kt` : '—'} />
        <Metric
          label="Hdg"
          value={ac.trackDeg != null ? `${Math.round(ac.trackDeg)}°` : '—'}
        />
      </div>

      {ac.distanceNm != null && (
        <div className="mt-2 flex items-center gap-1 text-xs text-zinc-500">
          <span className="text-sky-400">{ac.distanceNm.toFixed(1)} nm</span>
          {ac.bearingDeg != null && (
            <>
              <span>@</span>
              <span>{Math.round(ac.bearingDeg)}°</span>
              <span className="text-zinc-400">{compassPoint(ac.bearingDeg)}</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs uppercase tracking-wider text-zinc-600">{label}</span>
      <p className="font-mono text-sm text-zinc-200">{value}</p>
    </div>
  )
}
