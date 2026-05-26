import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { NotFoundException } from '@zxing/library'
import { X, Zap, ZapOff, Loader } from 'lucide-react'

interface Props {
  onDetected: (barcode: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const doneRef     = useRef(false)

  const stopStream = () => {
    const s = videoRef.current?.srcObject as MediaStream | null
    s?.getTracks().forEach((t) => t.stop())
    if (videoRef.current) videoRef.current.srcObject = null
  }

  const [status, setStatus]           = useState<'starting' | 'scanning' | 'detected' | 'error'>('starting')
  const [errorMsg, setErrorMsg]       = useState('')
  const [detectedCode, setDetectedCode] = useState('')
  const [torch, setTorch]             = useState(false)

  useEffect(() => {
    doneRef.current = false
    const reader = new BrowserMultiFormatReader()

    let scanStarted = false

    // decodeFromConstraints: handles getUserMedia + video.play() + continuous scan loop
    // callback fires on every frame (result=barcode found, err=NotFoundException=no barcode yet)
    reader
      .decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: 'environment' },
            width:  { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current!,
        (result, err) => {
          // First callback = camera is live and scanning
          if (!scanStarted) {
            scanStarted = true
            setStatus('scanning')
          }

          if (doneRef.current) return

          if (result) {
            doneRef.current = true
            const code = result.getText()
            setDetectedCode(code)
            setStatus('detected')
            stopStream()
            setTimeout(() => onDetected(code), 550)
            return
          }

          // NotFoundException is normal (no barcode in frame) – ignore silently
          if (err && !(err instanceof NotFoundException)) {
            console.warn('[BarcodeScanner]', err)
          }
        }
      )
      .catch((e: any) => {
        if (doneRef.current) return
        setStatus('error')
        if (e?.name === 'NotAllowedError') {
          setErrorMsg('Kamera-Zugriff verweigert.\n\niPhone: Einstellungen → Safari → Kamera → Erlauben')
        } else if (e?.name === 'NotFoundError') {
          setErrorMsg('Keine Kamera gefunden.')
        } else if (e?.name === 'NotReadableError') {
          setErrorMsg('Kamera wird von einer anderen App genutzt.')
        } else if (!window.isSecureContext) {
          setErrorMsg('Kamera benötigt HTTPS. Bitte kalorilo.vercel.app öffnen.')
        } else {
          setErrorMsg(`Kamera-Fehler: ${e?.message ?? 'Unbekannt'}`)
        }
      })

    return () => {
      doneRef.current = true
      stopStream()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTorch = async () => {
    const stream = videoRef.current?.srcObject as MediaStream | null
    const track  = stream?.getVideoTracks()[0]
    if (!track) return
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: !torch }] })
      setTorch((v) => !v)
    } catch { /* torch not supported */ }
  }

  const handleClose = () => {
    doneRef.current = true
    stopStream()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[120]" style={{ background: '#000' }}>

      {/* ── Video – always in DOM so ZXing can attach to it ── */}
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
          transition: 'opacity 0.4s',
        }}
      />

      {/* ── Vignette overlay ── */}
      {(status === 'scanning' || status === 'detected') && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.08) 28%, rgba(0,0,0,0.08) 72%, rgba(0,0,0,0.55) 100%)',
          }}
        />
      )}

      {/* ── Scan frame ── */}
      {(status === 'scanning' || status === 'detected') && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            style={{
              position: 'relative',
              width: 'min(76vw, 320px)',
              height: 170,
            }}
          >
            {/* Corner brackets */}
            {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
              <div
                key={c}
                style={{
                  position: 'absolute',
                  width: 34,
                  height: 34,
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
                    c === 'bl' ? '0 0 0 8px' :
                                 '0 0 8px 0',
                }}
              />
            ))}

            {/* Animated scan line */}
            {status === 'scanning' && (
              <div
                style={{
                  position: 'absolute',
                  left: 4,
                  right: 4,
                  height: 2,
                  background:
                    'linear-gradient(90deg, transparent, #7db88a, #4a8c5c, #7db88a, transparent)',
                  boxShadow: '0 0 10px rgba(74,140,92,0.9)',
                  borderRadius: 1,
                  animation: 'bcscan 1.8s ease-in-out infinite',
                }}
              />
            )}

            {/* Detected flash */}
            {status === 'detected' && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(74,140,92,0.3)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    background: '#4a8c5c',
                    borderRadius: 12,
                    padding: '8px 20px',
                    boxShadow: '0 4px 20px rgba(74,140,92,0.5)',
                  }}
                >
                  <p style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>
                    ✅ {detectedCode}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Hint label ── */}
      {status === 'scanning' && (
        <p
          style={{
            position: 'absolute',
            bottom: '30%',
            left: 0,
            right: 0,
            textAlign: 'center',
            color: 'rgba(255,255,255,0.8)',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 0.3,
            pointerEvents: 'none',
          }}
        >
          Barcode in den Rahmen halten
        </p>
      )}

      {/* ── Starting spinner ── */}
      {status === 'starting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <Loader size={42} className="animate-spin" style={{ color: '#4a8c5c' }} />
          <p style={{ color: '#bbb', fontSize: 14, fontWeight: 600 }}>Kamera wird gestartet…</p>
        </div>
      )}

      {/* ── Error ── */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center gap-5">
          <span style={{ fontSize: 56 }}>📷</span>
          <p style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>Kamera nicht verfügbar</p>
          <div
            style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 16,
              padding: '14px 18px',
              width: '100%',
            }}
          >
            <p style={{ color: '#f87171', fontSize: 14, whiteSpace: 'pre-line', fontWeight: 600 }}>
              {errorMsg}
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: 16,
              color: '#fff',
              padding: '13px 36px',
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            Schließen
          </button>
        </div>
      )}

      {/* ── Top bar ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          paddingTop: 'max(env(safe-area-inset-top), 16px)',
          paddingLeft: 20,
          paddingRight: 20,
          paddingBottom: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)',
        }}
      >
        <p style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>Barcode scannen</p>
        <button
          onClick={handleClose}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            background: 'rgba(0,0,0,0.45)',
            border: '1px solid rgba(255,255,255,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} color="#fff" />
        </button>
      </div>

      {/* ── Bottom bar: torch ── */}
      {status === 'scanning' && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingBottom: 'max(env(safe-area-inset-bottom), 36px)',
            paddingTop: 28,
            display: 'flex',
            justifyContent: 'center',
            background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
          }}
        >
          <button
            onClick={toggleTorch}
            style={{
              width: 54,
              height: 54,
              borderRadius: 27,
              background: torch ? 'rgba(74,140,92,0.35)' : 'rgba(255,255,255,0.1)',
              border: torch
                ? '1px solid rgba(74,140,92,0.7)'
                : '1px solid rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {torch ? <Zap size={22} color="#7db88a" /> : <ZapOff size={22} color="#fff" />}
          </button>
        </div>
      )}

      {/* Scan line animation */}
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
