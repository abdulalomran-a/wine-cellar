'use client'

import { Wine } from '@/lib/supabase'
import { MapPin, Star, Trash2, Edit2, Wine as WineIcon } from 'lucide-react'
import Image from 'next/image'

interface Props {
  wine: Wine
  onDelete: (id: string) => void
  onEdit: (wine: Wine) => void
}

export default function WineCard({ wine, onDelete, onEdit }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow overflow-hidden flex">
      <div className="w-20 flex-shrink-0 bg-gradient-to-b from-purple-50 to-purple-100 flex items-center justify-center">
        {wine.image_url ? (
          <Image src={wine.image_url} alt={wine.name} width={80} height={120} className="object-contain h-full" />
        ) : (
          <WineIcon className="w-8 h-8 text-purple-300" />
        )}
      </div>

      <div className="flex-1 p-4 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{wine.name}</h3>
            {wine.winery && <p className="text-sm text-gray-500 truncate">{wine.winery}</p>}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={() => onEdit(wine)}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(wine.id)}
              className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {wine.vintage && (
            <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              {wine.vintage}
            </span>
          )}
          {wine.varietal && (
            <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
              {wine.varietal}
            </span>
          )}
          {wine.region && (
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {wine.region}
            </span>
          )}
        </div>

        <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {wine.location}
          </span>
          <span className="bg-gray-100 px-2 py-0.5 rounded-full">Qty: {wine.quantity}</span>
          {wine.rating && (
            <span className="flex items-center gap-0.5 text-amber-500">
              {Array.from({ length: wine.rating }).map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-current" />
              ))}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
