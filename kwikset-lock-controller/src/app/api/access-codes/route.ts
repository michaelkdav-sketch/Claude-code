import { NextRequest, NextResponse } from 'next/server'
import { getSeamClient } from '@/lib/seam'

export async function GET(req: NextRequest) {
  try {
    const seam = getSeamClient()
    const device_id = new URL(req.url).searchParams.get('deviceId') ?? process.env.SEAM_DEVICE_ID ?? ''

    if (!device_id) {
      return NextResponse.json({ error: 'device_id is required' }, { status: 400 })
    }

    const accessCodes = await seam.accessCodes.list({ device_id })
    return NextResponse.json({ accessCodes })
  } catch (err) {
    console.error('GET /api/access-codes:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch access codes' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const { deviceId, name, code, startsAt, endsAt } = await req.json()
    const seam = getSeamClient()
    const device_id: string = deviceId ?? process.env.SEAM_DEVICE_ID ?? ''

    if (!device_id) {
      return NextResponse.json({ error: 'device_id is required' }, { status: 400 })
    }
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: Record<string, any> = { device_id, name }
    if (code) params.code = code
    if (startsAt) params.starts_at = startsAt
    if (endsAt) params.ends_at = endsAt

    const accessCode = await seam.accessCodes.create(params)
    return NextResponse.json({ accessCode })
  } catch (err) {
    console.error('POST /api/access-codes:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create access code' },
      { status: 500 }
    )
  }
}
