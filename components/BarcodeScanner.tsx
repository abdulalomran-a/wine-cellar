'use client'

import { useEffect, useState } from 'react'
import { X, Camera } from 'lucide-react'
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
        await instance.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 280, height: 160 } },
          (decodedText) => {
            onDetected(decodedText)
            instance?.stop().catch(() => {})
          },
          undefined
        )
        setScanning(true)
      } catch (err) {
        setError('Camera access denied. Please allow camera permissions.')
        console.error(err)
      }
    }

    startScanner()

    return () => {
      instance?.stop().catch(() => {})
    }
  }, [onDetected])

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-purple-600" />
            <h2 className="font-semibold text-gray-900">Scan Barcode</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {error ? (
            <div className="text-center py-8 text-red-600">
              <p>{error}</p>
            </div>
          ) : (
            <>
              <div id="barcode-reader" className="w-full rounded-lg overflow-hidden" />
              {scanning && (
                <p className="text-center text-sm text-gray-500 mt-3">
                  Point camera at the barcode on the wine bottle
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
