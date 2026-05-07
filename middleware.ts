import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/auth']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow login page and auth API through without a session
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = req.cookies.get('wine_session')?.value
  const secret = process.env.SESSION_SECRET ?? ''

  if (token && await verifyToken(token, secret)) {
    return NextResponse.next()
  }

  // Not authenticated — redirect to login, preserving the destination
  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('from', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-.*\\.png|apple-touch-icon\\.png).*)'],
}

// --- helpers ---

async function verifyToken(token: string, secret: string): Promise<boolean> {
  try {
    const expected = await makeToken(secret)
    return token === expected
  } catch {
    return false
  }
}

export async function makeToken(secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('wine-cellar-auth'))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}
