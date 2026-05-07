'use client'

import { useState, Suspense, useRef, useEffect } from 'react'
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
  const editId = params.get('id')
  const [form, setForm] = useState<WineForm>({ ...EMPTY, barcode: params.get('barcode') ?? '' })
  const [showScanner, setShowScanner] = useState(false)
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'found' | 'notfound'>('idle')
  const [labelState, setLabelState] = useState<'idle' | 'loading' | 'found' | 'error'>('idle')
  const [labelPreview, setLabelPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imgError, setImgError] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(!!editId)
  const labelInputRef = useRef<HTMLInputElement>(null)

  // Load existing wine data when editing
  useEffect(() => {
    if (!editId) return
    fetch(`/api/wines/${editId}`)
      .then(r => r.json())
      .then(w => {
        setForm({
          name: w.name ?? '',
          winery: w.winery ?? '',
          vintage: w.vintage?.toString() ?? '',
          varietal: w.varietal ?? '',
          region: w.region ?? '',
          country: w.country ?? '',
          location: w.location ?? '',
          quantity: w.quantity?.toString() ?? '1',
          purchase_price: w.purchase_price?.toString() ?? '',
          purchase_date: w.purchase_date ?? '',
          notes: w.notes ?? '',
          barcode: w.barcode ?? '',
          image_url: w.image_url ?? '',
          rating: w.rating ?? 0,
        })
      })
      .finally(() => setLoadingEdit(false))
  }, [editId])

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

  async function handleLabelPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLabelState('loading')
    setLabelPreview(null)

    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      setLabelPreview(dataUrl)

      // Compress the photo and store it directly as the bottle image
      const compressed = await compressImage(dataUrl)
      setForm(prev => ({ ...prev, image_url: compressed }))
      setImgError(false)

      const base64 = dataUrl.split(',')[1]
      const mediaType = file.type || 'image/jpeg'

      try {
        const res = await fetch('/api/scan-label', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, mediaType }),
        })
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
            // Keep the user's own label photo — don't overwrite with search result
          }))
          setLabelState('found')
        } else {
          setLabelState('error')
        }
      } catch {
        setLabelState('error')
      }
    }
    reader.readAsDataURL(file)
  }

  function compressImage(dataUrl: string): Promise<string> {
    return new Promise(resolve => {
      const img = new Image()
      img.onload = () => {
        const MAX_W = 300, MAX_H = 420
        const ratio = Math.min(MAX_W / img.width, MAX_H / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * ratio)
        canvas.height = Math.round(img.height * ratio)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.72))
      }
      img.src = dataUrl
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.location) return
    setSaving(true)
    setError(null)
    try {
      // Check for existing wine with same name + vintage (skip when editing)
      const existing = editId ? [] : await fetch('/api/wines').then(r => r.json()) as Array<{id: string; name: string; vintage: number | null; quantity: number; winery: string | null}>
      if (Array.isArray(existing)) {
        const match = existing.find(w =>
          w.name.toLowerCase() === form.name.trim().toLowerCase() &&
          (form.vintage ? w.vintage === parseInt(form.vintage) : w.vintage === null) &&
          (form.winery ? w.winery?.toLowerCase() === form.winery.trim().toLowerCase() : true)
        )
        if (match) {
          const confirmed = confirm(
            `"${match.name}${form.vintage ? ` ${form.vintage}` : ''}" is already in your cellar (${match.quantity} bottle${match.quantity !== 1 ? 's' : ''}).\n\nAdd 1 more bottle to the existing entry?`
          )
          if (confirmed) {
            await fetch(`/api/wines/${match.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ quantity: match.quantity + 1 }),
            })
            router.push('/cellar')
            return
          }
          // User chose to create a new separate entry — fall through
        }
      }

      const payload = {
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
      }

      const res = await fetch(editId ? `/api/wines/${editId}` : '/api/wines', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to save')
      router.push('/cellar')
    } catch {
      setError('Failed to save wine. Please try again.')
      setSaving(false)
    }
  }

  if (loadingEdit) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{editId ? 'Edit Wine' : 'Add Wine'}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {editId ? 'Update the details below' : 'Scan the label or barcode to auto-fill, or enter manually'}
        </p>
      </div>

      {/* Label photo scan (Vivino-style) */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h2 className="font-semibold text-gray-800">Scan Label</h2>
        <p className="text-xs text-gray-500">Point your camera at the wine label and Claude will identify the wine</p>

        <input
          ref={labelInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleLabelPhoto}
        />

        <button
          type="button"
          onClick={() => labelInputRef.current?.click()}
          disabled={labelState === 'loading'}
          className="w-full py-3 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
        >
          {labelState === 'loading' ? 'Reading label...' : 'Take Photo or Upload'}
        </button>

        {labelState === 'found' && (
          <p className="text-sm text-green-700">Label recognised — details filled in below.</p>
        )}
        {labelState === 'error' && (
          <p className="text-sm text-amber-700">Could not read label — please fill in details manually.</p>
        )}

        {labelPreview && (
          <div className="flex justify-center pt-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={labelPreview} alt="Label photo" className="max-h-48 object-contain rounded-lg border border-gray-100 shadow-sm" />
          </div>
        )}
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
            {saving ? 'Saving...' : editId ? 'Update Wine' : 'Save Wine'}
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
