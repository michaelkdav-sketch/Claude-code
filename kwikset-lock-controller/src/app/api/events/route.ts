import { NextRequest, NextResponse } from 'next/server'
import { getSeamClient } from '@/lib/seam'

export async function GET(req: NextRequest) {
  try {
    const seam = getSeamClient()
    const device_id = new URL(req.url).searchParams.get('deviceId') ?? process.env.SEAM_DEVICE_ID ?? ''

    if (!device_id) {
      return NextResponse.json({ error: 'device_id is required' }, { status: 400 })
    }

    const events = await seam.events.list({ device_id })
    return NextResponse.json({ events: events.slice(0, 25) })
  } catch (err) {
    console.error('GET /api/events:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch events' },
      { status: 500 }
    )
  }
}
