import { NextResponse } from 'next/server'
import { getStatus, getConfig } from '@/lib/poller'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ status: getStatus(), config: getConfig() })
}
