import { getDb } from './index'
import type { Aircraft, OverheadEvent, MilitaryLabel } from '../providers/types'

// ── Snapshots ────────────────────────────────────────────────────────────────

export function insertSnapshot(ac: Aircraft): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO aircraft_snapshots
      (hex, callsign, type_code, type_desc, registration, altitude_ft, on_ground,
       speed_kt, track_deg, lat, lon, squawk, category, distance_nm, bearing_deg,
       mil_score, mil_label, mil_reasons, source, fetched_at, raw_json)
    VALUES
      (@hex, @callsign, @typeCode, @typeDesc, @registration, @altitudeFt, @onGround,
       @speedKt, @trackDeg, @lat, @lon, @squawk, @category, @distanceNm, @bearingDeg,
       @milScore, @milLabel, @milReasons, @source, @fetchedAt, @rawJson)
  `).run({
    hex: ac.hex,
    callsign: ac.callsign,
    typeCode: ac.typeCode,
    typeDesc: ac.typeDescription,
    registration: ac.registration,
    altitudeFt: ac.altitudeFt,
    onGround: ac.onGround ? 1 : 0,
    speedKt: ac.groundSpeedKt,
    trackDeg: ac.trackDeg,
    lat: ac.lat,
    lon: ac.lon,
    squawk: ac.squawk,
    category: ac.category,
    distanceNm: ac.distanceNm,
    bearingDeg: ac.bearingDeg,
    milScore: ac.military.score,
    milLabel: ac.military.label,
    milReasons: JSON.stringify(ac.military.reasons),
    source: ac.source,
    fetchedAt: ac.fetchedAt,
    rawJson: '{}', // raw payload omitted from DB to save space
  })
}

// ── Overhead events ───────────────────────────────────────────────────────────

const EVENT_MERGE_WINDOW_MS = 15 * 60 * 1000 // merge events within 15 min

export function upsertOverheadEvent(ac: Aircraft): void {
  const db = getDb()
  const now = Date.now()
  const cutoff = now - EVENT_MERGE_WINDOW_MS

  const existing = db.prepare(`
    SELECT id FROM overhead_events
    WHERE hex = ? AND last_seen >= ?
    ORDER BY last_seen DESC LIMIT 1
  `).get(ac.hex, cutoff) as { id: number } | undefined

  if (existing) {
    db.prepare(`
      UPDATE overhead_events SET
        last_seen      = MAX(last_seen, ?),
        closest_nm     = MIN(COALESCE(closest_nm, 9999), COALESCE(?, 9999)),
        max_altitude_ft = MAX(COALESCE(max_altitude_ft, 0), COALESCE(?, 0)),
        mil_score      = MAX(mil_score, ?),
        mil_label      = CASE WHEN ? > mil_score THEN ? ELSE mil_label END,
        snapshot_count = snapshot_count + 1,
        callsign       = COALESCE(callsign, ?),
        type_code      = COALESCE(type_code, ?),
        type_desc      = COALESCE(type_desc, ?)
      WHERE id = ?
    `).run(
      ac.fetchedAt,
      ac.distanceNm,
      ac.altitudeFt,
      ac.military.score,
      ac.military.score, ac.military.label,
      ac.callsign,
      ac.typeCode,
      ac.typeDescription,
      existing.id,
    )
  } else {
    db.prepare(`
      INSERT INTO overhead_events
        (hex, callsign, type_code, type_desc, first_seen, last_seen,
         closest_nm, max_altitude_ft, mil_score, mil_label)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ac.hex, ac.callsign, ac.typeCode, ac.typeDescription,
      ac.fetchedAt, ac.fetchedAt,
      ac.distanceNm, ac.altitudeFt,
      ac.military.score, ac.military.label,
    )
  }
}

// ── Read queries ──────────────────────────────────────────────────────────────

