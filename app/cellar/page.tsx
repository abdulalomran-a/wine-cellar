'use client'

import { useEffect, useState } from 'react'
import { Wine } from '@/lib/supabase'
import WineCard from '@/components/WineCard'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function CellarPage() {
  const router = useRouter()
  const [wines, setWines] = useState<Wine[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'vintage' | 'added'>('added')

  useEffect(() => {
    fetch('/api/wines')
      .then(r => r.json())
      .then(data => { setWines(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleDelete(id: string) {
    if (!confirm('Remove this wine from your cellar?')) return
    await fetch(`/api/wines/${id}`, { method: 'DELETE' })
    setWines(prev => prev.filter(w => w.id !== id))
  }

  function handleEdit(wine: Wine) {
    router.push(`/add?id=${wine.id}`)
  }

  const locations = [...new Set(wines.map(w => w.location))].sort()

  const filtered = wines
    .filter(w => {
      const q = search.toLowerCase()
      return (
        (!q || w.name.toLowerCase().includes(q) || w.winery?.toLowerCase().includes(q) || w.varietal?.toLowerCase().includes(q)) &&
        (!locationFilter || w.location === locationFilter)
      )
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'vintage') return (b.vintage ?? 0) - (a.vintage ?? 0)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Cellar</h1>
          <p className="text-gray-500 text-sm mt-1">{wines.length} wines · {wines.reduce((s, w) => s + w.quantity, 0)} bottles</p>
        </div>
        <Link href="/add" className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
          Add Wine
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search wines, wineries, varietals..."
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        />
        <div className="flex gap-2">
          <select
            value={locationFilter}
            onChange={e => setLocationFilter(e.target.value)}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All locations</option>
            {locations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-purple-500"
          >
            <option value="added">Recently Added</option>
            <option value="name">Name A–Z</option>
            <option value="vintage">Vintage</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {wines.length === 0
            ? <p>No wines yet. <Link href="/add" className="text-purple-600 hover:underline">Add your first.</Link></p>
            : <p>No wines match your search.</p>
          }
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(w => (
            <WineCard key={w.id} wine={w} onDelete={handleDelete} onEdit={handleEdit} />
          ))}
        </div>
      )}
    </div>
  )
}
