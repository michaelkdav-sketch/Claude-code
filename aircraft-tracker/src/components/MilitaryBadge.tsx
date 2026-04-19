import clsx from 'clsx'
import type { MilitaryLabel } from '@/lib/providers/types'

const CONFIG: Record<MilitaryLabel, { label: string; className: string; dot: string }> = {
  likely_military: {
    label: 'Military',
    className: 'bg-orange-500/20 text-orange-300 border border-orange-500/40',
    dot: 'bg-orange-400',
  },
  maybe_military: {
    label: 'Maybe Mil',
    className: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
    dot: 'bg-amber-400',
  },
  likely_civilian: {
    label: 'Civilian',
    className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  unknown: {
    label: 'Unknown',
    className: 'bg-zinc-700/40 text-zinc-400 border border-zinc-600/40',
    dot: 'bg-zinc-500',
  },
}

interface Props {
  label: MilitaryLabel
  score?: number
  size?: 'sm' | 'md'
}

export default function MilitaryBadge({ label, score, size = 'sm' }: Props) {
  const c = CONFIG[label]
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        c.className,
      )}
    >
      <span className={clsx('rounded-full', size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2', c.dot)} />
      {c.label}
      {score !== undefined && (
        <span className="opacity-60">{Math.min(score, 99)}%</span>
      )}
    </span>
  )
}
