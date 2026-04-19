import type { Aircraft } from '@/lib/providers/types'

interface Props {
  aircraft: Aircraft[]
}

export default function StatsBanner({ aircraft }: Props) {
  const military = aircraft.filter((a) => a.military.label === 'likely_military').length
  const maybe = aircraft.filter((a) => a.military.label === 'maybe_military').length
  const civilian = aircraft.filter((a) => a.military.label === 'likely_civilian').length
  const unknown = aircraft.filter((a) => a.military.label === 'unknown').length

  const stats = [
    { label: 'Total', value: aircraft.length, color: 'text-zinc-100' },
    { label: 'Civilian', value: civilian, color: 'text-emerald-400' },
    { label: 'Maybe Mil', value: maybe, color: 'text-amber-400' },
    { label: 'Military', value: military, color: 'text-orange-400' },
    { label: 'Unknown', value: unknown, color: 'text-zinc-500' },
  ]

  return (
    <div className="flex items-center gap-6">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col">
          <span className={`text-2xl font-bold tabular-nums leading-none ${s.color}`}>
            {s.value}
          </span>
          <span className="mt-0.5 text-xs uppercase tracking-widest text-zinc-600">
            {s.label}
          </span>
        </div>
      ))}
    </div>
  )
}
