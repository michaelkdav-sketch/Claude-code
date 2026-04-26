import { NextResponse } from 'next/server'
import { getVacuumStatus } from '@/lib/homeAssistant'

export async function GET() {
  const entityId = process.env.ROBOROCK_ENTITY_ID
  if (!entityId) {
    return NextResponse.json({ error: 'ROBOROCK_ENTITY_ID is not configured' }, { status: 500 })
  }
  try {
    return NextResponse.json(await getVacuumStatus(entityId))
  } catch (err) {
    console.error('GET /api/roborock/status:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to get vacuum status' },
      { status: 500 }
    )
  }
}
