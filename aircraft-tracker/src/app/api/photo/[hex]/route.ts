import { NextResponse } from 'next/server'

interface PlanespottersPhoto {
  thumbnail_large?: { src: string }
  thumbnail?: { src: string }
  link?: string
  photographer?: string
}

interface PlanespottersResponse {
  photos?: PlanespottersPhoto[]
}

export async function GET(
  _req: Request,
  { params }: { params: { hex: string } },
) {
  const hex = params.hex.toLowerCase()

  try {
    const res = await fetch(
      `https://api.planespotters.net/pub/photos/hex/${hex}`,
      {
        headers: { 'User-Agent': 'aircraft-tracker/0.1 personal-use' },
        signal: AbortSignal.timeout(8_000),
        next: { revalidate: 3600 },
      },
    )

    if (!res.ok) {
      return NextResponse.json({ photo: null }, { status: 200 })
    }

    const data: PlanespottersResponse = await res.json()
    const first = data.photos?.[0]

    if (!first) {
      return NextResponse.json({ photo: null }, { status: 200 })
    }

    const src = first.thumbnail_large?.src ?? first.thumbnail?.src ?? null
    return NextResponse.json(
      { photo: src ? { src, link: first.link, photographer: first.photographer } : null },
      {
        status: 200,
        headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
      },
    )
  } catch {
    return NextResponse.json({ photo: null }, { status: 200 })
  }
}
