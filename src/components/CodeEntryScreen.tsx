import { useState, useRef } from 'react'
import { Loader, Key, ChevronRight, CheckCircle, XCircle } from 'lucide-react'
import { useCodeAuth } from '../contexts/CodeAuthContext'

export default function CodeEntryScreen() {
  const { enterCode } = useCodeAuth()
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (raw: string) => {
    // Normalize: uppercase, only letters/numbers/dashes, max 16 chars
    const clean = raw.toUpperCase().replace(/[^A-Z0-9\-]/g, '').slice(0, 16)
    setInput(clean)
    if (error) setError('')
  }

  const handleSubmit = async () => {
    if (!input.trim() || loading || success) return
    setLoading(true)
    setError('')
    const res = await enterCode(input)
    if (res.success) {
      setSuccess(true)
      // App re-renders automatically once code is set in context
    } else {
      setError(res.error ?? 'Ungültiger Code')
      setLoading(false)
      // Shake effect: briefly clear and restore to trigger re-focus
      inputRef.current?.focus()
    }
  }

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--bg)' }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center mb-10">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center mb-4"
          style={{
            background: 'linear-gradient(135deg,rgba(74,140,92,0.2),rgba(74,140,92,0.08))',
            border: '1.5px solid rgba(74,140,92,0.25)',
            boxShadow: '0 8px 32px rgba(74,140,92,0.15)',
          }}
        >
          <span style={{ fontSize: 44 }}>🥗</span>
        </div>
        <h1 className="text-3xl font-black" style={{ color: 'var(--text-1)' }}>Kalorilo</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Dein persönlicher Ernährungs-Coach</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm glass p-6 space-y-5" style={{ borderRadius: 28 }}>
        <div className="text-center">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: 'rgba(74,140,92,0.12)', border: '1px solid rgba(74,140,92,0.2)' }}
          >
            <Key size={22} style={{ color: '#4a8c5c' }} />
          </div>
          <h2 className="text-lg font-black" style={{ color: 'var(--text-1)' }}>Zugangscode eingeben</h2>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-3)' }}>
            Du hast einen persönlichen Code erhalten.<br />Gib ihn hier ein um loszulegen.
          </p>
        </div>

        {/* Input */}
        <div>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="KAL-XXXX-XXXX"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            disabled={success}
            style={{
              background: success ? 'rgba(74,140,92,0.08)' : 'rgba(255,255,255,0.05)',
              border: error
                ? '1.5px solid #ef4444'
                : success
                  ? '1.5px solid rgba(74,140,92,0.5)'
                  : '1.5px solid rgba(74,140,92,0.2)',
              borderRadius: 18,
              color: 'var(--text-1)',
              padding: '16px 20px',
              width: '100%',
              fontSize: 20,
              fontWeight: 800,
              textAlign: 'center',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              outline: 'none',
              transition: 'border-color 0.2s, background 0.2s',
            }}
          />

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-1.5 mt-2">
              <XCircle size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
              <p className="text-xs font-semibold" style={{ color: '#ef4444' }}>{error}</p>
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="flex items-center gap-1.5 mt-2 justify-center">
              <CheckCircle size={14} style={{ color: '#4a8c5c' }} />
              <p className="text-xs font-semibold" style={{ color: '#4a8c5c' }}>Code akzeptiert – wird geladen…</p>
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || loading || success}
          className="w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all disabled:opacity-40"
          style={{
            background: success
              ? 'linear-gradient(135deg,#4a8c5c,#7db88a)'
              : 'linear-gradient(135deg,#4a8c5c,#7db88a)',
            color: '#fff',
            minHeight: 54,
            boxShadow: '0 4px 20px rgba(74,140,92,0.35)',
          }}
        >
          {success ? (
            <><CheckCircle size={18} />Eingeloggt</>
          ) : loading ? (
            <><Loader size={18} className="animate-spin" />Wird geprüft…</>
          ) : (
            <><ChevronRight size={18} />Einloggen</>
          )}
        </button>

        <p className="text-center text-xs" style={{ color: 'var(--text-3)' }}>
          Noch keinen Code? Kontaktiere den Administrator.
        </p>
      </div>

      {/* Example */}
      <p className="mt-6 text-xs font-mono" style={{ color: 'var(--text-3)', opacity: 0.5 }}>
        Beispiel: KAL-2025-XY7Z
      </p>
    </div>
  )
}
