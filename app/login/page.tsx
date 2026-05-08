'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(params.get('error') ? 'Wrong password. Try again.' : '')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function tryLogin() {
    if (!password.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
        credentials: 'same-origin',
      })
      if (res.ok) {
        const from = params.get('from') || '/'
        // Use window.location for a hard navigation — more reliable on iOS PWAs
        window.location.replace(from)
        return
      }
      setError('Wrong password. Try again.')
      setPassword('')
    } catch {
      setError('Network error. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    tryLogin()
  }

  // Magic-link URL for the bookmarkable fallback
  const magicLink = password.trim()
    ? `/api/auth?p=${encodeURIComponent(password.trim())}&next=${encodeURIComponent(params.get('from') || '/')}`
    : null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-purple-700 tracking-tight">Cellar</h1>
          <p className="text-gray-500 text-sm mt-2">Enter your password to continue</p>
        </div>

        <form
          onSubmit={onSubmit}
          // Native fallback: if JS doesn't run, the browser submits this form
          // as a normal GET to /api/auth which sets the cookie and redirects.
          action="/api/auth"
          method="get"
          className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 shadow-sm"
        >
          <input type="hidden" name="next" value={params.get('from') || '/'} />
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Password</label>
            <div className="relative">
              <input
                // Field name is "p" so the native fallback POSTs to /api/auth?p=...
                name="p"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                className="input pr-16"
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 px-2 py-1"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            onClick={() => tryLogin()}
            disabled={loading || !password.trim()}
            className="w-full py-3 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Checking…' : 'Unlock'}
          </button>

          {/* Magic-link fallback for when the JS form is broken */}
          {magicLink && (
            <a
              href={magicLink}
              className="block w-full text-center py-2 text-xs text-gray-400 hover:text-gray-600"
            >
              Trouble unlocking? Tap here →
            </a>
          )}
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
