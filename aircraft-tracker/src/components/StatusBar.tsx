'use client'

import { formatDistanceToNowStrict } from 'date-fns'
import type { AppStatus } from '@/lib/providers/types'

interface Props {
  status: AppStatus | null
  isLoading: boolean
}

export default function StatusBar({ status, isLoading }: Props) {
  const lastSeen = status?.lastFetchAt
    ? formatDistanceToNowStrict(status.lastFetchAt, { addSuffix: true })
    : 'never'

  const isLive = status?.lastFetchAt && Date.now() - status.lastFetchAt < 20_000

  return (
    <div className="flex items-center gap-3 text-xs text-zinc-500">
      {/* live indicator */}
      <span className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          {isLive && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${
              isLoading ? 'bg-amber-400' : isLive ? 'bg-emerald-400' : 'bg-zinc-600'
            }`}
          />
        </span>
        <span className={isLive ? 'text-emerald-400' : 'text-zinc-500'}>
          {isLoading ? 'Fetching…' : isLive ? 'Live' : 'Stale'}
        </span>
      </span>

      <span className="text-zinc-700">·</span>
      <span>Updated {lastSeen}</span>

      {status?.source && (
        <>
          <span className="text-zinc-700">·</span>
          <span className="font-mono text-zinc-600">{status.source}</span>
        </>
      )}

      {status?.error && (
        <>
          <span className="text-zinc-700">·</span>
          <span className="text-red-400">{status.error}</span>
        </>
      )}
    </div>
  )
}
