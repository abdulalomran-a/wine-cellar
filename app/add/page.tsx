'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import LocationSelect from '@/components/LocationSelect'

const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner'), { ssr: false })

type WineForm = {
  name: string
  winery: string
  vintage: string
  varietal: string
  region: string
  country: string
  location: string
  quantity: string
  purchase_price: string
  purchase_date: string
  notes: string
  barcode: string
  image_url: string
  rating: number
}

const EMPTY: WineForm = {
  name: '', winery: '', vintage: '', varietal: '', region: '',
  country: '', location: '', quantity: '1', purchase_price: '',
  purchase_date: '', notes: '', barcode: '', image_url: '', rating: 0,
}

function AddWineForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [form, setForm] = useState<WineForm>({ ...EMPTY, barcode: params.get('barcode') ?? '' })
  const [showScanner, setShowScanner] = useState(false)
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'found' | 'notfound'>('idle')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imgError, setImgError] = useState(false)

  function set(field: keyof WineForm, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function lookup(barcode: string) {
    if (!barcode.trim()) return
    setLookupState('loading')
    setImgError(false)
    try {
      const res = await fetch(`/api/lookup?barcode=${encodeURIComponent(barcode)}`)
      const data = await res.json()
      if (data.found) {
        setForm(prev => ({
          ...prev,
          name: data.name || prev.name,
          winery: data.winery || prev.winery,
          vintage: data.vintage?.toString() || prev.vintage,
          varietal: data.varietal || prev.varietal,
          region: data.region || prev.region,
          country: data.country || prev.country,
          image_url: data.image_url || prev.image_url,
        }))
        setLookupState('found')
      } else {
        setLookupState('notfound')
      }
    } catch {
      setLookupState('notfound')
    }
  }

  async function handleBarcode(barcode: string) {
    setShowScanner(false)
    set('barcode', barcode)
    await lookup(barcode)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.location) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/wines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          winery: form.winery || null,
          vintage: form.vintage ? parseInt(form.vintage) : null,
          varietal: form.varietal || null,
          region: form.region || null,
          country: form.country || null,
          location: form.location,
          quantity: parseInt(form.quantity) || 1,
          purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
          purchase_date: form.purchase_date || null,
          notes: form.notes || null,
          barcode: form.barcode || null,
          image_url: form.image_url || null,
          rating: form.rating || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      router.push('/cellar')
    } catch {
      setError('Failed to save wine. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Add Wine</h1>
        <p className="text-gray-500 text-sm mt-1">Scan a barcode to auto-fill details, or enter manually</p>
      </div>

      {/* Barcode scanner */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h2 className="font-semibold text-gray-800">Barcode</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={form.barcode}
            onChange={e => set('barcode', e.target.value)}
            placeholder="Enter or scan barcode..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
          <button
            type="button"
            onClick={() => lookup(form.barcode)}
            disabled={!form.barcode || lookupState === 'loading'}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Lookup
          </button>
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
          >
            Scan
          </button>
        </div>

        {lookupState === 'loading' && (
          <p className="text-sm text-gray-500">Looking up bottle online...</p>
        )}
        {lookupState === 'found' && (
          <p className="text-sm text-green-700">Bottle found — details and photo filled in below.</p>
        )}
        {lookupState === 'notfound' && (
          <p className="text-sm text-amber-700">Not found in database — fill in details below.</p>
        )}

        {/* Bottle photo preview */}
        {form.image_url && !imgError && (
          <div className="flex justify-center pt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={form.image_url}
              alt="Bottle label"
              className="max-h-64 object-contain rounded-lg border border-gray-100 shadow-sm"
              onError={() => setImgError(true)}
            />
          </div>
        )}
      </div>

      {/* Wine details form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <h2 className="font-semibold text-gray-800">Wine Details</h2>

        <Field label="Wine Name *">
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="e.g. Chateau Margaux" required className="input" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Winery / Producer">
            <input type="text" value={form.winery} onChange={e => set('winery', e.target.value)}
              placeholder="Producer name" className="input" />
          </Field>
          <Field label="Vintage Year">
            <input type="number" value={form.vintage} onChange={e => set('vintage', e.target.value)}
              placeholder="e.g. 2019" min={1900} max={new Date().getFullYear()} className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Grape Varietal">
            <input type="text" value={form.varietal} onChange={e => set('varietal', e.target.value)}
              placeholder="e.g. Cabernet Sauvignon" className="input" />
          </Field>
          <Field label="Region">
            <input type="text" value={form.region} onChange={e => set('region', e.target.value)}
              placeholder="e.g. Bordeaux" className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Country">
            <input type="text" value={form.country} onChange={e => set('country', e.target.value)}
              placeholder="e.g. France" className="input" />
          </Field>
          <Field label="Quantity">
            <input type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)}
              min={1} className="input" />
          </Field>
        </div>

        <LocationSelect value={form.location} onChange={v => set('location', v)} />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Purchase Price (EUR)">
            <input type="number" value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)}
              placeholder="0.00" step="0.01" min={0} className="input" />
          </Field>
          <Field label="Purchase Date">
            <input type="date" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)}
              className="input" />
          </Field>
        </div>

        <Field label="Rating (1–5)">
          <div className="flex gap-2 pt-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => set('rating', form.rating === n ? 0 : n)}
                className={`w-9 h-9 rounded-lg border text-sm font-medium transition-colors ${
                  n <= form.rating
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'border-gray-200 text-gray-400 hover:border-amber-300'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Notes">
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Tasting notes, occasion, food pairing..."
            rows={3} className="input resize-none" />
        </Field>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !form.name.trim() || !form.location}
            className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Wine'}
          </button>
        </div>
      </form>

      {showScanner && (
        <BarcodeScanner onDetected={handleBarcode} onClose={() => setShowScanner(false)} />
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}

export default function AddPage() {
  return (
    <Suspense>
      <AddWineForm />
    </Suspense>
  )
}
