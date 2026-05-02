import type { Aircraft } from './providers/types'

const FORMATION_RADIUS_NM = 2
const FORMATION_ALT_DIFF_FT = 2000
const FORMATION_HDG_DIFF_DEG = 30
const FORMATION_MIN_SIZE = 3
const R = 3440.065 // Earth radius in nm

function distNm(a: Aircraft, b: Aircraft): number {
  if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) return Infinity
  const phi1 = (a.lat * Math.PI) / 180
  const phi2 = (b.lat * Math.PI) / 180
  const dphi = ((b.lat - a.lat) * Math.PI) / 180
  const dlam = ((b.lon - a.lon) * Math.PI) / 180
  const s = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlam / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

function hdgDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

export function detectFormations(aircraft: Aircraft[]): Set<string> {
  // Only consider airborne aircraft with position
  const candidates = aircraft.filter(
    (ac) => !ac.onGround && ac.lat != null && ac.lon != null,
  )

  // Build adjacency: for each pair, are they within FORMATION_RADIUS_NM?
  const proximate = new Map<string, Set<string>>()
  for (const ac of candidates) {
    proximate.set(ac.hex, new Set())
  }

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i]
      const b = candidates[j]
      if (distNm(a, b) <= FORMATION_RADIUS_NM) {
        proximate.get(a.hex)!.add(b.hex)
        proximate.get(b.hex)!.add(a.hex)
      }
    }
  }

  // Union-Find to cluster connected aircraft
  const parent = new Map<string, string>()
  for (const ac of candidates) parent.set(ac.hex, ac.hex)

  function find(x: string): string {
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!))
    return parent.get(x)!
  }
  function union(x: string, y: string) {
    parent.set(find(x), find(y))
  }

  for (const [hex, neighbors] of Array.from(proximate.entries())) {
    for (const nbr of Array.from(neighbors)) union(hex, nbr)
  }

  // Group clusters
  const clusters = new Map<string, Aircraft[]>()
  for (const ac of candidates) {
    const root = find(ac.hex)
    if (!clusters.has(root)) clusters.set(root, [])
    clusters.get(root)!.push(ac)
  }

  const formationHexes = new Set<string>()

  for (const group of Array.from(clusters.values())) {
    if (group.length < FORMATION_MIN_SIZE) continue

    // Check altitude cohesion
    const alts = group.map((a) => a.altitudeFt).filter((v): v is number => v != null)
    if (alts.length < FORMATION_MIN_SIZE) continue
    const altSpread = Math.max(...alts) - Math.min(...alts)
    if (altSpread > FORMATION_ALT_DIFF_FT) continue

    // Check heading cohesion
    const hdgs = group.map((a) => a.trackDeg).filter((v): v is number => v != null)
    if (hdgs.length < FORMATION_MIN_SIZE) continue
    const baseHdg = hdgs[0]
    const maxHdgDiff = Math.max(...hdgs.map((h) => hdgDiff(h, baseHdg)))
    if (maxHdgDiff > FORMATION_HDG_DIFF_DEG) continue

    for (const ac of group) formationHexes.add(ac.hex)
  }

  return formationHexes
}
