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
  const [sortBy, setSortBy] = useState<'name' | 'vintage' | 'added' | 'winery'>('added')
  const [backfilling, setBackfilling] = useState(false)
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null)

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

  function handleQuantityChange(id: string, quantity: number) {
    setWines(prev => prev.map(w => w.id === id ? { ...w, quantity } : w))
  }

  async function handleBackfill() {
    setBackfilling(true)
    setBackfillMsg(null)
    try {
      const res = await fetch('/api/backfill-images', { method: 'POST' })
      const { updated, total } = await res.json()
      if (total === 0) {
        setBackfillMsg('All wines already have photos.')
      } else if (updated === 0) {
        setBackfillMsg(`Searched ${total} wines — no photos found online.`)
      } else {
        setBackfillMsg(`Found photos for ${updated} of ${total} wines. Refreshing...`)
        // Reload wines to show new images
        const data = await fetch('/api/wines').then(r => r.json())
        setWines(Array.isArray(data) ? data : [])
      }
    } catch {
      setBackfillMsg('Something went wrong. Please try again.')
    } finally {
      setBackfilling(false)
    }
  }

  const locations = [...new Set(wines.map(w => w.location))].sort()
  const totalBottles = wines.reduce((s, w) => s + w.quantity, 0)

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
      if (sortBy === 'winery') {
        const cmp = (a.winery ?? a.name).localeCompare(b.winery ?? b.name)
        return cmp !== 0 ? cmp : (a.vintage ?? 0) - (b.vintage ?? 0)
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  // Group by winery when that sort is selected
  const grouped: { label: string; wines: Wine[] }[] = []
  if (sortBy === 'winery') {
    filtered.forEach(w => {
      const key = w.winery || w.name
      const existing = grouped.find(g => g.label === key)
      if (existing) existing.wines.push(w)
      else grouped.push({ label: key, wines: [w] })
    })
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Cellar</h1>
          <p className="text-gray-500 text-sm mt-1">{wines.length} wines · {totalBottles} bottles</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleBackfill}
            disabled={backfilling}
            className="px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {backfilling ? 'Searching...' : 'Find Photos'}
          </button>
          <Link href="/add" className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
            Add Wine
          </Link>
        </div>
      </div>

      {backfillMsg && (
        <div className="bg-blue-50 border border-blue-100 text-blue-700 text-sm rounded-xl px-4 py-3">
          {backfillMsg}
        </div>
      )}

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
            <option value="winery">Group by Winery</option>
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
      ) : sortBy === 'winery' ? (
        // Grouped view
        <div className="space-y-4">
          {grouped.map(group => (
            <div key={group.label}>
              <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="font-semibold text-gray-700 text-sm">{group.label}</h2>
                <span className="text-xs text-gray-400">
                  {group.wines.reduce((s, w) => s + w.quantity, 0)} bottles · {group.wines.length} vintage{group.wines.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-2">
                {group.wines.map(w => (
                  <WineCard key={w.id} wine={w} onDelete={handleDelete} onEdit={handleEdit} onQuantityChange={handleQuantityChange} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Flat list
        <div className="space-y-2">
          {filtered.map(w => (
            <WineCard key={w.id} wine={w} onDelete={handleDelete} onEdit={handleEdit} onQuantityChange={handleQuantityChange} />
          ))}
        </div>
      )}
    </div>
  )
}
