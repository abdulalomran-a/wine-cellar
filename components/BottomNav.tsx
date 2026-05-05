'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const path = usePathname()

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom">
      <div className="grid grid-cols-3 h-16">
        <NavItem href="/" label="Dashboard" active={path === '/'} />
        <NavItem href="/add" label="Scan / Add" active={path === '/add'} primary />
        <NavItem href="/cellar" label="Cellar" active={path === '/cellar'} />
      </div>
    </nav>
  )
}

function NavItem({ href, label, active, primary }: { href: string; label: string; active: boolean; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
        primary
          ? active
            ? 'bg-purple-600 text-white'
            : 'bg-purple-600 text-white'
          : active
            ? 'text-purple-700'
            : 'text-gray-500'
      }`}
    >
      {label}
    </Link>
  )
}
