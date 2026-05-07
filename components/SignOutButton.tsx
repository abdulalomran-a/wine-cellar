'use client'

import { useRouter } from 'next/navigation'

export default function SignOutButton({ className }: { className?: string }) {
  const router = useRouter()

  async function signOut() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
  }

  return (
    <button onClick={signOut} className={className}>
      Sign out
    </button>
  )
}
