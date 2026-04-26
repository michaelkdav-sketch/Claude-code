'use client'

import { useState, useEffect, useCallback } from 'react'

interface LockProperties {
  locked: boolean
  online: boolean
  battery_level?: number
}

interface Lock {
  device_id: string
  display_name: string
  properties: LockProperties
}

interface AccessCode {
  access_code_id: string
  name: string
  code?: string
  status: string
  type: string
  starts_at?: string
  ends_at?: string
}

interface LockEvent {
  event_id: string
  event_type: string
  created_at: string
}

type Tab = 'codes' | 'events'

const POLL_INTERVAL_MS = 30_000

export default function Home() {
  const [lock, setLock] = useState<Lock | null>(null)
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([])
  const [events, setEvents] = useState<LockEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [lockLoading, setLockLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('codes')
  const [showForm, setShowForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', startsAt: '', endsAt: '' })

  const fetchLock = useCallback(async () => {
    const res = await fetch('/api/lock')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to fetch lock')
    setLock(data.lock)
  }, [])

  const fetchCodes = useCallback(async (deviceId: string) => {
    const res = await fetch(`/api/access-codes?deviceId=${deviceId}`)
    const data = await res.json()
    if (res.ok) setAccessCodes(data.accessCodes ?? [])
  }, [])

  const fetchEvents = useCallback(async (deviceId: string) => {
    const res = await fetch(`/api/events?deviceId=${deviceId}`)
    const data = await res.json()
    if (res.ok) setEvents(data.events ?? [])
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await fetchLock()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setLoading(false)
    }
  }, [fetchLock])

  useEffect(() => {
    loadAll()
    const interval = setInterval(() => fetchLock().catch(() => {}), POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [loadAll, fetchLock])

  useEffect(() => {
    if (lock?.device_id) {
      fetchCodes(lock.device_id)
      fetchEvents(lock.device_id)
    }
  }, [lock?.device_id, fetchCodes, fetchEvents])

  const handleLockAction = async (action: 'lock' | 'unlock') => {
    if (!lock) return
    setLockLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, deviceId: lock.device_id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Action failed')
      setLock(data.lock)
      fetchEvents(lock.device_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setLockLoading(false)
    }
  }

  const handleDeleteCode = async (id: string) => {
    if (!confirm('Delete this access code?')) return
    try {
      const res = await fetch(`/api/access-codes/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Delete failed')
      }
      setAccessCodes((prev) => prev.filter((c) => c.access_code_id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete code')
    }
  }

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lock) return
    setFormLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/access-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: lock.device_id,
          name: form.name,
          code: form.code || undefined,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Create failed')
      setAccessCodes((prev) => [...prev, data.accessCode])
      setShowForm(false)
      setForm({ name: '', code: '', startsAt: '', endsAt: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create code')
    } finally {
      setFormLoading(false)
    }
  }

  const fmtDate = (s: string) => new Date(s).toLocaleString()
  const fmtEvent = (t: string) => t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const batteryPct = (v?: number) => (v !== undefined ? `${Math.round(v * 100)}%` : null)

  // ── Loading screen ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Connecting to lock…</p>
        </div>
      </div>
    )
  }

  // ── Fatal error (no lock loaded) ─────────────────────────────────────────
  if (error && !lock) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="text-center max-w-xs">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-lg font-semibold text-red-400 mb-2">Connection Error</h2>
          <p className="text-gray-400 text-sm mb-6">{error}</p>
          <button
            onClick={loadAll}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  const isLocked = lock?.properties.locked
  const isOnline = lock?.properties.online
  const battery = batteryPct(lock?.properties.battery_level)

  // ── Main UI ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto px-4 pb-10">
      {/* ── Header ── */}
      <div className="flex items-center justify-between py-5 mb-2">
        <div>
          <h1 className="text-lg font-bold leading-tight">{lock?.display_name ?? 'Smart Lock'}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`}
            />
            <span className="text-xs text-gray-400">{isOnline ? 'Online' : 'Offline'}</span>
            {battery && (
              <>
                <span className="text-gray-700">·</span>
                <span className="text-xs text-gray-400">🔋 {battery}</span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => { loadAll(); if (lock) { fetchCodes(lock.device_id); fetchEvents(lock.device_id) } }}
          className="p-2 text-gray-500 hover:text-white transition-colors text-xl leading-none"
          title="Refresh"
          aria-label="Refresh"
        >
          ↻
        </button>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-start gap-2 bg-red-950/60 border border-red-800 text-red-300 rounded-xl px-4 py-3 mb-4 text-sm">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300 shrink-0">
            ✕
          </button>
        </div>
      )}

      {/* ── Lock status card ── */}
      <div
        className={`rounded-2xl p-6 mb-6 text-center transition-colors duration-300 ${
          isLocked
            ? 'bg-slate-800/80'
            : 'bg-amber-950/60 border border-amber-700/40'
        }`}
      >
        <div className="text-7xl mb-3 select-none">{isLocked ? '🔒' : '🔓'}</div>
        <p
          className={`text-2xl font-bold mb-6 ${
            isLocked ? 'text-slate-200' : 'text-amber-300'
          }`}
        >
          {isLocked ? 'Locked' : 'Unlocked'}
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => handleLockAction('lock')}
            disabled={lockLoading || !!isLocked}
            className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
              isLocked
                ? 'bg-slate-700/50 text-slate-600 cursor-not-allowed'
                : 'bg-slate-700 hover:bg-slate-600 text-white active:scale-95'
            }`}
          >
            {lockLoading && !isLocked ? 'Locking…' : 'Lock'}
          </button>
          <button
            onClick={() => handleLockAction('unlock')}
            disabled={lockLoading || !isLocked}
            className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
              !isLocked
                ? 'bg-amber-900/20 text-amber-900 cursor-not-allowed'
                : 'bg-amber-600 hover:bg-amber-500 text-white active:scale-95'
            }`}
          >
            {lockLoading && isLocked ? 'Unlocking…' : 'Unlock'}
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex bg-slate-800/60 rounded-xl p-1 mb-4">
        {(['codes', 'events'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-slate-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab === 'codes' ? `Access Codes (${accessCodes.length})` : `Events (${events.length})`}
          </button>
        ))}
      </div>

      {/* ── Access Codes tab ── */}
      {activeTab === 'codes' && (
        <div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 py-3 rounded-xl font-semibold text-sm mb-4 transition-colors"
          >
            {showForm ? 'Cancel' : '+ Add Guest Code'}
          </button>

          {showForm && (
            <form
              onSubmit={handleCreateCode}
              className="bg-slate-800/70 rounded-2xl p-4 mb-4 space-y-3"
            >
              <h3 className="font-semibold text-sm text-gray-300 mb-1">New Access Code</h3>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Guest, Cleaner, etc."
                  required
                  className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  PIN code <span className="text-gray-600">(optional — auto-generated if blank)</span>
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                  placeholder="4–8 digits"
                  pattern="\d{4,8}"
                  className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Start</label>
                  <input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))}
                    className="w-full bg-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">End</label>
                  <input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value }))}
                    className="w-full bg-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={formLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {formLoading ? 'Creating…' : 'Create Code'}
              </button>
            </form>
          )}

          <div className="space-y-2">
            {accessCodes.length === 0 ? (
              <p className="text-center text-gray-600 py-10 text-sm">No access codes yet.</p>
            ) : (
              accessCodes.map((c) => (
                <div
                  key={c.access_code_id}
                  className="bg-slate-800/60 rounded-xl px-4 py-3 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{c.name}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                          c.status === 'set'
                            ? 'bg-green-900/60 text-green-400'
                            : 'bg-yellow-900/60 text-yellow-400'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    {c.code && (
                      <p className="text-sm font-mono text-gray-300 mt-0.5">{c.code}</p>
                    )}
                    {c.type === 'time_bound' && (c.starts_at || c.ends_at) && (
                      <p className="text-xs text-gray-600 mt-1">
                        {c.starts_at && `From ${fmtDate(c.starts_at)}`}
                        {c.ends_at && ` → ${fmtDate(c.ends_at)}`}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteCode(c.access_code_id)}
                    className="text-gray-600 hover:text-red-400 transition-colors text-xl leading-none shrink-0 mt-0.5"
                    title="Delete code"
                    aria-label="Delete access code"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Events tab ── */}
      {activeTab === 'events' && (
        <div className="space-y-2">
          {events.length === 0 ? (
            <p className="text-center text-gray-600 py-10 text-sm">No recent events.</p>
          ) : (
            events.map((ev) => (
              <div
                key={ev.event_id}
                className="bg-slate-800/60 rounded-xl px-4 py-3 flex items-center gap-3"
              >
                <span className="text-lg select-none">
                  {ev.event_type.includes('unlock') ? '🔓' : ev.event_type.includes('lock') ? '🔒' : '📋'}
                </span>
                <div>
                  <p className="text-sm font-medium">{fmtEvent(ev.event_type)}</p>
                  <p className="text-xs text-gray-500">{fmtDate(ev.created_at)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
