import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import SignOutButton from '@/components/SignOutButton'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Cellar',
  description: 'Track and manage your wine collection',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Cellar',
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#7c3aed',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        {/* Desktop header — hidden on mobile */}
        <header className="hidden sm:block bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="font-bold text-purple-700 text-lg tracking-tight">
              Cellar
            </Link>
            <nav className="flex items-center gap-1">
              <Link href="/" className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
                Dashboard
              </Link>
              <Link href="/cellar" className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
                Cellar
              </Link>
              <Link href="/add" className="px-3 py-1.5 rounded-lg text-sm bg-purple-600 text-white hover:bg-purple-700">
                Add
              </Link>
              <SignOutButton className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100" />
            </nav>
          </div>
        </header>

        {/* Mobile header */}
        <header className="sm:hidden bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="px-4 h-12 flex items-center justify-between">
            <span className="font-bold text-purple-700 text-base tracking-tight">Cellar</span>
            <SignOutButton className="text-xs text-gray-400 hover:text-gray-600" />
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-4 sm:py-6 pb-24 sm:pb-6">
          {children}
        </main>

        {/* Mobile bottom navigation */}
        <BottomNav />
      </body>
    </html>
  )
}
