import { AdsbLolProvider } from './providers/adsb-lol'
import { Dump1090Provider } from './providers/dump1090'
import { classify } from './military'
import { detectFormations } from './formation'
import { milesToNm } from './geo'
import { insertSnapshot, upsertOverheadEvent, setPollState, pruneOldData } from './db/queries'
import type { Aircraft, AircraftProvider, AppStatus } from './providers/types'

function selectProvider(): AircraftProvider {
  if (process.env.PROVIDER === 'dump1090') return new Dump1090Provider()
  return new AdsbLolProvider()
}

const provider = selectProvider()

const HOME_LAT = parseFloat(process.env.HOME_LAT ?? '32.7280')
const HOME_LON = parseFloat(process.env.HOME_LON ?? '-117.2385')
const HOME_RADIUS_MILES = parseFloat(process.env.HOME_RADIUS_MILES ?? '25')
const POLL_INTERVAL_MS = Math.max(5, parseInt(process.env.POLL_INTERVAL_SECS ?? '10')) * 1000
const HISTORY_DAYS = parseInt(process.env.HISTORY_DAYS ?? '7')

const RADIUS_NM = milesToNm(HOME_RADIUS_MILES)

// Module-level cache shared across requests in the same Node.js process
let _cache: Aircraft[] = []
let _lastFetchAt = 0
let _lastError: string | null = null
let _pruneTimer = 0

export function getConfig() {
  return { lat: HOME_LAT, lon: HOME_LON, radiusNm: RADIUS_NM, radiusMiles: HOME_RADIUS_MILES }
}

export function getCachedAircraft(): Aircraft[] {
  return _cache
}

export function getStatus(): AppStatus {
  return {
    lastFetchAt: _lastFetchAt || null,
    lastFetchSuccess: _lastError === null,
    source: provider.name,
    aircraftCount: _cache.length,
    error: _lastError,
  }
}

export async function pollNow(): Promise<Aircraft[]> {
  const now = Date.now()

  // Enforce minimum interval
  if (now - _lastFetchAt < POLL_INTERVAL_MS) {
    return _cache
  }

  try {
    const feed = await provider.fetchNearby(HOME_LAT, HOME_LON, RADIUS_NM)

    const aircraft: Aircraft[] = feed.aircraft.map((raw) => ({
      hex: raw.hex,
      callsign: raw.callsign,
      typeCode: raw.typeCode,
      typeDescription: raw.typeDescription,
      registration: raw.registration,
      altitudeFt: raw.altitudeFt,
      onGround: raw.onGround,
      groundSpeedKt: raw.groundSpeedKt,
      trackDeg: raw.trackDeg,
      lat: raw.lat,
      lon: raw.lon,
      squawk: raw.squawk,
      category: raw.category,
      distanceNm: raw.distanceNm,
      bearingDeg: raw.bearingDeg,
      seenSecsAgo: raw.seenSecsAgo,
      military: classify(raw),
      fetchedAt: raw.fetchedAt,
      source: feed.source,
    }))

    // Detect formation flying
    const formationHexes = detectFormations(aircraft)
    for (const ac of aircraft) {
      ac.inFormation = formationHexes.has(ac.hex)
    }

    // Persist to DB (async-ish via sync SQLite — fast enough for personal use)
    for (const ac of aircraft) {
      insertSnapshot(ac)
      upsertOverheadEvent(ac)
    }

    // Prune old data every ~hour
    if (now - _pruneTimer > 60 * 60 * 1000) {
      pruneOldData(HISTORY_DAYS)
      _pruneTimer = now
    }

    setPollState(now, null)
    _cache = aircraft
    _lastFetchAt = now
    _lastError = null

    return aircraft
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    _lastError = msg
    setPollState(now, msg)
    // Return stale cache on error
    return _cache
  }
}
