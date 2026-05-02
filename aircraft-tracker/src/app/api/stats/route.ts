import { NextResponse } from 'next/server'
import { getStatsSummary, getTopTypes, getHourlyActivity, getDailyDigest } from '@/lib/db/queries'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [summary, topTypes, hourlyActivity, digest] = await Promise.all([
      Promise.resolve(getStatsSummary()),
      Promise.resolve(getTopTypes(20)),
      Promise.resolve(getHourlyActivity()),
      Promise.resolve(getDailyDigest()),
    ])

    return NextResponse.json({ summary, topTypes, hourlyActivity, digest })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