export function getRecentEvents(limit = 100, sinceMs?: number): OverheadEvent[] {
  const db = getDb()
  const cutoff = sinceMs ?? (Date.now() - 7 * 24 * 60 * 60 * 1000)

  const rows = db.prepare(`
    SELECT * FROM overhead_events
    WHERE last_seen >= ?
    ORDER BY last_seen DESC
    LIMIT ?
  `).all(cutoff, limit) as Record<string, unknown>[]

  return rows.map(rowToEvent)
}

export function getSnapshotsByHex(hex: string, limit = 200): Record<string, unknown>[] {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM aircraft_snapshots
    WHERE hex = ?
    ORDER BY fetched_at DESC
    LIMIT ?
  `).all(hex, limit) as Record<string, unknown>[]
}

export function getStats(): { total: number; military: number; maybe: number; civilian: number } {
  const db = getDb()

  // Count distinct aircraft seen in the last 30 seconds (current window)
  const cutoff = Date.now() - 30_000
  const rows = db.prepare(`
    SELECT mil_label, COUNT(DISTINCT hex) as cnt
    FROM aircraft_snapshots
    WHERE fetched_at >= ?
    GROUP BY mil_label
  `).all(cutoff) as { mil_label: string; cnt: number }[]

  let total = 0, military = 0, maybe = 0, civilian = 0
  for (const r of rows) {
    total += r.cnt
    if (r.mil_label === 'likely_military') military += r.cnt
    else if (r.mil_label === 'maybe_military') maybe += r.cnt
    else civilian += r.cnt
  }
  return { total, military, maybe, civilian }
}

// ── Poll state ────────────────────────────────────────────────────────────────

export function getPollState(): { lastFetchAt: number | null; lastError: string | null } {
  const db = getDb()
  const ts = db.prepare(`SELECT value FROM poll_state WHERE key = 'last_fetch_at'`).get() as { value: string } | undefined
  const err = db.prepare(`SELECT value FROM poll_state WHERE key = 'last_error'`).get() as { value: string } | undefined
  return {
    lastFetchAt: ts ? parseInt(ts.value) : null,
    lastError: err?.value ?? null,
  }
}

export function setPollState(lastFetchAt: number, error: string | null): void {
  const db = getDb()
  const upsert = db.prepare(`
    INSERT INTO poll_state (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `)
  upsert.run('last_fetch_at', String(lastFetchAt))
  upsert.run('last_error', error ?? '')
}

// ── Statistics ────────────────────────────────────────────────────────────────

export interface StatsSummary {
  totalEvents: number
  militaryEvents: number
  uniqueTypes: number
  busiestHour: number | null
}

export function getStatsSummary(): StatsSummary {
  const db = getDb()
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000

  const total = (db.prepare(`SELECT COUNT(*) as n FROM overhead_events WHERE last_seen >= ?`).get(since) as { n: number }).n
  const military = (db.prepare(`SELECT COUNT(*) as n FROM overhead_events WHERE last_seen >= ? AND mil_label IN ('likely_military','maybe_military')`).get(since) as { n: number }).n
  const uniqueTypes = (db.prepare(`SELECT COUNT(DISTINCT type_code) as n FROM overhead_events WHERE last_seen >= ? AND type_code IS NOT NULL`).get(since) as { n: number }).n

  const busiestRow = db.prepare(`
    SELECT CAST(strftime('%H', datetime(first_seen/1000, 'unixepoch', 'localtime')) AS INTEGER) AS hour,
           COUNT(*) AS cnt
    FROM overhead_events WHERE last_seen >= ?
    GROUP BY hour ORDER BY cnt DESC LIMIT 1
  `).get(since) as { hour: number; cnt: number } | undefined

  return { totalEvents: total, militaryEvents: military, uniqueTypes, busiestHour: busiestRow?.hour ?? null }
}

export function getTopTypes(limit = 15): { typeCode: string; count: number }[] {
  const db = getDb()
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000
  return (db.prepare(`
    SELECT type_code as typeCode, COUNT(*) as count
    FROM overhead_events WHERE last_seen >= ? AND type_code IS NOT NULL
    GROUP BY type_code ORDER BY count DESC LIMIT ?
  `).all(since, limit) as { typeCode: string; count: number }[])
}

export function getHourlyActivity(): { hour: number; count: number }[] {
  const db = getDb()
  const since = Date.now() - 24 * 60 * 60 * 1000
  const rows = db.prepare(`
    SELECT CAST(strftime('%H', datetime(first_seen/1000, 'unixepoch', 'localtime')) AS INTEGER) AS hour,
           COUNT(*) AS count
    FROM overhead_events WHERE last_seen >= ?
    GROUP BY hour ORDER BY hour
  `).all(since) as { hour: number; count: number }[]

  // Fill all 24 hours
  const byHour = new Map(rows.map((r) => [r.hour, r.count]))
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, count: byHour.get(h) ?? 0 }))
}

// ── Daily digest ──────────────────────────────────────────────────────────────

export interface DailyDigest {
  todayCount: number
  militaryCount: number
  newFirstSightings: number
  topCallsign: string | null
}

export function getDailyDigest(): DailyDigest {
  const db = getDb()
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const dayStart = startOfDay.getTime()

  const todayCount = (db.prepare(`SELECT COUNT(*) as n FROM overhead_events WHERE last_seen >= ?`).get(dayStart) as { n: number }).n
  const militaryCount = (db.prepare(`SELECT COUNT(*) as n FROM overhead_events WHERE last_seen >= ? AND mil_label IN ('likely_military','maybe_military')`).get(dayStart) as { n: number }).n
  const newFirstSightings = (db.prepare(`SELECT COUNT(*) as n FROM overhead_events WHERE first_seen >= ?`).get(dayStart) as { n: number }).n
  const topRow = db.prepare(`
    SELECT callsign FROM overhead_events
    WHERE last_seen >= ? AND callsign IS NOT NULL
    ORDER BY snapshot_count DESC LIMIT 1
  `).get(dayStart) as { callsign: string } | undefined

  return { todayCount, militaryCount, newFirstSightings, topCallsign: topRow?.callsign ?? null }
}

// ── FAA registrations ─────────────────────────────────────────────────────────

export interface FaaRegistration {
  registration: string
  owner: string | null
  aircraftMfr: string | null
  aircraftModel: string | null
  state: string | null
}

export function getFaaRegistration(registration: string): FaaRegistration | null {
  const db = getDb()
  const reg = registration.replace(/^N/, '').toUpperCase()
  const row = db.prepare(`
    SELECT registration, owner, aircraft_mfr, aircraft_model, state
    FROM faa_registrations WHERE registration = ?
  `).get('N' + reg) as Record<string, string | null> | undefined

  if (!row) return null
  return {
    registration: row.registration as string,
    owner: row.owner,
    aircraftMfr: row.aircraft_mfr,
    aircraftModel: row.aircraft_model,
    state: row.state,
  }
}

// ── Pruning ───────────────────────────────────────────────────────────────────

export function pruneOldData(maxAgeDays: number): void {
  const db = getDb()
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
  db.prepare(`DELETE FROM aircraft_snapshots WHERE fetched_at < ?`).run(cutoff)
  db.prepare(`DELETE FROM overhead_events WHERE last_seen < ?`).run(cutoff)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToEvent(row: Record<string, unknown>): OverheadEvent {
  return {
    id: row.id as number,
    hex: row.hex as string,
    callsign: (row.callsign as string | null) ?? null,
    typeCode: (row.type_code as string | null) ?? null,
    typeDescription: (row.type_desc as string | null) ?? null,
    firstSeen: row.first_seen as number,
    lastSeen: row.last_seen as number,
    closestDistanceNm: (row.closest_nm as number | null) ?? null,
    maxAltitudeFt: (row.max_altitude_ft as number | null) ?? null,
    militaryScore: row.mil_score as number,
    militaryLabel: row.mil_label as MilitaryLabel,
    snapshotCount: row.snapshot_count as number,
  }
}
