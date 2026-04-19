import type { AircraftProvider, AircraftFeed, RawAircraft } from './types'

const BASE_URL = 'https://api.adsb.lol/v2'

interface AdsbLolAircraft {
  hex: string
  type?: string
  flight?: string
  r?: string
  t?: string
  desc?: string
  alt_baro?: number | 'ground'
  alt_geom?: number
  gs?: number
  ias?: number
  track?: number
  true_heading?: number
  baro_rate?: number
  squawk?: string
  emergency?: string
  category?: string
  lat?: number
  lon?: number
  seen?: number
  seen_pos?: number
  messages?: number
  rssi?: number
  dst?: number
  dir?: number
  mil?: number
  [key: string]: unknown
}

interface AdsbLolResponse {
  ac: AdsbLolAircraft[]
  total?: number
  now?: number
  msg?: string
}

function normalize(raw: AdsbLolAircraft, fetchedAt: number): RawAircraft {
  const altRaw = raw.alt_baro
  const onGround = altRaw === 'ground'
  const altitudeFt = onGround ? null : typeof altRaw === 'number' ? altRaw : null

  return {
    hex: raw.hex.toLowerCase(),
    callsign: raw.flight ? raw.flight.trim() || null : null,
    typeCode: raw.t ?? null,
    typeDescription: raw.desc ?? null,
    registration: raw.r ?? null,
    altitudeFt,
    onGround,
    groundSpeedKt: typeof raw.gs === 'number' ? Math.round(raw.gs) : null,
    trackDeg: typeof raw.track === 'number' ? raw.track : null,
    headingDeg: typeof raw.true_heading === 'number' ? raw.true_heading : null,
    lat: typeof raw.lat === 'number' ? raw.lat : null,
    lon: typeof raw.lon === 'number' ? raw.lon : null,
    squawk: raw.squawk ?? null,
    emergency: raw.emergency && raw.emergency !== 'none' ? raw.emergency : null,
    category: raw.category ?? null,
    distanceNm: typeof raw.dst === 'number' ? raw.dst : null,
    bearingDeg: typeof raw.dir === 'number' ? raw.dir : null,
    seenSecsAgo: typeof raw.seen === 'number' ? raw.seen : 0,
    seenPosSecsAgo: typeof raw.seen_pos === 'number' ? raw.seen_pos : null,
    isMilitary: raw.mil === 1,
    rawPayload: raw as Record<string, unknown>,
    fetchedAt,
  }
}

export class AdsbLolProvider implements AircraftProvider {
  readonly name = 'adsb.lol'

  async fetchNearby(lat: number, lon: number, radiusNm: number): Promise<AircraftFeed> {
    const url = `${BASE_URL}/lat/${lat}/lon/${lon}/dist/${Math.ceil(radiusNm)}`
    const fetchedAt = Date.now()

    const res = await fetch(url, {
      headers: { 'User-Agent': 'aircraft-tracker/0.1 personal-use' },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      throw new Error(`adsb.lol returned ${res.status}: ${res.statusText}`)
    }

    const data: AdsbLolResponse = await res.json()
    const aircraft = (data.ac ?? []).map((ac) => normalize(ac, fetchedAt))

    return {
      aircraft,
      fetchedAt,
      source: this.name,
      totalCount: aircraft.length,
    }
  }

  async fetchByHex(hex: string): Promise<RawAircraft | null> {
    const fetchedAt = Date.now()
    const res = await fetch(`${BASE_URL}/icao/${hex.toLowerCase()}`, {
      headers: { 'User-Agent': 'aircraft-tracker/0.1 personal-use' },
      next: { revalidate: 0 },
    })

    if (!res.ok) return null

    const data: AdsbLolResponse = await res.json()
    if (!data.ac?.[0]) return null
    return normalize(data.ac[0], fetchedAt)
  }
}
