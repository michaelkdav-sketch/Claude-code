const R_NM = 3440.065

export function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const dphi = ((lat2 - lat1) * Math.PI) / 180
  const dlam = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dphi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlam / 2) ** 2
  return 2 * R_NM * Math.asin(Math.sqrt(a))
}

export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const dlam = ((lon2 - lon1) * Math.PI) / 180
  const x = Math.sin(dlam) * Math.cos(phi2)
  const y = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dlam)
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']

export function compassPoint(deg: number): string {
  return COMPASS[Math.round(deg / 22.5) % 16]
}

export function milesToNm(miles: number): number {
  return miles * 0.868976
}
