'use client'

import { useState, useEffect } from 'react'

interface Digest {
  todayCount: number
  militaryCount: number
  newFirstSightings: number
  topCallsign: string | null
}

interface Props {
  digest: Digest
}

const DISMISS_KEY = 'aw-digest-dismissed'

function getTodayKey() {
  return new Date().toISOString().slice(0, 10)
}

export default function DigestBanner({ digest }: Props) {
  const [dismissed, setDismissed] = useState(true) // start hidden to avoid SSR flash

  useEffect(() => {
    try {
      const val = localStorage.getItem(DISMISS_KEY)
      if (val !== getTodayKey()) setDismissed(false)
    } catch {}
  }, [])

  const isInteresting = digest.militaryCount > 0 || digest.newFirstSightings > 0
  if (!isInteresting || dismissed) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, getTodayKey())
    } catch {}
    setDismissed(true)
  }

  return (
    <div className="flex shrink-0 items-center justify-between gap-4 border-b border-amber-500/20 bg-amber-500/5 px-6 py-2 text-xs">
      <div className="flex items-center gap-4 text-amber-300/80">
        <span className="font-semibold text-amber-300">Today</span>
        <span>{digest.todayCount} aircraft overhead</span>
        {digest.militaryCount > 0 && (
          <span className="text-orange-400">
            {digest.militaryCount} military contact{digest.militaryCount > 1 ? 's' : ''}
          </span>
        )}
        {digest.newFirstSightings > 0 && (
          <span className="text-sky-400">
            {digest.newFirstSightings} new first-sighting{digest.newFirstSightings > 1 ? 's' : ''}
          </span>
        )}
        {digest.topCallsign && (
          <span className="text-zinc-500">
            Top: <span className="font-mono text-zinc-400">{digest.topCallsign}</span>
          </span>
        )}
      </div>
      <button
        onClick={dismiss}
        className="text-zinc-600 hover:text-zinc-400 transition-colors"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
