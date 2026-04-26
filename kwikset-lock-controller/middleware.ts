import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Kwikset Lock Controller"' },
    })
  }

  const base64Credentials = authHeader.slice(6)
  const credentials = atob(base64Credentials)
  const colonIndex = credentials.indexOf(':')
  const username = credentials.slice(0, colonIndex)
  const password = credentials.slice(colonIndex + 1)

  const validUsername = process.env.AUTH_USERNAME
  const validPassword = process.env.AUTH_PASSWORD

  if (!validUsername || !validPassword || username !== validUsername || password !== validPassword) {
    return new NextResponse('Invalid credentials', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Kwikset Lock Controller"' },
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
