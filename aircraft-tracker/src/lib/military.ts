import type { RawAircraft, MilitaryClassification, MilitaryLabel } from './providers/types'
import { WATCHLIST_ENTRIES } from './watchlist'

// Military bases near San Diego (lat, lon, name)
const MILITARY_BASES = [
  { lat: 32.6993, lon: -117.1960, name: 'NAS North Island', radiusNm: 5 },
  { lat: 32.8674, lon: -117.1425, name: 'MCAS Miramar', radiusNm: 6 },
  { lat: 32.6762, lon: -117.2352, name: 'Naval Base Point Loma', radiusNm: 4 },
  { lat: 32.5553, lon: -117.0485, name: 'Naval Air Facility El Centro', radiusNm: 5 },
  { lat: 33.1773, lon: -117.3559, name: 'Camp Pendleton', radiusNm: 8 },
]

// ICAO type codes associated with military operations
const MILITARY_TYPES = new Set([
  'E2', 'E2C', 'E2D',           // Hawkeye AEW
  'E3', 'E3B', 'E3C',           // AWACS
  'E6', 'E6B',                  // TACAMO/Mercury
  'E8', 'E8C',                  // JSTARS
  'P8', 'P8A',                  // Poseidon
  'P3', 'P3C', 'P3B',           // Orion
  'F18', 'F/A18', 'FA18', 'F18F', 'F18E', // Super Hornet
  'F35', 'F35B', 'F35C',        // Lightning II
  'F16', 'F16C', 'F16D',        // Falcon
  'F15', 'F15E', 'F15C',        // Eagle
  'F22', 'F22A',                // Raptor
  'C17', 'C17A',                // Globemaster
  'C5', 'C5M',                  // Galaxy
  'C130', 'C130J', 'HC130', 'MC130', 'AC130', 'EC130',
  'C2', 'C2A',                  // Greyhound
  'C40', 'C40A', 'C40B', 'C40C',
  'B52', 'B52H',                // Stratofortress
  'B1', 'B1B',                  // Lancer
  'B2', 'B2A',                  // Spirit
  'V22', 'MV22', 'CV22', 'V22B',// Osprey
  'H60', 'MH60', 'SH60', 'UH60', 'HH60',
  'H53', 'CH53', 'MH53',        // Super Stallion
  'H46', 'CH46',                // Sea Knight
  'H1', 'UH1', 'AH1', 'HH1',
  'KC135', 'KC10', 'KC130', 'KC46',
  'U2', 'U2S',                  // Dragon Lady
  'RQ4', 'RQ4B',                // Global Hawk
  'MQ9', 'MQ1',                 // Predator/Reaper
  'EP3', 'RC135',               // ISR platforms
  'T45', 'T6', 'T38', 'T6A',   // Trainers
  'AV8', 'AV8B',                // Harrier
])

// Callsign prefixes strongly associated with US military
const MIL_CALLSIGN_PREFIXES = [
  'NAVY', 'ARMY', 'USAF', 'USMC', 'USCG',
  'RCH',   // Air Mobility Command
  'REACH', // AMC
  'EVAC',  // Medical evacuation
  'TOPGUN',
  'VENOM', 'HAWK', 'TIGER', 'FALCON', 'VIPER',
  'BEAR',  // P-3 Orion
  'BRONC', 'BRONCO',
  'JATO',
  'SABER', 'LANCER', 'RAPTOR', 'EAGLE',
  'MAGIC', // AWACS
  'DISCO', // EC-130
  'HEAVY', // heavy lift when combined with military indicators
  'GHOST', 'SHADOW',
  'BLADE', 'SWORD',
]

// Pattern: 2-3 uppercase letters + 2-4 digits (typical military tactical callsign)
const MIL_CALLSIGN_PATTERN = /^[A-Z]{2,4}\d{2,4}$/

