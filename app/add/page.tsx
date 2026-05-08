'use client'

import { useState, Suspense, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import LocationSelect from '@/components/LocationSelect'
import { SPIRIT_TYPES } from '@/lib/supabase'

const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner'), { ssr: false })

type WineForm = {
  category: 'wine' | 'spirit'
  spirit_type: string
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
  vivino_url: string
  vivino_rating: string
  vivino_price: string
}

const EMPTY: WineForm = {
  category: 'wine', spirit_type: '',
  name: '', winery: '', vintage: '', varietal: '', region: '',
  country: '', location: '', quantity: '1', purchase_price: '',
  purchase_date: '', notes: '', barcode: '', image_url: '', rating: 0,
  vivino_url: '', vivino_rating: '', vivino_price: '',
}

function AddWineForm() {
  const router = useRouter()
  const params = useSearchParams()
  const editId = params.get('id')
  const [form, setForm] = useState<WineForm>({ ...EMPTY, barcode: params.get('barcode') ?? '' })
  const [showScanner, setShowScanner] = useState(false)
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'found' | 'notfound'>('idle')
  const [labelState, setLabelState] = useState<'idle' | 'loading' | 'found' | 'error'>('idle')
  const [vivinoState, setVivinoState] = useState<'idle' | 'loading' | 'found' | 'notfound'>('idle')
  const [vivinoUrlState, setVivinoUrlState] = useState<'idle' | 'loading' | 'found' | 'error'>('idle')
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
          category: w.category ?? 'wine',
          spirit_type: w.spirit_type ?? '',
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
          vivino_url: w.vivino_url ?? '',
          vivino_rating: w.vivino_rating?.toString() ?? '',
          vivino_price: w.vivino_price?.toString() ?? '',
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
          // Auto-switch to spirit if the lookup detected one — but don't downgrade
          // if the user explicitly chose Spirit and we got back wine (let them keep their choice)
          category: data.category === 'spirit' ? 'spirit' : prev.category,
          spirit_type: data.spirit_type || prev.spirit_type,
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

  /**
   * Decode a barcode from an uploaded photo using html5-qrcode's scanFile.
   * This avoids the live-camera path which fails on iOS PWAs with
   * "this page couldn't load".
   */
  const barcodePhotoRef = useRef<HTMLInputElement>(null)
  const [barcodeBusy, setBarcodeBusy] = useState(false)
  const [barcodePhotoError, setBarcodePhotoError] = useState<string | null>(null)

  async function handleBarcodePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBarcodeBusy(true)
    setBarcodePhotoError(null)

    // Reset input so same file can be re-selected later
    const resetInput = () => { if (barcodePhotoRef.current) barcodePhotoRef.current.value = '' }

    // Strategy 1: client-side scanFile (fast, free, but flaky on phone photos)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const tmp = new Html5Qrcode('hidden-barcode-reader')
      const result = await tmp.scanFile(file, false)
      resetInput()
      await handleBarcode(result)
      setBarcodeBusy(false)
      return
    } catch {
      // fall through to Claude vision
    }

    // Strategy 2: Claude vision reads the printed digits under the bars
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const base64 = dataUrl.split(',')[1]
      const mediaType = file.type || 'image/jpeg'

      const res = await fetch('/api/read-barcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType }),
      })
      const data = await res.json()
      resetInput()
      if (data.found && data.barcode) {
        await handleBarcode(data.barcode)
      } else {
        setBarcodePhotoError("Could not read the barcode digits. Try a sharper, closer photo — or type the numbers manually below.")
      }
    } catch (err) {
      console.error(err)
      resetInput()
      setBarcodePhotoError("Could not read the barcode. Try a sharper photo or type it manually.")
    } finally {
      setBarcodeBusy(false)
    }
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
          const scannedName = data.name || ''
          const scannedWinery = data.winery || ''
          const scannedVintage = data.vintage?.toString() || ''

          setForm(prev => ({
            ...prev,
            name: scannedName || prev.name,
            winery: scannedWinery || prev.winery,
            vintage: scannedVintage || prev.vintage,
            varietal: data.varietal || prev.varietal,
            region: data.region || prev.region,
            country: data.country || prev.country,
            // Keep the user's own label photo — don't overwrite with search result
          }))
          setLabelState('found')

          // Now fetch Vivino data separately (can take up to 60s)
          if (scannedName) {
            setVivinoState('loading')
            fetch('/api/vivino-lookup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: scannedName,
                winery: scannedWinery || null,
                vintage: scannedVintage ? parseInt(scannedVintage) : null,
              }),
            })
              .then(r => r.json())
              .then(vd => {
                if (vd.vivino_rating || vd.vivino_price || vd.vivino_url) {
                  setForm(prev => ({
                    ...prev,
                    vivino_rating: vd.vivino_rating?.toString() || prev.vivino_rating,
                    vivino_price: vd.vivino_price?.toString() || prev.vivino_price,
                    vivino_url: vd.vivino_url || prev.vivino_url,
                  }))
                  setVivinoState('found')
                } else {
                  setVivinoState('notfound')
                }
              })
              .catch(() => setVivinoState('notfound'))
          }
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

  async function fetchFromVivinoUrl() {
    if (!form.vivino_url.trim()) return
    setVivinoUrlState('loading')
    try {
      const res = await fetch('/api/vivino-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: form.vivino_url.trim() }),
      })
      const data = await res.json()
      if (data.rating || data.price) {
        setForm(prev => ({
          ...prev,
          vivino_rating: data.rating?.toString() || prev.vivino_rating,
          vivino_price: data.price?.toString() || prev.vivino_price,
        }))
        setVivinoUrlState('found')
      } else {
        setVivinoUrlState('error')
      }
    } catch {
      setVivinoUrlState('error')
    }
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

      const isSpirit = form.category === 'spirit'
      const payload = {
        category: form.category,
        spirit_type: isSpirit ? (form.spirit_type || null) : null,
        name: form.name.trim(),
        winery: isSpirit ? null : (form.winery || null),
        vintage: isSpirit ? null : (form.vintage ? parseInt(form.vintage) : null),
        varietal: isSpirit ? null : (form.varietal || null),
        region: isSpirit ? null : (form.region || null),
        country: form.country || null,
        location: form.location,
        quantity: parseInt(form.quantity) || 1,
        purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
        purchase_date: form.purchase_date || null,
        notes: form.notes || null,
        barcode: form.barcode || null,
        image_url: form.image_url || null,
        rating: isSpirit ? null : (form.rating || null),
        vivino_url: isSpirit ? null : (form.vivino_url || null),
        vivino_rating: isSpirit ? null : (form.vivino_rating ? parseFloat(form.vivino_rating) : null),
        vivino_price: isSpirit ? null : (form.vivino_price ? parseFloat(form.vivino_price) : null),
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

  const isSpirit = form.category === 'spirit'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {editId ? `Edit ${isSpirit ? 'Spirit' : 'Wine'}` : `Add ${isSpirit ? 'Spirit' : 'Wine'}`}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {editId ? 'Update the details below' : isSpirit ? 'Enter the bottle details' : 'Scan the label or barcode to auto-fill, or enter manually'}
        </p>
      </div>

      {/* Category toggle (hidden when editing — keep the existing category) */}
      {!editId && (
        <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => set('category', 'wine')}
            className={`py-2 rounded-lg text-sm font-medium transition-all ${
              form.category === 'wine'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            Wine
          </button>
          <button
            type="button"
            onClick={() => set('category', 'spirit')}
            className={`py-2 rounded-lg text-sm font-medium transition-all ${
              form.category === 'spirit'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            Spirit
          </button>
        </div>
      )}

      {/* Photo section */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h2 className="font-semibold text-gray-800">{editId ? 'Photo' : isSpirit ? 'Photo' : 'Scan Label'}</h2>
        {!editId && !isSpirit && <p className="text-xs text-gray-500">Take a photo of the label — Claude will read the wine details automatically</p>}
        {!editId && isSpirit && <p className="text-xs text-gray-500">Optional — take a photo of the bottle</p>}

        <input
          ref={labelInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleLabelPhoto}
        />

        {/* Show existing photo when editing, or preview after capture */}
        {(form.image_url && !imgError) || labelPreview ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={labelPreview || form.image_url}
              alt="Bottle photo"
              className="w-full max-h-64 object-cover rounded-xl border border-gray-100 shadow-sm"
              onError={() => setImgError(true)}
            />
            <button
              type="button"
              onClick={() => labelInputRef.current?.click()}
              disabled={labelState === 'loading'}
              className="w-full py-2 border border-gray-300 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {labelState === 'loading' ? 'Reading label...' : 'Change Photo'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => labelInputRef.current?.click()}
            disabled={labelState === 'loading'}
            className="w-full py-3 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {labelState === 'loading' ? 'Reading label...' : 'Take Photo or Upload'}
          </button>
        )}

        {labelState === 'found' && (
          <div className="space-y-1">
            <p className="text-sm text-green-700">Label recognised ✓</p>
            {vivinoState === 'loading' && (
              <p className="text-sm text-gray-500">Fetching Vivino rating…</p>
            )}
            {vivinoState === 'found' && (
              <p className="text-sm text-red-600 font-medium">
                Vivino {form.vivino_rating ?? ''}
                {form.vivino_price ? ` · €${form.vivino_price}` : ''}
              </p>
            )}
            {vivinoState === 'notfound' && (
              <p className="text-sm text-gray-400">Not found on Vivino — you can enter manually below.</p>
            )}
          </div>
        )}
        {labelState === 'error' && (
          <p className="text-sm text-amber-700">Could not read label — fill in details manually.</p>
        )}
      </div>

      {/* Barcode — photo or manual entry. Works for wines and spirits. */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h2 className="font-semibold text-gray-800">Barcode</h2>

        {/* Hidden helper div for html5-qrcode's scanFile */}
        <div id="hidden-barcode-reader" className="hidden" />

        <input
          ref={barcodePhotoRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleBarcodePhoto}
        />

        <button
          type="button"
          onClick={() => barcodePhotoRef.current?.click()}
          disabled={barcodeBusy}
          className="w-full py-3 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-50"
        >
          {barcodeBusy ? 'Reading barcode…' : '📷 Take a Photo of the Barcode'}
        </button>

        <p className="text-xs text-gray-500 text-center">— or type it manually —</p>

        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={form.barcode}
            onChange={e => set('barcode', e.target.value)}
            placeholder="e.g. 4750021000164"
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
        </div>

        {barcodePhotoError && <p className="text-sm text-amber-700">{barcodePhotoError}</p>}
        {lookupState === 'loading' && <p className="text-sm text-gray-500">Looking up bottle online…</p>}
        {lookupState === 'found' && <p className="text-sm text-green-700">Bottle found — details filled in below.</p>}
        {lookupState === 'notfound' && <p className="text-sm text-amber-700">Not found in database — fill in details below.</p>}
      </div>

      {/* Details form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <h2 className="font-semibold text-gray-800">{isSpirit ? 'Spirit Details' : 'Wine Details'}</h2>

        {isSpirit && (
          <Field label="Type *">
            <select value={form.spirit_type} onChange={e => set('spirit_type', e.target.value)}
              required className="input">
              <option value="">Select type…</option>
              {SPIRIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        )}

        <Field label={isSpirit ? 'Bottle Name *' : 'Wine Name *'}>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
            placeholder={isSpirit ? 'e.g. Macallan 18' : 'e.g. Chateau Margaux'} required className="input" />
        </Field>

        {!isSpirit && (
          <>
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
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Country">
            <input type="text" value={form.country} onChange={e => set('country', e.target.value)}
              placeholder={isSpirit ? 'e.g. Scotland' : 'e.g. France'} className="input" />
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

        {!isSpirit && (
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
        )}

        {/* Vivino — wine only */}
        {!isSpirit && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Vivino</label>
            <a
              href={`https://www.vivino.com/search/wines?q=${encodeURIComponent([form.winery, form.name, form.vintage].filter(Boolean).join(' '))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-red-600 hover:underline font-medium"
            >
              Find on Vivino →
            </a>
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              value={form.vivino_url}
              onChange={e => { set('vivino_url', e.target.value); setVivinoUrlState('idle') }}
              placeholder="Paste Vivino wine URL…"
              className="input text-sm flex-1"
            />
            <button
              type="button"
              onClick={fetchFromVivinoUrl}
              disabled={!form.vivino_url.trim() || vivinoUrlState === 'loading'}
              className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-40 whitespace-nowrap"
            >
              {vivinoUrlState === 'loading' ? '…' : 'Fetch'}
            </button>
          </div>
          {vivinoUrlState === 'found' && (
            <p className="text-xs text-green-700">✓ Rating and price updated from Vivino</p>
          )}
          {vivinoUrlState === 'error' && (
            <p className="text-xs text-amber-700">Could not read that page — enter rating manually below.</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vivino Rating">
              <input type="number" value={form.vivino_rating} onChange={e => set('vivino_rating', e.target.value)}
                placeholder="e.g. 4.2" min={1} max={5} step={0.1} className="input" />
            </Field>
            <Field label="Vivino Price (EUR)">
              <input type="number" value={form.vivino_price} onChange={e => set('vivino_price', e.target.value)}
                placeholder="0.00" step={0.01} min={0} className="input" />
            </Field>
          </div>
        </div>
        )}

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
