import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Zap, ZapOff, Loader } from 'lucide-react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { NotFoundException } from '@zxing/library'

interface Props {
  onDetected: (barcode: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const doneRef     = useRef(false)
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const zxingRef    = useRef<{ stop: () => void } | null>(null)

  const [status, setStatus]             = useState<'starting' | 'scanning' | 'detected' | 'error'>('starting')
  const [errorMsg, setErrorMsg]         = useState('')
  const [detectedCode, setDetectedCode] = useState('')
  const [torch, setTorch]               = useState(false)

  const stopAll = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    zxingRef.current?.stop()
    const s = videoRef.current?.srcObject as MediaStream | null
    s?.getTracks().forEach((t) => t.stop())
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  useEffect(() => {
    doneRef.current = false

    const start = async () => {
      if (!window.isSecureContext) {
        setStatus('error')
        setErrorMsg('Kamera benötigt HTTPS.\nBitte die App im Browser (https://...) öffnen.')
        return
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error')
        setErrorMsg('Kamera nicht unterstützt.\nBitte Safari oder Chrome nutzen.')
        return
      }

      try {
        // Start camera stream — immer Rückkamera bevorzugen
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width:  { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })

        if (doneRef.current) { mediaStream.getTracks().forEach((t) => t.stop()); return }

        const video = videoRef.current!
        video.srcObject = mediaStream
        await video.play()

        if (doneRef.current) { stopAll(); return }

        setStatus('scanning')

        if ('BarcodeDetector' in window) {
          // ── Nativer BarcodeDetector (Chrome, Safari iOS 17+, macOS Sonoma) ──
          const detector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
          })

          const scan = async () => {
            if (doneRef.current) return
            try {
              if (video.readyState >= 2) {
                const codes: { rawValue: string }[] = await detector.detect(video)
                if (codes.length > 0 && !doneRef.current) {
                  doneRef.current = true
                  const code = codes[0].rawValue
                  setDetectedCode(code)
                  setStatus('detected')
                  stopAll()
                  setTimeout(() => onDetected(code), 550)
                  return
                }
              }
            } catch { /* frame not ready */ }
            timerRef.current = setTimeout(scan, 180)
          }
          timerRef.current = setTimeout(scan, 600)

        } else {
          // ── ZXing Fallback (Safari < iOS 17, Firefox, alle anderen) ──
          const reader = new BrowserMultiFormatReader()
          const controls = await reader.decodeFromVideoElement(video, (result, error) => {
            if (result && !doneRef.current) {
              doneRef.current = true
              const code = result.getText()
              setDetectedCode(code)
              setStatus('detected')
              controls.stop()
              setTimeout(() => onDetected(code), 550)
              return
            }
            // NotFoundException = kein Barcode im Frame — normal, ignorieren
            if (error && !(error instanceof NotFoundException) && !doneRef.current) {
              console.warn('[BarcodeScanner]', error)
            }
          })
          zxingRef.current = controls
        }

      } catch (e: any) {
        if (doneRef.current) return
        setStatus('error')
        if (e?.name === 'NotAllowedError') {
          setErrorMsg('Kamera-Zugriff verweigert.\n\niPhone: Einstellungen → Safari → Kamera → Erlauben')
        } else if (e?.name === 'NotFoundError') {
          setErrorMsg('Keine Kamera gefunden.')
        } else if (e?.name === 'NotReadableError') {
          setErrorMsg('Kamera wird von einer anderen App genutzt.')
        } else {
          setErrorMsg(`Kamera-Fehler: ${e?.message ?? 'Unbekannt'}`)
        }
      }
    }

