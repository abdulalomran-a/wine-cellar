'use client'

import { useEffect, useRef, useState } from 'react'
import type { Html5Qrcode as Html5QrcodeType } from 'html5-qrcode'

interface Props {
  onDetected: (barcode: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [manualValue, setManualValue] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let instance: Html5QrcodeType | null = null
    let cancelled = false

    async function startScanner() {
      try {
        const mod = await import('html5-qrcode')
        if (cancelled) return
        const { Html5Qrcode } = mod
        instance = new Html5Qrcode('barcode-reader')

        const vw = Math.min(window.innerWidth - 48, 360)
        await instance.start(
          { facingMode: 'environment' },
          { fps: 15, qrbox: { width: vw, height: Math.round(vw * 0.55) } },
          (decodedText) => {
            onDetected(decodedText)
            instance?.stop().catch(() => {})
          },
          undefined
        )
        if (cancelled) {
          instance.stop().catch(() => {})
          return
        }
        setScanning(true)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('notallowed')) {
          setError('Camera access was denied. Open iPhone Settings → Wine Cellar → and enable Camera, then try again.')
        } else if (msg.toLowerCase().includes('notfound') || msg.toLowerCase().includes('no camera')) {
          setError('No camera found on this device.')
        } else {
          setError(`Could not start camera: ${msg}`)
        }
        console.error('Scanner error:', err)
      }
    }

    startScanner()

    return () => {
      cancelled = true
      instance?.stop().catch(() => {})
    }
  }, [onDetected])

  /** Read a barcode from a photo (works as a fallback when live camera doesn't init) */
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const tmp = new Html5Qrcode('barcode-reader-photo')
      const result = await tmp.scanFile(file, false)
      onDetected(result)
    } catch (err) {
      console.error(err)
      setError('Could not read a barcode from that photo. Try cropping closer to just the barcode.')
    }
  }

  function submitManual() {
    const v = manualValue.trim()
    if (v) onDetected(v)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <span className="text-white font-semibold text-base">Scan Barcode</span>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-white border border-white/30 rounded-lg"
        >
          Cancel
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 overflow-y-auto">
        {error ? (
          <div className="text-center w-full max-w-sm space-y-4">
            <p className="text-white text-base">{error}</p>

            <div className="bg-white/10 rounded-xl p-4 space-y-3 text-left">
              <p className="text-white/80 text-sm font-medium">Use a photo instead:</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFile}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 bg-white text-gray-900 rounded-lg text-sm font-medium"
              >
                Take a photo of the barcode
              </button>
            </div>

            <div className="bg-white/10 rounded-xl p-4 space-y-3 text-left">
              <p className="text-white/80 text-sm font-medium">Or type the barcode:</p>
              <input
                type="text"
                inputMode="numeric"
                value={manualValue}
                onChange={e => setManualValue(e.target.value)}
                placeholder="e.g. 080686824657"
                className="w-full px-3 py-2 rounded-lg text-base bg-white/90 text-gray-900"
              />
              <button
                onClick={submitManual}
                disabled={!manualValue.trim()}
                className="w-full py-2.5 bg-white text-gray-900 rounded-lg text-sm font-medium disabled:opacity-40"
              >
                Use this barcode
              </button>
            </div>
          </div>
        ) : (
          <>
            <div id="barcode-reader" className="w-full" />
            <div id="barcode-reader-photo" className="hidden" />
            {scanning && (
              <p className="text-white/70 text-sm mt-4 text-center px-4">
                Hold the barcode steady in the frame
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