// Known commercial airline ICAO prefixes (3-letter) — used to reduce false positives
// This is not exhaustive; it's a heuristic filter
const COMMERCIAL_PREFIXES = new Set([
  'AAL', 'UAL', 'DAL', 'SWA', 'ASA', 'JBU', 'SKW', 'FFT', 'NKS',
  'FDX', 'UPS', 'DHL', 'ABX', 'GTI', 'VRD', 'GJS', 'RPA', 'PDT',
  'BAW', 'AFR', 'DLH', 'KLM', 'IBE', 'ACA', 'QFA', 'SIA', 'CPA',
  'KAL', 'ANA', 'JAL', 'CSN', 'CCA', 'CHH', 'MXA', 'AMX',
  'VOI', 'ADO', 'WJA', 'TSC', 'TRS', 'EVA', 'CAL',
])

function distanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const dphi = ((lat2 - lat1) * Math.PI) / 180
  const dlam = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlam / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function labelFromScore(score: number): MilitaryLabel {
  if (score >= 70) return 'likely_military'
  if (score >= 50) return 'maybe_military'
  if (score >= 25) return 'unknown'
  return 'likely_civilian'
}

export function classify(ac: RawAircraft): MilitaryClassification {
  let score = 0
  const reasons: string[] = []

  // 1. Hard military flag from API data source (crowdsourced DB)
  if (ac.isMilitary) {
    score += 60
    reasons.push('Flagged as military in ADS-B database')
  }

  // 2. ICAO hex address in US military range (AE0000–AFFFFF)
  const hexNum = parseInt(ac.hex, 16)
  if (hexNum >= 0xae0000 && hexNum <= 0xafffff) {
    score += 40
    reasons.push(`ICAO address ${ac.hex.toUpperCase()} in US military range (AE0000–AFFFFF)`)
  }

  // 3. Callsign analysis
  if (ac.callsign) {
    const cs = ac.callsign.trim().toUpperCase()
    const prefix3 = cs.slice(0, 3)

    if (COMMERCIAL_PREFIXES.has(prefix3)) {
      // Strong civilian indicator — cap score and stop callsign analysis
      score = Math.max(0, score - 20)
      reasons.push(`Callsign prefix ${prefix3} matches commercial airline`)
    } else {
      const matchedPrefix = MIL_CALLSIGN_PREFIXES.find((p) => cs.startsWith(p))
      if (matchedPrefix) {
        score += 35
        reasons.push(`Callsign "${cs}" matches known military prefix "${matchedPrefix}"`)
      } else if (MIL_CALLSIGN_PATTERN.test(cs)) {
        score += 15
        reasons.push(`Callsign "${cs}" matches military tactical pattern (alpha + digits)`)
      }
    }
  } else if (!ac.isMilitary) {
    // No callsign is slightly more common in military ops
    score += 5
    reasons.push('No callsign transmitted')
  }

  // 4. Aircraft type
  if (ac.typeCode) {
    const t = ac.typeCode.toUpperCase().replace(/[-/ ]/g, '')
    if (MILITARY_TYPES.has(t)) {
      score += 25
      reasons.push(`Aircraft type ${ac.typeCode.toUpperCase()} is associated with military operations`)
    }
  }

  // 5. Operating near known military bases
  if (ac.lat != null && ac.lon != null) {
    for (const base of MILITARY_BASES) {
      const d = distanceNm(ac.lat, ac.lon, base.lat, base.lon)
      if (d <= base.radiusNm) {
        score += 10
        reasons.push(`Operating within ${d.toFixed(1)} nm of ${base.name}`)
        break // count only the closest base
      }
    }
  }

  // 6. Local watchlist — NAS North Island / MCAS Miramar known callsign prefixes
  if (ac.callsign) {
    const cs = ac.callsign.trim().toUpperCase()
    for (const entry of WATCHLIST_ENTRIES) {
      if (cs.startsWith(entry.prefix)) {
        score += entry.scoreBonus
        reasons.push(`Callsign matches local watchlist: ${entry.name}`)
        break
      }
    }
  }

  // 7. Squawk codes sometimes associated with military
  if (ac.squawk) {
    // 7777 = military interception
    if (ac.squawk === '7777') {
      score += 15
      reasons.push('Squawk 7777 (military intercept code)')
    }
  }

  // Cap score display at 100 for confidence calculation
  const label = labelFromScore(score)
  const confidence = Math.min(score / 100, 0.99)

  if (reasons.length === 0) {
    reasons.push('No military indicators detected')
  }

  return { score, label, confidence, reasons }
}
