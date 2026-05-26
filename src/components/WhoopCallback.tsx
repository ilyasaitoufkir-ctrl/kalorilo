import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Loader } from 'lucide-react'
import { useStore } from '../store/useStore'
import { exchangeCode } from '../lib/whoop'

export default function WhoopCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const apiKeys        = useStore((s) => s.apiKeys)
  const setWhoopTokens = useStore((s) => s.setWhoopTokens)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code   = params.get('code')
    const err    = params.get('error')

    if (err) {
      setStatus('error')
      setErrorMsg(`Whoop hat den Zugriff verweigert: ${err}`)
      return
    }
    if (!code) {
      setStatus('error')
      setErrorMsg('Kein Authorization Code erhalten.')
      return
    }
    if (!apiKeys.whoopClientId || !apiKeys.whoopClientSecret) {
      setStatus('error')
      setErrorMsg('Client ID oder Secret fehlt. Bitte zuerst unter Profil → API Keys eintragen.')
      return
    }

    exchangeCode(code, apiKeys.whoopClientId, apiKeys.whoopClientSecret)
      .then((tokens) => {
        setWhoopTokens(tokens)
        setStatus('success')
        // Return to app after short delay
        setTimeout(() => { window.location.href = '/' }, 2200)
      })
      .catch((e) => {
        setStatus('error')
        setErrorMsg(e instanceof Error ? e.message : String(e))
      })
  }, [])

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center"
      style={{ background: 'var(--bg)' }}>

      {/* Logo */}
      <div className="text-5xl mb-6">⌚</div>

      {status === 'loading' && (
        <>
          <Loader size={36} className="animate-spin mb-4" style={{ color: '#4a8c5c' }} />
          <h2 className="text-xl font-black mb-2" style={{ color: '#fff' }}>Verbinde mit Whoop…</h2>
          <p className="text-sm" style={{ color: '#666' }}>Tausche Authorization Code gegen Token aus</p>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircle size={48} className="mb-4" style={{ color: '#10b981' }} />
          <h2 className="text-xl font-black mb-2" style={{ color: '#fff' }}>Whoop verbunden! ✅</h2>
          <p className="text-sm mb-6" style={{ color: '#666' }}>Daten werden beim nächsten App-Start automatisch synchronisiert.</p>
          <div className="rounded-2xl px-4 py-3 mb-6"
            style={{ background:'rgba(74,140,92,0.08)', border:'1px solid rgba(74,140,92,0.18)' }}>
            <p className="text-sm font-bold" style={{ color: '#4a8c5c' }}>Weiterleitung in Kürze…</p>
          </div>
          <button onClick={() => window.location.href = '/'}
            className="px-8 py-4 rounded-2xl font-black text-sm"
            style={{ background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#000' }}>
            Zur App →
          </button>
        </>
      )}

      {status === 'error' && (
        <>
          <XCircle size={48} className="mb-4" style={{ color: '#ef4444' }} />
          <h2 className="text-xl font-black mb-2" style={{ color: '#fff' }}>Verbindung fehlgeschlagen</h2>
          <div className="rounded-2xl px-4 py-4 mb-6 text-left max-w-sm"
            style={{ background: '#ffffff', border: '1px solid #333' }}>
            <p className="text-sm font-mono break-all" style={{ color: '#ef4444' }}>{errorMsg}</p>
          </div>
          <button onClick={() => window.location.href = '/'}
            className="px-8 py-4 rounded-2xl font-black text-sm"
            style={{ background:'#ffffff', border:'1px solid #333', color:'#fff' }}>
            ← Zurück zur App
          </button>
        </>
      )}
    </div>
  )
}
