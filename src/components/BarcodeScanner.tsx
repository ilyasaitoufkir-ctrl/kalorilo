import { useEffect, useRef, useState } from 'react'
import { X, Zap, ZapOff, Loader } from 'lucide-react'

interface Props {
  onDetected: (barcode: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const stoppedRef = useRef(false)

  const [status, setStatus] = useState<'starting' | 'scanning' | 'detected' | 'error'>('starting')
  const [errorMsg, setErrorMsg] = useState('')
  const [torch, setTorch] = useState(false)
  const [detectedCode, setDetectedCode] = useState('')

  const stopAll = () => {
    stoppedRef.current = true
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  useEffect(() => {
    stoppedRef.current = false

    const start = async () => {
      if (!window.isSecureContext) {
        setStatus('error')
        setErrorMsg('Kamera benötigt HTTPS. Bitte kalorilo.vercel.app öffnen.')
        return
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error')
        setErrorMsg('Kamera wird von diesem Browser nicht unterstützt. Bitte Safari nutzen.')
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })

        if (stoppedRef.current) { stream.getTracks().forEach((t) => t.stop()); return }

        streamRef.current = stream

        const video = videoRef.current!
        video.srcObject = stream
        video.setAttribute('playsinline', 'true')
        video.setAttribute('webkit-playsinline', 'true')
        video.muted = true

        await video.play()
        setStatus('scanning')

        // Try native BarcodeDetector first (Chrome/Android, iOS 17+)
        if ('BarcodeDetector' in window) {
          const detector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
          })
          const scan = async () => {
            if (stoppedRef.current) return
            try {
              const codes = await detector.detect(video)
              if (codes.length > 0 && !stoppedRef.current) {
                const code = codes[0].rawValue as string
                setDetectedCode(code)
                setStatus('detected')
                stopAll()
                setTimeout(() => onDetected(code), 500)
                return
              }
            } catch { /* frame not ready */ }
            setTimeout(scan, 150)
          }
          setTimeout(scan, 500)
        } else {
          // Fallback: ZXing
          const { BrowserMultiFormatReader } = await import('@zxing/browser')
          const { NotFoundException } = await import('@zxing/library')
          const reader = new BrowserMultiFormatReader()
          reader.decodeFromStream(stream, video, (result, err) => {
            if (stoppedRef.current) return
            if (result) {
              const code = result.getText()
              setDetectedCode(code)
              setStatus('detected')
              stopAll()
              setTimeout(() => onDetected(code), 500)
            } else if (err && !(err instanceof NotFoundException)) {
              console.warn('[BarcodeScanner]', err)
            }
          })
        }
      } catch (e: any) {
        if (stoppedRef.current) return
        setStatus('error')
        if (e.name === 'NotAllowedError') {
          setErrorMsg('Kamera-Zugriff verweigert.\n\niPhone: Einstellungen → Safari → Kamera → Erlauben')
        } else if (e.name === 'NotFoundError') {
          setErrorMsg('Keine Kamera gefunden.')
        } else if (e.name === 'NotReadableError') {
          setErrorMsg('Kamera wird gerade von einer anderen App genutzt.')
        } else {
          setErrorMsg(`Kamera-Fehler: ${e.message}`)
        }
      }
    }

