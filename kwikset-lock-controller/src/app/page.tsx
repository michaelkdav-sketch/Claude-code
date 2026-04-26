'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Kwikset / Seam types ─────────────────────────────────────────────────────

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

// ── Roborock / Home Assistant types ─────────────────────────────────────────

interface VacuumAttributes {
  battery_level?: number
  status?: string
  fan_speed?: string
  error?: string
  friendly_name?: string
}

interface VacuumSupportedFeatures {
  pause: boolean
  returnHome: boolean
  battery: boolean
  locate: boolean
  fanSpeed: boolean
}

interface VacuumStatus {
  state: string
  attributes: VacuumAttributes
  lastUpdated: string
  supportedFeatures: VacuumSupportedFeatures
}

// ── Constants ────────────────────────────────────────────────────────────────

type Tab = 'codes' | 'events'
const LOCK_POLL_MS = 30_000
const VACUUM_POLL_MS = 10_000

// ── Vacuum helpers ───────────────────────────────────────────────────────────

const VACUUM_STATE_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  cleaning:    { label: 'Cleaning',          icon: '🤖', color: 'text-green-300',  bg: 'bg-green-950/50 border border-green-800/40' },
  docked:      { label: 'Docked & Charging', icon: '⚡', color: 'text-blue-300',   bg: 'bg-blue-950/50 border border-blue-800/40' },
  idle:        { label: 'Idle',              icon: '💤', color: 'text-slate-300',  bg: 'bg-slate-800/80' },
  paused:      { label: 'Paused',            icon: '⏸',  color: 'text-yellow-300', bg: 'bg-yellow-950/50 border border-yellow-800/40' },
  returning:   { label: 'Returning to Dock', icon: '🏠', color: 'text-purple-300', bg: 'bg-purple-950/50 border border-purple-800/40' },
  error:       { label: 'Error',             icon: '⚠️', color: 'text-red-300',    bg: 'bg-red-950/50 border border-red-800/40' },
  unavailable: { label: 'Unavailable',       icon: '⚫', color: 'text-gray-500',   bg: 'bg-slate-800/40' },
}

