import { NextRequest, NextResponse } from 'next/server'
import { getSeamClient } from '@/lib/seam'

export async function GET() {
  try {
    const seam = getSeamClient()
    const deviceId = process.env.SEAM_DEVICE_ID

    const lock = deviceId
      ? await seam.locks.get({ device_id: deviceId })
      : (await seam.locks.list())[0]

    if (!lock) {
      return NextResponse.json({ error: 'No locks found in workspace' }, { status: 404 })
    }

    return NextResponse.json({ lock })
  } catch (err) {
    console.error('GET /api/lock:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch lock status' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, deviceId } = await req.json()
    const seam = getSeamClient()
    const device_id: string = deviceId ?? process.env.SEAM_DEVICE_ID ?? ''

    if (!device_id) {
      return NextResponse.json({ error: 'device_id is required' }, { status: 400 })
    }

    if (action === 'lock') {
      await seam.locks.lockDoor({ device_id })
    } else if (action === 'unlock') {
      await seam.locks.unlockDoor({ device_id })
    } else {
      return NextResponse.json({ error: 'action must be "lock" or "unlock"' }, { status: 400 })
    }

    // Brief wait for Seam to propagate the state change
    await new Promise((r) => setTimeout(r, 1200))
    const lock = await seam.locks.get({ device_id })
    return NextResponse.json({ lock })
  } catch (err) {
    console.error('POST /api/lock:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to control lock' },
      { status: 500 }
    )
  }
}
