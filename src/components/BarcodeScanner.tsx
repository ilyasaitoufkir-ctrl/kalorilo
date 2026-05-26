import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { NotFoundException } from '@zxing/library'
import { X, Flashlight, Loader } from 'lucide-react'

interface Props {
  onDetected: (barcode: string) => void
  onClose: () => void
}

type ScanState = 'requesting' | 'scanning' | 'detected' | 'error'

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const readerRef   = useRef<BrowserMultiFormatReader | null>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const [state, setState]     = useState<ScanState>('requesting')
  const [errorMsg, setErrorMsg] = useState('')
  const [detected, setDetected] = useState('')
  const [torch, setTorch]     = useState(false)

  const stopCamera = useCallback(() => {
    try { BrowserMultiFormatReader.releaseAllStreams?.() } catch { /* ignore */ }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    let cancelled = false

    const start = async () => {
      setState('requesting')

      // Check HTTPS / secure context
      if (!window.isSecureContext) {
        setState('error')
        setErrorMsg('Kamera benötigt HTTPS. Bitte kalorilo.vercel.app öffnen.')
        return
      }

      // Check mediaDevices support
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('error')
        setErrorMsg('Kamera wird von diesem Browser nicht unterstützt. Bitte Safari nutzen.')
        return
      }

      try {
        // Request camera – prefer back camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        setState('scanning')

        // Start ZXing reader
        const reader = new BrowserMultiFormatReader()
        readerRef.current = reader

        reader.decodeFromStream(stream, videoRef.current!, (result, err) => {
          if (cancelled) return
          if (result) {
            const code = result.getText()
            setDetected(code)
            setState('detected')
            stopCamera()
            setTimeout(() => {
              if (!cancelled) onDetected(code)
            }, 600)
          } else if (err && !(err instanceof NotFoundException)) {
            console.warn('[BarcodeScanner]', err)
          }
        })
      } catch (e: any) {
        if (cancelled) return
        setState('error')
        if (e.name === 'NotAllowedError') {
          setErrorMsg('Kamera-Zugriff verweigert.\n\niPhone Einstellungen → Safari → Kamera → Erlauben.')
        } else if (e.name === 'NotFoundError') {
          setErrorMsg('Keine Kamera gefunden.')
        } else if (e.name === 'NotReadableError') {
          setErrorMsg('Kamera wird bereits von einer anderen App verwendet.')
        } else {
          setErrorMsg(`Kamera-Fehler: ${e.message}`)
        }
      }
    }

    start()
    return () => { cancelled = true; stopCamera() }
  }, [onDetected, stopCamera])

  // Torch (flashlight) toggle
  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: !torch }] })
      setTorch(!torch)
    } catch { /* torch not supported */ }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Camera feed */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: state === 'scanning' || state === 'detected' ? 'block' : 'none' }}
      />

      {/* Dark overlay with scan window */}
      {(state === 'scanning' || state === 'detected') && (
        <>
          {/* Corner overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.55) 100%)',
          }}/>
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'linear-gradient(to right, rgba(0,0,0,0.55) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.55) 100%)',
          }}/>

          {/* Scan target rectangle */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative" style={{ width: '72vw', maxWidth: 320, height: 160 }}>
              {/* Animated scan line */}
              <div className="absolute inset-x-0 top-0 h-0.5 animate-pulse"
                style={{ background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)' }}/>

              {/* Corner brackets */}
              {[
                { top:0, left:0,   borderRight:'none', borderBottom:'none' },
                { top:0, right:0,  borderLeft:'none',  borderBottom:'none' },
                { bottom:0, left:0,  borderRight:'none', borderTop:'none' },
                { bottom:0, right:0, borderLeft:'none',  borderTop:'none' },
              ].map((style, i) => (
                <div key={i} className="absolute w-8 h-8" style={{
                  ...style,
                  border: '3px solid #f59e0b',
                  borderRadius: i < 2 ? '8px 8px 0 0' : '0 0 8px 8px',
                }}/>
              ))}

              {state === 'detected' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-2xl px-4 py-2" style={{ background:'rgba(16,185,129,0.9)' }}>
                    <p className="text-white text-sm font-black">✅ {detected}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Loading state */}
      {state === 'requesting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <Loader size={36} className="animate-spin" style={{ color: '#4a8c5c' }}/>
          <p className="text-sm font-semibold" style={{ color: '#999' }}>Kamera wird gestartet…</p>
        </div>
      )}

      {/* Error state */}
      {state === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center gap-4">
          <span className="text-5xl">📷</span>
          <p className="text-lg font-black" style={{ color: '#fff' }}>Kamera nicht verfügbar</p>
          <div className="rounded-2xl p-4 w-full" style={{ background:'#ffffff', border:'1px solid #333' }}>
            <p className="text-sm whitespace-pre-line" style={{ color: '#ef4444' }}>{errorMsg}</p>
          </div>
          <button onClick={onClose}
            className="px-8 py-3 rounded-2xl font-bold text-sm"
            style={{ background:'#222', color:'#fff', border:'1px solid #333' }}>
            Schließen
          </button>
        </div>
      )}

      {/* Bottom bar */}
      {(state === 'scanning') && (
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-6 pb-safe pt-4"
          style={{ background:'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
          <button onClick={toggleTorch}
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: torch ? 'rgba(74,140,92,0.18)' : 'rgba(255,255,255,0.1)' }}>
            <Flashlight size={20} style={{ color: torch ? '#4a8c5c' : '#fff' }}/>
          </button>

          <p className="text-sm font-semibold text-center" style={{ color: '#ccc' }}>
            Barcode in den Rahmen halten
          </p>

          <button onClick={onClose}
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.1)' }}>
            <X size={20} className="text-white"/>
          </button>
        </div>
      )}

      {/* Top close button (always visible) */}
      {state !== 'error' && (
        <div className="absolute top-0 left-0 right-0 flex justify-end px-5 pt-safe">
          <button onClick={onClose}
            className="w-10 h-10 rounded-2xl flex items-center justify-center mt-3"
            style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <X size={18} className="text-white"/>
          </button>
        </div>
      )}
    </div>
  )
}
