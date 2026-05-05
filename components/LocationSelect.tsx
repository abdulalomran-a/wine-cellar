'use client'

import { useState, useEffect } from 'react'

interface Props {
  value: string
  onChange: (val: string) => void
}

export default function LocationSelect({ value, onChange }: Props) {
  const [locations, setLocations] = useState<string[]>([])
  const [showCustom, setShowCustom] = useState(false)
  const [customValue, setCustomValue] = useState('')

  useEffect(() => {
    fetch('/api/locations')
      .then(r => r.json())
      .then(data => setLocations(data.map((l: { name: string }) => l.name)))
      .catch(() => {})
  }, [])

  async function addLocation() {
    const name = customValue.trim()
    if (!name) return
    try {
      await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      setLocations(prev => [...prev, name].sort())
      onChange(name)
      setCustomValue('')
      setShowCustom(false)
    } catch {}
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Location *</label>

      <select
        value={value}
        onChange={e => {
          if (e.target.value === '__custom__') {
            setShowCustom(true)
          } else {
            onChange(e.target.value)
            setShowCustom(false)
          }
        }}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        required
      >
        <option value="">Select a location...</option>
        {locations.map(loc => (
          <option key={loc} value={loc}>{loc}</option>
        ))}
        <option value="__custom__">Add new location...</option>
      </select>

      {showCustom && (
        <div className="flex gap-2">
          <input
            type="text"
            value={customValue}
            onChange={e => setCustomValue(e.target.value)}
            placeholder="New location name"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
            onKeyDown={e => e.key === 'Enter' && addLocation()}
            autoFocus
          />
          <button
            type="button"
            onClick={addLocation}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}
