import { NextResponse } from 'next/server'
import { getRecentEvents } from '@/lib/db/queries'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500)
  const since = searchParams.get('since') ? parseInt(searchParams.get('since')!) : undefined

  try {
    const events = getRecentEvents(limit, since)
    return NextResponse.json({ events })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
