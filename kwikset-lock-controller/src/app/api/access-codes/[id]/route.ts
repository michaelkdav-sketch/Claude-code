import { NextRequest, NextResponse } from 'next/server'
import { getSeamClient } from '@/lib/seam'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const seam = getSeamClient()
    await seam.accessCodes.delete({ access_code_id: params.id })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/access-codes/[id]:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete access code' },
      { status: 500 }
    )
  }
}
