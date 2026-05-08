'use client'

import { useEffect, useState, useMemo } from 'react'
import { Wine } from '@/lib/supabase'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from 'recharts'

// Neon palette: violet → fuchsia → cyan
const COLORS = ['#a78bfa', '#c084fc', '#e879f9', '#f0abfc', '#67e8f9', '#22d3ee', '#818cf8', '#d946ef']

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

  const totalBottles = filtered.reduce((sum, w) => sum + w.quantity, 0)
  const wineCount = filtered.filter(w => w.category !== 'spirit').reduce((s, w) => s + w.quantity, 0)
  const spiritCount = filtered.filter(w => w.category === 'spirit').reduce((s, w) => s + w.quantity, 0)
  const uniqueWineries = new Set(filtered.filter(w => w.category !== 'spirit').map(w => w.winery).filter(Boolean)).size
  const ratedWines = filtered.filter(w => w.rating)
  const avgRating = ratedWines.length
    ? (ratedWines.reduce((s, w) => s + (w.rating ?? 0), 0) / ratedWines.length).toFixed(1)
    : '—'

  // Spirit breakdown
  const spiritTypeMap: Record<string, number> = {}
  filtered.filter(w => w.category === 'spirit' && w.spirit_type).forEach(w => {
    spiritTypeMap[w.spirit_type!] = (spiritTypeMap[w.spirit_type!] ?? 0) + w.quantity
  })
  const spiritTypeData = Object.entries(spiritTypeMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

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

  if (loading) {
    return (
      <div className="cyber-bg min-h-[80vh] flex items-center justify-center">
        <div className="text-violet-200 text-sm tracking-widest uppercase animate-pulse">
          Loading cellar
        </div>
      </div>
    )
  }

  if (wines.length === 0) {
    return (
      <div className="cyber-bg p-10 text-center">
        <h2 className="text-2xl font-bold neon-text mb-3">Your cellar is empty</h2>
        <p className="text-violet-300/70 mb-6">Start by scanning a bottle or adding a wine manually.</p>
        <Link href="/add" className="cyber-btn inline-flex px-6 py-3 rounded-xl font-medium">
          Add your first wine
        </Link>
      </div>
    )
  }

  return (
    <div className="cyber-bg p-4 sm:p-6 -mx-4 sm:mx-0 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 fade-up">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-fuchsia-400 pulse-dot" />
            <span className="text-[11px] uppercase tracking-[0.2em] text-violet-300/70 font-medium">Live · Cellar</span>
          </div>
          <h1 className="text-3xl font-bold neon-text mt-1">Dashboard</h1>
          <p className="text-violet-200/60 text-sm mt-1">
            {activeCount > 0
              ? `${filtered.length} of ${wines.length} wines · ${totalBottles} bottles`
              : 'Your wine collection at a glance'}
          </p>
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          className={`relative px-4 py-2 rounded-xl text-sm transition-all ${
            activeCount > 0
              ? 'cyber-btn'
              : 'glass glass-hover text-violet-200'
          }`}
        >
          Filter
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-cyan-400 text-violet-950 text-[10px] font-bold rounded-full flex items-center justify-center shadow-[0_0_12px_rgba(34,211,238,0.7)]">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="glass p-4 space-y-3 fade-up">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-violet-300/80 font-semibold">Filter wines</span>
            {activeCount > 0 && (
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="text-xs text-cyan-300 hover:text-cyan-200"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <FilterSelect label="Vintage" value={filters.vintage} onChange={v => setFilter('vintage', v)}
              options={[{ value: '', label: 'All vintages' }, ...vintages.map(v => ({ value: String(v), label: String(v) }))]} />
            <FilterSelect label="Country" value={filters.country} onChange={v => setFilter('country', v)}
              options={[{ value: '', label: 'All countries' }, ...countries.map(c => ({ value: c!, label: c! }))]} />
            <FilterSelect label="Region" value={filters.region} onChange={v => setFilter('region', v)}
              options={[{ value: '', label: 'All regions' }, ...regions.map(r => ({ value: r!, label: r! }))]} />
            <FilterSelect label="Grape Varietal" value={filters.varietal} onChange={v => setFilter('varietal', v)}
              options={[{ value: '', label: 'All varietals' }, ...varietals.map(v => ({ value: v!, label: v! }))]} />
          </div>

          <FilterSelect label="Sort by Quantity" value={filters.qtySort} onChange={v => setFilter('qtySort', v)}
            options={[
              { value: '', label: 'No sort' },
              { value: 'desc', label: 'Most bottles first' },
              { value: 'asc', label: 'Fewest bottles first' },
            ]} />
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Bottles" value={totalBottles} accent="violet" delay={1} />
        <StatCard label="Wines" value={wineCount} accent="pink" delay={2} />
        <StatCard label="Spirits" value={spiritCount} accent="cyan" delay={3} />
        <StatCard label="Avg Rating" value={avgRating} accent="violet" delay={4} />
      </div>

      {filtered.length === 0 ? (
        <div className="glass p-10 text-center text-violet-300/70">
          <p>No wines match your filters.</p>
          <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-cyan-300 text-sm mt-2 hover:text-cyan-200">
            Clear filters
          </button>
        </div>
      ) : (
        <>
          {/* Bottles by location bar chart */}
          {locationData.length > 0 && (
            <div className="glass p-4 fade-up">
              <ChartHeader title="Bottles by Location" />
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={locationData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e879f9" stopOpacity={0.95} />
                      <stop offset="50%" stopColor="#a78bfa" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(167,139,250,0.12)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'rgba(167,139,250,0.08)' }} />
                  <Bar dataKey="value" fill="url(#bar-grad)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {spiritTypeData.length > 0 && <PieCard title="Spirits by Type" data={spiritTypeData} />}
            {vintageData.length > 0 && <PieCard title="Wines by Vintage" data={vintageData} />}
            {regionData.length > 0 && <PieCard title="By Region" data={regionData} />}
            {countryData.length > 0 && <PieCard title="By Country" data={countryData} />}
          </div>

          {/* Recent / matching wines */}
          <div className="glass p-4 fade-up">
            <ChartHeader title={activeCount > 0 ? 'Matching Wines' : 'Recent Additions'} />
            <div className="space-y-2">
              {(activeCount > 0 ? filtered : wines).slice(0, 5).map(w => (
                <div key={w.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg hover:bg-violet-500/5 transition-colors">
                  <div className="min-w-0">
                    <span className="font-medium text-violet-100">{w.name}</span>
                    {w.vintage && <span className="text-violet-400/70 ml-1.5">{w.vintage}</span>}
                    {w.varietal && <span className="text-violet-400/50 ml-1.5">· {w.varietal}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-violet-300/60 flex-shrink-0">
                    <span className="text-cyan-300/80 font-medium tabular-nums">{w.quantity}</span>
                    <span className="text-violet-300/50">{w.location}</span>
                  </div>
                </div>
              ))}
            </div>
            {(activeCount > 0 ? filtered : wines).length > 5 && (
              <Link href="/cellar" className="text-cyan-300 text-sm mt-3 inline-block hover:text-cyan-200">
                View all {(activeCount > 0 ? filtered : wines).length} wines →
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, accent, delay }: { label: string; value: string | number; accent: 'violet' | 'cyan' | 'pink'; delay: number }) {
  const accentClass = accent === 'cyan' ? 'neon-cyan' : accent === 'pink' ? 'neon-pink' : 'neon-violet'
  return (
    <div className={`glass glass-hover p-4 fade-up fade-up-${delay}`}>
      <div className="text-[10px] uppercase tracking-[0.18em] text-violet-300/60 font-semibold">{label}</div>
      <div className={`text-3xl font-bold mt-1 tabular-nums ${accentClass}`}>{value}</div>
    </div>
  )
}

function ChartHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-1 h-4 bg-gradient-to-b from-fuchsia-400 to-cyan-400 rounded-full" />
      <h3 className="text-sm font-semibold uppercase tracking-widest text-violet-200">{title}</h3>
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-wider text-violet-300/70 font-medium">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full text-sm bg-violet-950/40 border border-violet-400/20 text-violet-100 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-fuchsia-400/40 focus:border-fuchsia-400/60 outline-none"
      >
        {options.map(o => <option key={o.value} value={o.value} className="bg-violet-950">{o.label}</option>)}
      </select>
    </div>
  )
}

function PieCard({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  return (
    <div className="glass glass-hover p-4 fade-up">
      <ChartHeader title={title} />
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={72}
            innerRadius={32}
            paddingAngle={2}
            label={({ percent }: { percent?: number }) =>
              percent != null && percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
            }
            labelLine={false}
            fontSize={11}
            stroke="rgba(15,8,32,0.9)"
            strokeWidth={2}
          >
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v, n) => [`${v} bottles`, n]} />
          <Legend
            iconType="circle"
            iconSize={7}
            formatter={(value: string) =>
              value.length > 16 ? value.slice(0, 14) + '…' : value
            }
            wrapperStyle={{ fontSize: 11, color: 'rgba(196,181,253,0.85)' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
