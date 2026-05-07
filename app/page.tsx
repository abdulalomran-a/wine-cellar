'use client'

import { useEffect, useState, useMemo } from 'react'
import { Wine } from '@/lib/supabase'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

const COLORS = ['#7c3aed', '#a855f7', '#c084fc', '#e879f9', '#f0abfc', '#ddd6fe']

type Filters = {
  vintage: string
  region: string
  varietal: string
  country: string
  qtySort: string
}

const EMPTY_FILTERS: Filters = { vintage: '', region: '', varietal: '', country: '', qtySort: '' }

export default function Dashboard() {
  const [wines, setWines] = useState<Wine[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)

  useEffect(() => {
    fetch('/api/wines')
      .then(r => r.json())
      .then(data => { setWines(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function setFilter(key: keyof Filters, value: string) {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const activeCount = Object.values(filters).filter(v => v !== '').length

  // Build option lists from full wine list
  const vintages = useMemo(() => [...new Set(wines.map(w => w.vintage).filter(Boolean))].sort((a, b) => (b ?? 0) - (a ?? 0)), [wines])
  const regions = useMemo(() => [...new Set(wines.map(w => w.region).filter(Boolean))].sort(), [wines])
  const varietals = useMemo(() => [...new Set(wines.map(w => w.varietal).filter(Boolean))].sort(), [wines])
  const countries = useMemo(() => [...new Set(wines.map(w => w.country).filter(Boolean))].sort(), [wines])

  const filtered = useMemo(() => {
    const list = wines.filter(w => {
      if (filters.vintage && w.vintage !== parseInt(filters.vintage)) return false
      if (filters.region && w.region !== filters.region) return false
      if (filters.varietal && w.varietal !== filters.varietal) return false
      if (filters.country && w.country !== filters.country) return false
      return true
    })
    if (filters.qtySort === 'desc') list.sort((a, b) => b.quantity - a.quantity)
    if (filters.qtySort === 'asc') list.sort((a, b) => a.quantity - b.quantity)
    return list
  }, [wines, filters])

  // Stats derived from filtered wines
  const totalBottles = filtered.reduce((sum, w) => sum + w.quantity, 0)
  const uniqueWineries = new Set(filtered.map(w => w.winery).filter(Boolean)).size
  const ratedWines = filtered.filter(w => w.rating)
  const avgRating = ratedWines.length
    ? (ratedWines.reduce((s, w) => s + (w.rating ?? 0), 0) / ratedWines.length).toFixed(1)
    : '—'

  const locationMap: Record<string, number> = {}
  filtered.forEach(w => { locationMap[w.location] = (locationMap[w.location] ?? 0) + w.quantity })
  const locationData = Object.entries(locationMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  const vintageMap: Record<string, number> = {}
  filtered.forEach(w => { if (w.vintage) { vintageMap[String(w.vintage)] = (vintageMap[String(w.vintage)] ?? 0) + w.quantity } })
  const vintageData = Object.entries(vintageMap).sort((a, b) => Number(a[0]) - Number(b[0])).map(([name, value]) => ({ name, value }))

  const regionMap: Record<string, number> = {}
  filtered.forEach(w => { if (w.region) { regionMap[w.region] = (regionMap[w.region] ?? 0) + w.quantity } })
  const regionData = Object.entries(regionMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8)

  const countryMap: Record<string, number> = {}
  filtered.forEach(w => { if (w.country) { countryMap[w.country] = (countryMap[w.country] ?? 0) + w.quantity } })
  const countryData = Object.entries(countryMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading your cellar...</div>

  if (wines.length === 0) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Your cellar is empty</h2>
        <p className="text-gray-500 mb-6">Start by scanning a barcode or adding a wine manually.</p>
        <Link href="/add" className="inline-flex px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-medium">
          Add your first wine
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            {activeCount > 0
              ? `${filtered.length} of ${wines.length} wines · ${totalBottles} bottles`
              : 'Your wine collection at a glance'}
          </p>
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          className={`relative px-3 py-2 rounded-lg text-sm border transition-colors ${
            activeCount > 0
              ? 'bg-purple-600 text-white border-purple-600'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Filter
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Filter wines</span>
            {activeCount > 0 && (
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="text-xs text-purple-600 hover:underline"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Vintage</label>
              <select value={filters.vintage} onChange={e => setFilter('vintage', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-purple-500">
                <option value="">All vintages</option>
                {vintages.map(v => <option key={v} value={v!}>{v}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Country</label>
              <select value={filters.country} onChange={e => setFilter('country', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-purple-500">
                <option value="">All countries</option>
                {countries.map(c => <option key={c} value={c!}>{c}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Region</label>
              <select value={filters.region} onChange={e => setFilter('region', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-purple-500">
                <option value="">All regions</option>
                {regions.map(r => <option key={r} value={r!}>{r}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Grape Varietal</label>
              <select value={filters.varietal} onChange={e => setFilter('varietal', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-purple-500">
                <option value="">All varietals</option>
                {varietals.map(v => <option key={v} value={v!}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Sort by Quantity</label>
            <select value={filters.qtySort} onChange={e => setFilter('qtySort', e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-purple-500">
              <option value="">No sort</option>
              <option value="desc">Most bottles first</option>
              <option value="asc">Fewest bottles first</option>
            </select>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Bottles" value={totalBottles} />
        <StatCard label="Unique Wines" value={filtered.length} />
        <StatCard label="Wineries" value={uniqueWineries} />
        <StatCard label="Avg Rating" value={avgRating} />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>No wines match your filters.</p>
          <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-purple-600 text-sm mt-2 hover:underline">
            Clear filters
          </button>
        </div>
      ) : (
        <>
          {locationData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-800 mb-3">Bottles by Location</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={locationData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {vintageData.length > 0 && (
              <PieCard title="By Vintage Year" data={vintageData} />
            )}
            {regionData.length > 0 && (
              <PieCard title="By Region" data={regionData} />
            )}
            {countryData.length > 0 && (
              <PieCard title="By Country" data={countryData} />
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-800 mb-3">
              {activeCount > 0 ? 'Matching Wines' : 'Recent Additions'}
            </h3>
            <div className="space-y-2">
              {(activeCount > 0 ? filtered : wines).slice(0, 5).map(w => (
                <div key={w.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-gray-800">{w.name}</span>
                    {w.vintage && <span className="text-gray-400 ml-1">{w.vintage}</span>}
                    {w.varietal && <span className="text-gray-400 ml-1">· {w.varietal}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{w.quantity} btl</span>
                    <span>{w.location}</span>
                  </div>
                </div>
              ))}
            </div>
            {(activeCount > 0 ? filtered : wines).length > 5 && (
              <Link href="/cellar" className="text-purple-600 text-sm mt-3 block hover:underline">
                View all {(activeCount > 0 ? filtered : wines).length} wines →
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-1">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  )
}

function PieCard({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-800 mb-1">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={72}
            innerRadius={28}
            label={({ percent }: { percent?: number }) =>
              percent != null && percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : ''
            }
            labelLine={false}
            fontSize={11}
          >
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v, n) => [`${v} bottles`, n]} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value: string) =>
              value.length > 18 ? value.slice(0, 16) + '…' : value
            }
            wrapperStyle={{ fontSize: 11 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
