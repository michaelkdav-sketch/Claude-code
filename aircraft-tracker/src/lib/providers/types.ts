export interface RawAircraft {
  hex: string
  callsign: string | null
  typeCode: string | null
  typeDescription: string | null
  registration: string | null
  altitudeFt: number | null
  onGround: boolean
  groundSpeedKt: number | null
  trackDeg: number | null
  headingDeg: number | null
  lat: number | null
  lon: number | null
  squawk: string | null
  emergency: string | null
  category: string | null
  distanceNm: number | null
  bearingDeg: number | null
  seenSecsAgo: number
  seenPosSecsAgo: number | null
  isMilitary: boolean
  rawPayload: Record<string, unknown>
  fetchedAt: number
}

export interface AircraftFeed {
  aircraft: RawAircraft[]
  fetchedAt: number
  source: string
  totalCount: number
}

export interface AircraftProvider {
  readonly name: string
  fetchNearby(lat: number, lon: number, radiusNm: number): Promise<AircraftFeed>
  fetchByHex?(hex: string): Promise<RawAircraft | null>
}

export type MilitaryLabel =
  | 'likely_military'
  | 'maybe_military'
  | 'likely_civilian'
  | 'unknown'

export interface MilitaryClassification {
  score: number
  label: MilitaryLabel
  confidence: number
  reasons: string[]
}

export interface Aircraft {
  hex: string
  callsign: string | null
  typeCode: string | null
  typeDescription: string | null
  registration: string | null
  altitudeFt: number | null
  onGround: boolean
  groundSpeedKt: number | null
  trackDeg: number | null
  lat: number | null
  lon: number | null
  squawk: string | null
  category: string | null
  distanceNm: number | null
  bearingDeg: number | null
  seenSecsAgo: number
  military: MilitaryClassification
  fetchedAt: number
  source: string
}

export interface OverheadEvent {
  id: number
  hex: string
  callsign: string | null
  typeCode: string | null
  typeDescription: string | null
  firstSeen: number
  lastSeen: number
  closestDistanceNm: number | null
  maxAltitudeFt: number | null
  militaryScore: number
  militaryLabel: MilitaryLabel
  snapshotCount: number
}

export interface AppStatus {
  lastFetchAt: number | null
  lastFetchSuccess: boolean
  source: string
  aircraftCount: number
  error: string | null
}
