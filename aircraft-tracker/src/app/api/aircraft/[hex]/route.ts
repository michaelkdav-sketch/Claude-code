import { NextResponse } from 'next/server'
import { AdsbLolProvider } from '@/lib/providers/adsb-lol'
import { classify } from '@/lib/military'
import { getSnapshotsByHex } from '@/lib/db/queries'
import type { Aircraft } from '@/lib/providers/types'

export const dynamic = 'force-dynamic'

const provider = new AdsbLolProvider()

export async function GET(_req: Request, { params }: { params: { hex: string } }) {
  const { hex } = params

  try {
    const raw = await provider.fetchByHex(hex)

    let aircraft: Aircraft | null = null
    if (raw) {
      aircraft = {
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
        source: provider.name,
      }
    }

    const track = getSnapshotsByHex(hex, 120).map((row) => ({
      lat: row.lat,
      lon: row.lon,
      altitudeFt: row.altitude_ft,
      fetchedAt: row.fetched_at,
    })).filter((p) => p.lat != null && p.lon != null)

    const rawPayload = raw?.rawPayload ?? null

    return NextResponse.json({ aircraft, track, rawPayload })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