function vacuumConfig(state: string) {
  return VACUUM_STATE_CONFIG[state] ?? { label: state, icon: '🤖', color: 'text-slate-300', bg: 'bg-slate-800/80' }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Home() {
  // Lock state
  const [lock, setLock] = useState<Lock | null>(null)
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([])
  const [events, setEvents] = useState<LockEvent[]>([])
  const [lockInitLoading, setLockInitLoading] = useState(true)
  const [lockActionLoading, setLockActionLoading] = useState(false)
  const [lockError, setLockError] = useState<string | null>(null)

  // Lock form state
  const [activeTab, setActiveTab] = useState<Tab>('codes')
  const [showForm, setShowForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', startsAt: '', endsAt: '' })

  // Vacuum state
  const [vacuum, setVacuum] = useState<VacuumStatus | null>(null)
  const [vacuumActionLoading, setVacuumActionLoading] = useState(false)
  const [vacuumError, setVacuumError] = useState<string | null>(null)

  // ── Lock fetchers ──────────────────────────────────────────────────────────

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

  const initLock = useCallback(async () => {
    setLockInitLoading(true)
    setLockError(null)
    try {
      await fetchLock()
    } catch (err) {
      setLockError(err instanceof Error ? err.message : 'Lock connection failed')
    } finally {
      setLockInitLoading(false)
    }
  }, [fetchLock])

  // ── Vacuum fetchers ────────────────────────────────────────────────────────

  const fetchVacuum = useCallback(async () => {
    try {
      const res = await fetch('/api/roborock/status')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to fetch vacuum')
      setVacuum(data)
      setVacuumError(null)
    } catch (err) {
      setVacuumError(err instanceof Error ? err.message : 'Vacuum unavailable')
    }
  }, [])

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    initLock()
    const t = setInterval(() => fetchLock().catch(() => {}), LOCK_POLL_MS)
    return () => clearInterval(t)
  }, [initLock, fetchLock])

  useEffect(() => {
    if (lock?.device_id) {
      fetchCodes(lock.device_id)
      fetchEvents(lock.device_id)
    }
  }, [lock?.device_id, fetchCodes, fetchEvents])

  useEffect(() => {
    fetchVacuum()
    const t = setInterval(fetchVacuum, VACUUM_POLL_MS)
    return () => clearInterval(t)
  }, [fetchVacuum])

  // ── Lock actions ───────────────────────────────────────────────────────────

  const handleLockAction = async (action: 'lock' | 'unlock') => {
    if (!lock) return
    setLockActionLoading(true)
    setLockError(null)
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
      setLockError(err instanceof Error ? err.message : 'Lock action failed')
    } finally {
      setLockActionLoading(false)
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
      setLockError(err instanceof Error ? err.message : 'Failed to delete code')
    }
  }

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lock) return
    setFormLoading(true)
    setLockError(null)
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
      setLockError(err instanceof Error ? err.message : 'Failed to create code')
    } finally {
      setFormLoading(false)
    }
  }

  // ── Vacuum actions ─────────────────────────────────────────────────────────

  const handleVacuumAction = async (action: 'start' | 'pause' | 'dock') => {
    setVacuumActionLoading(true)
    setVacuumError(null)
    try {
      const res = await fetch(`/api/roborock/${action}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Vacuum action failed')
      setVacuum(data)
    } catch (err) {
      setVacuumError(err instanceof Error ? err.message : 'Vacuum action failed')
    } finally {
      setVacuumActionLoading(false)
    }
  }

  // ── Formatters ─────────────────────────────────────────────────────────────

  const fmtDate = (s: string) => new Date(s).toLocaleString()
  const fmtEvent = (t: string) => t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const batteryPct = (v?: number) =>
    v !== undefined ? `${typeof v === 'number' && v <= 1 ? Math.round(v * 100) : Math.round(v)}%` : null

  // ── Loading screen (only blocks on lock; vacuum loads independently) ───────

  if (lockInitLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      </div>
    )
  }

  const isLocked = lock?.properties.locked
  const isOnline = lock?.properties.online
  const lockBattery = batteryPct(lock?.properties.battery_level)

  const vState = vacuum?.state ?? 'unavailable'
  const vCfg = vacuumConfig(vState)
  const vBattery = batteryPct(vacuum?.attributes.battery_level)
  const vBusy = vacuumActionLoading
  const canStart = !vBusy && vState !== 'cleaning'
  const canPause = !vBusy && (vacuum?.supportedFeatures.pause ?? true) && vState === 'cleaning'
  const canDock = !vBusy && (vacuum?.supportedFeatures.returnHome ?? true) && vState !== 'docked' && vState !== 'returning'

  // ── Main UI ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-md mx-auto px-4 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center justify-between py-5 mb-2">
        <h1 className="text-lg font-bold">Smart Home</h1>
        <button
          onClick={() => {
            initLock()
            fetchVacuum()
            if (lock) { fetchCodes(lock.device_id); fetchEvents(lock.device_id) }
          }}
          className="p-2 text-gray-500 hover:text-white transition-colors text-xl leading-none"
          title="Refresh all"
          aria-label="Refresh"
        >
          ↻
        </button>
      </div>

      {/* ── Lock error banner ── */}
      {lockError && (
        <div className="flex items-start gap-2 bg-red-950/60 border border-red-800 text-red-300 rounded-xl px-4 py-3 mb-4 text-sm">
          <span className="flex-1">{lockError}</span>
          <button onClick={() => setLockError(null)} className="text-red-500 hover:text-red-300 shrink-0">✕</button>
        </div>
      )}

      {/* ── Lock card ── */}
      {lock ? (
        <div
          className={`rounded-2xl p-5 mb-4 transition-colors duration-300 ${
            isLocked ? 'bg-slate-800/80' : 'bg-amber-950/60 border border-amber-700/40'
          }`}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Kwikset Lock</p>
              <p className="font-semibold text-sm">{lock.display_name}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-xs text-gray-400">{isOnline ? 'Online' : 'Offline'}</span>
                {lockBattery && <span className="text-xs text-gray-500">· 🔋 {lockBattery}</span>}
              </div>
            </div>
            <div className="text-4xl select-none">{isLocked ? '🔒' : '🔓'}</div>
          </div>

          <p className={`text-xl font-bold mb-4 ${isLocked ? 'text-slate-200' : 'text-amber-300'}`}>
            {isLocked ? 'Locked' : 'Unlocked'}
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => handleLockAction('lock')}
              disabled={lockActionLoading || !!isLocked}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                isLocked
                  ? 'bg-slate-700/40 text-slate-600 cursor-not-allowed'
                  : 'bg-slate-700 hover:bg-slate-600 text-white active:scale-95'
              }`}
            >
              {lockActionLoading && !isLocked ? 'Locking…' : 'Lock'}
            </button>
            <button
              onClick={() => handleLockAction('unlock')}
              disabled={lockActionLoading || !isLocked}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                !isLocked
                  ? 'bg-amber-900/20 text-amber-900 cursor-not-allowed'
                  : 'bg-amber-600 hover:bg-amber-500 text-white active:scale-95'
              }`}
            >
              {lockActionLoading && isLocked ? 'Unlocking…' : 'Unlock'}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-5 mb-4 bg-slate-800/60 text-center">
          <p className="text-gray-500 text-sm">Lock unavailable</p>
          {lockError && <p className="text-red-400 text-xs mt-1">{lockError}</p>}
          <button onClick={initLock} className="mt-3 text-xs text-blue-400 hover:text-blue-300">Retry</button>
        </div>
      )}

      {/* ── Vacuum card ── */}
      <div className={`rounded-2xl p-5 mb-6 transition-colors duration-300 ${vCfg.bg}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Roborock Curv 2</p>
            <p className="font-semibold text-sm">
              {vacuum?.attributes.friendly_name ?? 'Vacuum'}
            </p>
            {vBattery && (
              <p className="text-xs text-gray-400 mt-1">🔋 {vBattery}</p>
            )}
          </div>
          <div className="text-4xl select-none">{vCfg.icon}</div>
        </div>

        <p className={`text-xl font-bold mb-1 ${vCfg.color}`}>{vCfg.label}</p>

        {/* Error message from vacuum entity */}
        {(vState === 'error' && vacuum?.attributes.error) && (
          <p className="text-xs text-red-400 mb-3">{vacuum.attributes.error}</p>
        )}

        {/* Home Assistant error (HA unreachable, bad token, etc.) */}
        {vacuumError && (
          <div className="flex items-start gap-2 bg-red-950/60 border border-red-800 text-red-300 rounded-lg px-3 py-2 mb-3 text-xs">
            <span className="flex-1">{vacuumError}</span>
            <button onClick={() => setVacuumError(null)} className="text-red-500 shrink-0">✕</button>
          </div>
        )}

        {vacuum?.lastUpdated && (
          <p className="text-xs text-gray-600 mb-4">
            Updated {new Date(vacuum.lastUpdated).toLocaleTimeString()}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => handleVacuumAction('start')}
            disabled={!canStart}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              canStart
                ? 'bg-green-700 hover:bg-green-600 text-white active:scale-95'
                : 'bg-slate-700/40 text-slate-600 cursor-not-allowed'
            }`}
          >
            {vacuumActionLoading ? '…' : 'Start'}
          </button>
          <button
            onClick={() => handleVacuumAction('pause')}
            disabled={!canPause}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              canPause
                ? 'bg-yellow-700 hover:bg-yellow-600 text-white active:scale-95'
                : 'bg-slate-700/40 text-slate-600 cursor-not-allowed'
            }`}
          >
            Pause
          </button>
          <button
            onClick={() => handleVacuumAction('dock')}
            disabled={!canDock}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              canDock
                ? 'bg-blue-700 hover:bg-blue-600 text-white active:scale-95'
                : 'bg-slate-700/40 text-slate-600 cursor-not-allowed'
            }`}
          >
            Dock
          </button>
        </div>
      </div>

      {/* ── Lock tabs ── */}
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
            <form onSubmit={handleCreateCode} className="bg-slate-800/70 rounded-2xl p-4 mb-4 space-y-3">
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
                <div key={c.access_code_id} className="bg-slate-800/60 rounded-xl px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{c.name}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                          c.status === 'set' ? 'bg-green-900/60 text-green-400' : 'bg-yellow-900/60 text-yellow-400'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    {c.code && <p className="text-sm font-mono text-gray-300 mt-0.5">{c.code}</p>}
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
              <div key={ev.event_id} className="bg-slate-800/60 rounded-xl px-4 py-3 flex items-center gap-3">
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
