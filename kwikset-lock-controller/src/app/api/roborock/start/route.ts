import { NextResponse } from 'next/server'
import { vacuumAction } from '@/lib/homeAssistant'

export async function POST() {
  const entityId = process.env.ROBOROCK_ENTITY_ID
  if (!entityId) {
    return NextResponse.json({ error: 'ROBOROCK_ENTITY_ID is not configured' }, { status: 500 })
  }
  try {
    return NextResponse.json(await vacuumAction(entityId, 'start'))
  } catch (err) {
    console.error('POST /api/roborock/start:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start vacuum' },
      { status: 500 }
    )
  }
}
