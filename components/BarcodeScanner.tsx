'use client'

import { useEffect, useState } from 'react'
import type { Html5Qrcode as Html5QrcodeType } from 'html5-qrcode'

interface Props {
  onDetected: (barcode: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    let instance: Html5QrcodeType | null = null

    async function startScanner() {
      const { Html5Qrcode } = await import('html5-qrcode')
      instance = new Html5Qrcode('barcode-reader')
      try {
        // Use window width for the scan box so it fills iPhone screen properly
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
        setScanning(true)
      } catch (err) {
        setError('Camera access denied. Please tap Allow when Safari asks for camera access.')
        console.error(err)
      }
    }

    startScanner()

    return () => {
      instance?.stop().catch(() => {})
    }
  }, [onDetected])

  return (
    // Full-screen on mobile, modal on desktop
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <span className="text-white font-semibold text-base">Scan Barcode</span>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-white border border-white/30 rounded-lg"
        >
          Cancel
        </button>
      </div>

      {/* Camera view */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {error ? (
          <div className="text-center px-8">
            <p className="text-white text-base mb-4">{error}</p>
            <button onClick={onClose} className="px-6 py-3 bg-white text-gray-900 rounded-xl text-sm font-medium">
              Go Back
            </button>
          </div>
        ) : (
          <>
            <div id="barcode-reader" className="w-full" />
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