    start()
    return () => { doneRef.current = true; stopAll() }
  }, [stopAll, onDetected])

  const toggleTorch = async () => {
    const s = videoRef.current?.srcObject as MediaStream | null
    const track = s?.getVideoTracks()[0]
    if (!track) return
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: !torch }] })
      setTorch((v) => !v)
    } catch { /* torch nicht unterstützt */ }
  }

  const handleClose = () => { doneRef.current = true; stopAll(); onClose() }

  return (
    <div className="fixed inset-0 z-[120]" style={{ background: '#000' }}>

      {/* Video – immer im DOM damit Kamera anhängen kann */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: status === 'scanning' || status === 'detected' ? 1 : 0,
          transition: 'opacity 0.35s',
        }}
      />

      {/* Vignette */}
      {(status === 'scanning' || status === 'detected') && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.06) 28%, rgba(0,0,0,0.06) 72%, rgba(0,0,0,0.55) 100%)',
          }}
        />
      )}

      {/* Scan-Rahmen */}
      {(status === 'scanning' || status === 'detected') && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div style={{ position: 'relative', width: 'min(76vw, 320px)', height: 170 }}>

            {/* Ecken */}
            {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
              <div key={c} style={{
                position: 'absolute', width: 34, height: 34,
                top:    c[0] === 't' ? 0 : undefined,
                bottom: c[0] === 'b' ? 0 : undefined,
                left:   c[1] === 'l' ? 0 : undefined,
                right:  c[1] === 'r' ? 0 : undefined,
                borderTop:    c[0] === 't' ? '3px solid #4a8c5c' : 'none',
                borderBottom: c[0] === 'b' ? '3px solid #4a8c5c' : 'none',
                borderLeft:   c[1] === 'l' ? '3px solid #4a8c5c' : 'none',
                borderRight:  c[1] === 'r' ? '3px solid #4a8c5c' : 'none',
                borderRadius:
                  c === 'tl' ? '8px 0 0 0' :
                  c === 'tr' ? '0 8px 0 0' :
                  c === 'bl' ? '0 0 0 8px' : '0 0 8px 0',
              }} />
            ))}

            {/* Animierte Scan-Linie */}
            {status === 'scanning' && (
              <div style={{
                position: 'absolute', left: 4, right: 4, height: 2,
                background: 'linear-gradient(90deg, transparent, #7db88a, #4a8c5c, #7db88a, transparent)',
                boxShadow: '0 0 10px rgba(74,140,92,0.9)',
                borderRadius: 1,
                animation: 'bcscan 1.8s ease-in-out infinite',
              }} />
            )}

            {/* Erkannt-Flash */}
            {status === 'detected' && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(74,140,92,0.3)', borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  background: '#4a8c5c', borderRadius: 12, padding: '8px 20px',
                  boxShadow: '0 4px 20px rgba(74,140,92,0.5)',
                }}>
                  <p style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>✅ {detectedCode}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hinweis-Text */}
      {status === 'scanning' && (
        <p style={{
          position: 'absolute', bottom: '30%', left: 0, right: 0,
          textAlign: 'center', color: 'rgba(255,255,255,0.8)',
          fontSize: 13, fontWeight: 600, pointerEvents: 'none',
        }}>
          Barcode in den Rahmen halten
        </p>
      )}

      {/* Spinner beim Start */}
      {status === 'starting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <Loader size={42} className="animate-spin" style={{ color: '#4a8c5c' }} />
          <p style={{ color: '#bbb', fontSize: 14, fontWeight: 600 }}>Kamera wird gestartet…</p>
        </div>
      )}

      {/* Fehler */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center gap-5">
          <span style={{ fontSize: 56 }}>📷</span>
          <p style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>Scanner nicht verfügbar</p>
          <div style={{
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 16, padding: '14px 18px', width: '100%',
          }}>
            <p style={{ color: '#f87171', fontSize: 14, whiteSpace: 'pre-line', fontWeight: 600 }}>
              {errorMsg}
            </p>
          </div>
          <button onClick={handleClose} style={{
            background: '#1a1a1a', border: '1px solid #333',
            borderRadius: 16, color: '#fff', padding: '13px 36px',
            fontSize: 15, fontWeight: 700,
          }}>
            Schließen
          </button>
        </div>
      )}

      {/* Top-Bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        paddingTop: 'max(env(safe-area-inset-top), 16px)',
        paddingLeft: 20, paddingRight: 20, paddingBottom: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)',
      }}>
        <p style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>Barcode scannen</p>
        <button onClick={handleClose} style={{
          width: 40, height: 40, borderRadius: 20,
          background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <X size={18} color="#fff" />
        </button>
      </div>

      {/* Taschenlampe */}
      {status === 'scanning' && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          paddingBottom: 'max(env(safe-area-inset-bottom), 36px)', paddingTop: 28,
          display: 'flex', justifyContent: 'center',
          background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
        }}>
          <button onClick={toggleTorch} style={{
            width: 54, height: 54, borderRadius: 27,
            background: torch ? 'rgba(74,140,92,0.35)' : 'rgba(255,255,255,0.1)',
            border: torch ? '1px solid rgba(74,140,92,0.7)' : '1px solid rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {torch ? <Zap size={22} color="#7db88a" /> : <ZapOff size={22} color="#fff" />}
          </button>
        </div>
      )}

      <style>{`
        @keyframes bcscan {
          0%   { top: 6px;  opacity: 0.5; }
          50%  { opacity: 1; }
          100% { top: calc(100% - 8px); opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
