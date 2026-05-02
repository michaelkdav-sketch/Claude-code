import { NextResponse } from 'next/server'
import { getFaaRegistration } from '@/lib/db/queries'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: { registration: string } },
) {
  try {
    const reg = decodeURIComponent(params.registration)
    const result = getFaaRegistration(reg)
    if (!result) return NextResponse.json({ owner: null, state: null })
    return NextResponse.json({
      owner: result.owner,
      aircraftMfr: result.aircraftMfr,
      aircraftModel: result.aircraftModel,
      state: result.state,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
