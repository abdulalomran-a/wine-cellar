'use client'

import { useEffect, useState } from 'react'
import { Wine } from '@/lib/supabase'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

const COLORS = ['#7c3aed', '#a855f7', '#c084fc', '#e879f9', '#f0abfc', '#ddd6fe']

export default function Dashboard() {
  const [wines, setWines] = useState<Wine[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/wines')
      .then(r => r.json())
      .then(data => { setWines(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const totalBottles = wines.reduce((sum, w) => sum + w.quantity, 0)
  const uniqueWineries = new Set(wines.map(w => w.winery).filter(Boolean)).size
  const ratedWines = wines.filter(w => w.rating)
  const avgRating = ratedWines.length
    ? (ratedWines.reduce((s, w) => s + (w.rating ?? 0), 0) / ratedWines.length).toFixed(1)
    : '—'

  const locationMap: Record<string, number> = {}
  wines.forEach(w => { locationMap[w.location] = (locationMap[w.location] ?? 0) + w.quantity })
  const locationData = Object.entries(locationMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  const varietalMap: Record<string, number> = {}
  wines.forEach(w => { const v = w.varietal ?? 'Unknown'; varietalMap[v] = (varietalMap[v] ?? 0) + w.quantity })
  const varietalData = Object.entries(varietalMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6)

  const vintageMap: Record<string, number> = {}
  wines.forEach(w => { if (w.vintage) { const d = `${Math.floor(w.vintage / 10) * 10}s`; vintageMap[d] = (vintageMap[d] ?? 0) + w.quantity } })
  const vintageData = Object.entries(vintageMap).sort((a, b) => a[0].localeCompare(b[0])).map(([name, value]) => ({ name, value }))

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Your wine collection at a glance</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Bottles" value={totalBottles} />
        <StatCard label="Unique Wines" value={wines.length} />
        <StatCard label="Wineries" value={uniqueWineries} />
        <StatCard label="Avg Rating" value={avgRating} />
      </div>

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
        {varietalData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-800 mb-3">By Varietal</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={varietalData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                  label={({ percent }: { percent?: number }) => percent != null ? `${(percent * 100).toFixed(0)}%` : ''} labelLine={false} fontSize={11}>
                  {varietalData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {vintageData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-800 mb-3">By Decade</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={vintageData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Recent Additions</h3>
        <div className="space-y-2">
          {wines.slice(0, 5).map(w => (
            <div key={w.id} className="flex items-center justify-between text-sm">
              <div>
                <span className="font-medium text-gray-800">{w.name}</span>
                {w.vintage && <span className="text-gray-400 ml-1">{w.vintage}</span>}
              </div>
              <span className="text-gray-500 text-xs">{w.location}</span>
            </div>
          ))}
        </div>
        {wines.length > 5 && (
          <Link href="/cellar" className="text-purple-600 text-sm mt-3 block hover:underline">
            View all {wines.length} wines →
          </Link>
        )}
      </div>
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
