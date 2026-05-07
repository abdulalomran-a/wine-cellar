'use client'

import { useState, useRef } from 'react'
import { Wine } from '@/lib/supabase'

interface Props {
  wine: Wine
  onDelete: (id: string) => void
  onEdit: (wine: Wine) => void
  onQuantityChange: (id: string, quantity: number) => void
}

export default function WineCard({ wine, onDelete, onEdit, onQuantityChange }: Props) {
  const [imgError, setImgError] = useState(false)
  const [qty, setQty] = useState(wine.quantity)
  const pendingQty = useRef(wine.quantity)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function changeQty(delta: number) {
    const next = Math.max(0, pendingQty.current + delta)
    pendingQty.current = next
    setQty(next)
    onQuantityChange(wine.id, next)

    // Debounce the API call — only fires 600ms after the last tap
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      fetch(`/api/wines/${wine.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: next }),
      }).catch(() => {})
    }, 600)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow overflow-hidden flex">
      {/* Bottle image */}
      <div className="w-24 flex-shrink-0 bg-gray-50 flex items-center justify-center border-r border-gray-100" style={{ minHeight: 120 }}>
        {wine.image_url && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={wine.image_url}
            alt={wine.name}
            className="w-full h-full object-cover"
            style={{ maxHeight: 140 }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs text-center p-2" style={{ minHeight: 120 }}>
            No photo
          </div>
        )}
      </div>

      <div className="flex-1 p-4 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{wine.name}</h3>
            {wine.winery && <p className="text-sm text-gray-500 truncate">{wine.winery}</p>}
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <button
              onClick={() => onEdit(wine)}
              className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(wine.id)}
              className="px-2.5 py-1 text-xs border border-red-100 rounded-lg hover:bg-red-50 text-red-500"
            >
              Remove
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {wine.vintage && (
            <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-medium">
              {wine.vintage}
            </span>
          )}
          {wine.varietal && (
            <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
              {wine.varietal}
            </span>
          )}
          {wine.region && (
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              {wine.region}
            </span>
          )}
          {wine.country && (
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              {wine.country}
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span>{wine.location}</span>
            {wine.rating && (
              <span className="text-amber-600 font-medium">{wine.rating}/5</span>
            )}
            {wine.purchase_price && (
              <span>{wine.purchase_price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
            )}
          </div>

          {/* Quantity controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => changeQty(-1)}
              disabled={qty <= 0}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 text-base font-medium leading-none"
            >
              −
            </button>
            <span className={`w-8 text-center text-sm font-semibold tabular-nums ${qty === 0 ? 'text-red-500' : 'text-gray-900'}`}>
              {qty}
            </span>
            <button
              onClick={() => changeQty(1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-base font-medium leading-none"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
