import { NextResponse } from 'next/server'
import { pollNow, getConfig } from '@/lib/poller'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const aircraft = await pollNow()
    const config = getConfig()
    return NextResponse.json({ aircraft, config, fetchedAt: Date.now() })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