    start()
    return () => { stopAll() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: !torch }] })
      setTorch((v) => !v)
    } catch { /* torch not supported on this device */ }
  }

  const handleClose = () => { stopAll(); onClose() }

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col"
      style={{ background: '#000' }}
    >
      {/* ── Video feed – always in DOM, always visible ── */}
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
          transition: 'opacity 0.3s',
        }}
      />

      {/* ── Dark vignette overlay ── */}
      {(status === 'scanning' || status === 'detected') && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: [
              'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.1) 25%, rgba(0,0,0,0.1) 75%, rgba(0,0,0,0.6) 100%)',
            ].join(','),
          }}
        />
      )}

      {/* ── Scan frame ── */}
      {(status === 'scanning' || status === 'detected') && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative flex items-center justify-center" style={{ width: '76vw', maxWidth: 340, height: 180 }}>

            {/* Corner brackets – green */}
            {(['tl','tr','bl','br'] as const).map((corner) => (
              <div key={corner} style={{
                position: 'absolute',
                width: 36, height: 36,
                top:    corner.startsWith('t') ? 0 : undefined,
                bottom: corner.startsWith('b') ? 0 : undefined,
                left:   corner.endsWith('l')   ? 0 : undefined,
                right:  corner.endsWith('r')   ? 0 : undefined,
                borderTop:    corner.startsWith('t') ? '3px solid #4a8c5c' : 'none',
                borderBottom: corner.startsWith('b') ? '3px solid #4a8c5c' : 'none',
                borderLeft:   corner.endsWith('l')   ? '3px solid #4a8c5c' : 'none',
                borderRight:  corner.endsWith('r')   ? '3px solid #4a8c5c' : 'none',
                borderRadius:
                  corner === 'tl' ? '8px 0 0 0' :
                  corner === 'tr' ? '0 8px 0 0' :
                  corner === 'bl' ? '0 0 0 8px' : '0 0 8px 0',
              }}/>
            ))}

            {/* Animated scan line */}
            {status === 'scanning' && (
              <div style={{
                position: 'absolute',
                left: 4, right: 4,
                height: 2,
                background: 'linear-gradient(90deg, transparent, #7db88a, #4a8c5c, #7db88a, transparent)',
                borderRadius: 1,
                animation: 'scanline 1.6s ease-in-out infinite',
                boxShadow: '0 0 8px rgba(74,140,92,0.8)',
              }}/>
            )}

            {/* Success flash */}
            {status === 'detected' && (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(74,140,92,0.25)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <div style={{
                  background: '#4a8c5c',
                  borderRadius: 12,
                  padding: '8px 18px',
                }}>
                  <p style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>✅ {detectedCode}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Hint text below scan frame ── */}
      {status === 'scanning' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p style={{
            position: 'absolute',
            bottom: '34%',
            left: 0, right: 0,
            textAlign: 'center',
            color: 'rgba(255,255,255,0.75)',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 0.3,
          }}>
            Barcode in den Rahmen halten
          </p>
        </div>
      )}

      {/* ── Starting spinner ── */}
      {status === 'starting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <Loader size={40} className="animate-spin" style={{ color: '#4a8c5c' }}/>
          <p style={{ color: '#aaa', fontSize: 14, fontWeight: 600 }}>Kamera wird gestartet…</p>
        </div>
      )}

      {/* ── Error state ── */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center gap-5">
          <span style={{ fontSize: 56 }}>📷</span>
          <p style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>Kamera nicht verfügbar</p>
          <div style={{
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 16,
            padding: '14px 18px',
            width: '100%',
          }}>
            <p style={{ color: '#f87171', fontSize: 14, whiteSpace: 'pre-line', fontWeight: 600 }}>{errorMsg}</p>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: '#222',
              border: '1px solid #444',
              borderRadius: 16,
              color: '#fff',
              padding: '12px 32px',
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            Schließen
          </button>
        </div>
      )}

      {/* ── Top bar: close button ── */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-5"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)', zIndex: 10 }}
      >
        <p style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>Barcode scannen</p>
        <button
          onClick={handleClose}
          style={{
            width: 40, height: 40,
            borderRadius: 20,
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={18} color="#fff"/>
        </button>
      </div>

      {/* ── Bottom bar: torch ── */}
      {status === 'scanning' && (
        <div
          className="absolute bottom-0 left-0 right-0 flex justify-center"
          style={{
            paddingBottom: 'max(env(safe-area-inset-bottom), 32px)',
            paddingTop: 24,
            background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
          }}
        >
          <button
            onClick={toggleTorch}
            style={{
              width: 52, height: 52,
              borderRadius: 26,
              background: torch ? 'rgba(74,140,92,0.3)' : 'rgba(255,255,255,0.12)',
              border: torch ? '1px solid rgba(74,140,92,0.6)' : '1px solid rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {torch ? <Zap size={22} color="#7db88a"/> : <ZapOff size={22} color="#fff"/>}
          </button>
        </div>
      )}

      {/* Scan line keyframes */}
      <style>{`
        @keyframes scanline {
          0%   { top: 8px; opacity: 0.6; }
          50%  { opacity: 1; }
          100% { top: calc(100% - 10px); opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}
