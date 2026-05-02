import type { AircraftProvider, AircraftFeed, RawAircraft } from './types'

const BASE_URL = process.env.DUMP1090_URL ?? 'http://localhost:8080'
const R = 3440.065

interface Dump1090Aircraft {
  hex: string
  flight?: string
  r?: string
  t?: string
  alt_baro?: number | 'ground'
  alt_geom?: number
  gs?: number
  track?: number
  true_heading?: number
  squawk?: string
  category?: string
  lat?: number
  lon?: number
  seen?: number
  seen_pos?: number
  messages?: number
  [key: string]: unknown
}

interface Dump1090Response {
  now: number
  messages: number
  aircraft: Dump1090Aircraft[]
}

function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const dphi = ((lat2 - lat1) * Math.PI) / 180
  const dlam = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlam / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const dlam = ((lon2 - lon1) * Math.PI) / 180
  const y = Math.sin(dlam) * Math.cos(phi2)
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dlam)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function normalize(raw: Dump1090Aircraft, homeLat: number, homeLon: number, fetchedAt: number): RawAircraft {
  const altRaw = raw.alt_baro
  const onGround = altRaw === 'ground'
  const altitudeFt = onGround ? null : typeof altRaw === 'number' ? altRaw : null

  const lat = typeof raw.lat === 'number' ? raw.lat : null
  const lon = typeof raw.lon === 'number' ? raw.lon : null

  const distanceNm = lat != null && lon != null ? haversineNm(homeLat, homeLon, lat, lon) : null
  const bearing = lat != null && lon != null ? bearingDeg(homeLat, homeLon, lat, lon) : null

  return {
    hex: raw.hex.toLowerCase(),
    callsign: raw.flight ? raw.flight.trim() || null : null,
    typeCode: raw.t ?? null,
    typeDescription: null,
    registration: raw.r ?? null,
    altitudeFt,
    onGround,
    groundSpeedKt: typeof raw.gs === 'number' ? Math.round(raw.gs) : null,
    trackDeg: typeof raw.track === 'number' ? raw.track : null,
    headingDeg: typeof raw.true_heading === 'number' ? raw.true_heading : null,
    lat,
    lon,
    squawk: raw.squawk ?? null,
    emergency: null,
    category: raw.category ?? null,
    distanceNm,
    bearingDeg: bearing,
    seenSecsAgo: typeof raw.seen === 'number' ? raw.seen : 0,
    seenPosSecsAgo: typeof raw.seen_pos === 'number' ? raw.seen_pos : null,
    isMilitary: false,
    rawPayload: raw as Record<string, unknown>,
    fetchedAt,
  }
}

export class Dump1090Provider implements AircraftProvider {
  readonly name = 'dump1090-local'

  async fetchNearby(lat: number, lon: number, radiusNm: number): Promise<AircraftFeed> {
    const fetchedAt = Date.now()
    const res = await fetch(`${BASE_URL}/data/aircraft.json`, {
      signal: AbortSignal.timeout(5_000),
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      throw new Error(`dump1090 returned ${res.status}: ${res.statusText}`)
    }

    const data: Dump1090Response = await res.json()
    const all = (data.aircraft ?? []).map((ac) => normalize(ac, lat, lon, fetchedAt))
    const nearby = all.filter(
      (ac) => ac.distanceNm == null || ac.distanceNm <= radiusNm,
    )

    return {
      aircraft: nearby,
      fetchedAt,
      source: this.name,
      totalCount: nearby.length,
    }
  }

  async fetchByHex(hex: string): Promise<RawAircraft | null> {
    const feed = await this.fetchNearby(0, 0, Infinity)
    return feed.aircraft.find((ac) => ac.hex === hex.toLowerCase()) ?? null
  }
}
