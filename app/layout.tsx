import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import { LayoutDashboard, Wine, PlusCircle } from 'lucide-react'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Wine Cellar',
  description: 'Track and manage your wine collection',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-purple-700 text-lg">
              <Wine className="w-5 h-5" />
              Wine Cellar
            </Link>
            <nav className="flex items-center gap-1">
              <Link href="/" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </Link>
              <Link href="/cellar" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
                <Wine className="w-4 h-4" /> Cellar
              </Link>
              <Link href="/add" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-purple-600 text-white hover:bg-purple-700">
                <PlusCircle className="w-4 h-4" /> Add Wine
              </Link>
            </nav>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  )
}
