import { NextRequest, NextResponse } from 'next/server'
import { makeToken } from '@/lib/auth'

const COOKIE = 'wine_session'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days

function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  })
}

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  const correct = process.env.APP_PASSWORD

  if (!correct || password !== correct) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  }

  const secret = process.env.SESSION_SECRET ?? ''
  const token = await makeToken(secret)

  const res = NextResponse.json({ ok: true })
  setSessionCookie(res, token)
  return res
}

/**
 * Magic-link login. GET /api/auth?p=PASSWORD redirects to "/" with the
 * session cookie set. Useful when the form is broken (e.g. iOS PWA
 * serving stale JS), so you can save the link as a bookmark/home-screen
 * shortcut and tap to log in instantly.
 */
export async function GET(req: NextRequest) {
  const password = req.nextUrl.searchParams.get('p')
  const correct = process.env.APP_PASSWORD
  const next = req.nextUrl.searchParams.get('next') || '/'

  if (!correct || password !== correct) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.delete('p')
    url.searchParams.set('error', '1')
    return NextResponse.redirect(url)
  }

  const secret = process.env.SESSION_SECRET ?? ''
  const token = await makeToken(secret)

  const url = req.nextUrl.clone()
  url.pathname = next
  url.search = ''
  const res = NextResponse.redirect(url)
  setSessionCookie(res, token)
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(COOKIE)
  return res
}
