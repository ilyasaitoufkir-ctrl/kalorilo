import { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, User, Globe } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

type Mode = 'login' | 'register' | 'forgot'

export default function LoginScreen() {
  const { signIn, signUp, signInGoogle, resetPassword } = useAuth()
  const [mode, setMode]       = useState<Mode>('login')
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  const inp = {
    background: 'rgba(74,140,92,0.05)',
    border: '1px solid rgba(125,184,138,0.15)',
    borderRadius: 16,
    color: 'var(--text-1)',
    padding: '14px 16px',
    width: '100%',
    fontSize: 15,
    fontWeight: 600,
    outline: 'none',
  } as const

  const errMsg = (code: string) => {
    const m: Record<string, string> = {
      'auth/user-not-found':       'Kein Konto mit dieser E-Mail.',
      'auth/wrong-password':       'Falsches Passwort.',
      'auth/invalid-credential':   'E-Mail oder Passwort falsch.',
      'auth/email-already-in-use': 'Diese E-Mail wird bereits verwendet.',
      'auth/weak-password':        'Passwort muss mindestens 6 Zeichen haben.',
      'auth/invalid-email':        'Ungültige E-Mail-Adresse.',
      'auth/too-many-requests':    'Zu viele Versuche. Bitte warte kurz.',
    }
    return m[code] ?? 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.'
  }

  const handle = async () => {
    setError(''); setSuccess(''); setLoading(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
      } else if (mode === 'register') {
        if (!name.trim()) { setError('Bitte Namen eingeben.'); return }
        await signUp(name.trim(), email, password)
      } else {
        await resetPassword(email)
        setSuccess('E-Mail gesendet! Prüfe dein Postfach.')
        setMode('login')
      }
    } catch (e: unknown) {
      setError(errMsg((e as { code?: string }).code ?? ''))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError(''); setLoading(true)
    try {
      await signInGoogle()
    } catch (e: unknown) {
      setError(errMsg((e as { code?: string }).code ?? ''))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-dvh overflow-y-auto overflow-x-hidden" style={{ background: 'var(--bg)' }}>
      {/* Gold orb */}
      <div style={{
        position: 'fixed', top: -120, right: -80, width: 320, height: 320, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(circle, rgba(74,140,92,0.18) 0%, transparent 70%)',
      }} />

      <div className="flex flex-col items-center px-5 anim-fade relative z-10"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 48px)', paddingBottom: 'max(env(safe-area-inset-bottom), 32px)' }}>

        {/* Logo */}
        <div className="text-center mb-8">
          <div style={{ fontSize: 72, lineHeight: 1, marginBottom: 12 }}>🥗</div>
          <h1 className="font-black tracking-tight" style={{ fontSize: 36, color: 'var(--text-1)', letterSpacing: -1.5 }}>
            Kalorilo
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 6, fontWeight: 500 }}>
            Dein smarter Ernährungsbegleiter
          </p>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm rounded-3xl p-6" style={{ background: '#ffffff', border: '1px solid rgba(125,184,138,0.2)', boxShadow: '0 4px 24px rgba(74,140,92,0.08)' }}>

          {/* Mode tabs */}
          {mode !== 'forgot' && (
            <div className="flex gap-1 p-1 rounded-2xl mb-6" style={{ background: 'rgba(74,140,92,0.04)', border: '1px solid rgba(74,140,92,0.06)' }}>
              {(['login', 'register'] as const).map((m) => (
                <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={mode === m
                    ? { background: 'var(--grad-gold)', color: '#ffffff' }
                    : { color: 'var(--text-2)' }}>
                  {m === 'login' ? 'Anmelden' : 'Registrieren'}
                </button>
              ))}
            </div>
          )}

          {mode === 'forgot' && (
            <div className="mb-5">
              <button onClick={() => { setMode('login'); setError('') }}
                className="text-sm font-bold glass-press" style={{ color: '#4a8c5c' }}>
                ← Zurück
              </button>
              <h2 className="font-black text-lg mt-2" style={{ color: 'var(--text-1)' }}>Passwort zurücksetzen</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
                Wir senden dir einen Reset-Link.
              </p>
            </div>
          )}

          {/* Form */}
          <div className="space-y-3">

            {/* Name (register only) */}
            {mode === 'register' && (
              <div className="relative">
                <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                <input
                  value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Dein Name"
                  style={{ ...inp, paddingLeft: 42 }}
                  autoComplete="name"
                />
              </div>
            )}

            {/* Email */}
            <div className="relative">
              <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="E-Mail Adresse"
                style={{ ...inp, paddingLeft: 42 }}
                autoComplete="email"
                onKeyDown={(e) => e.key === 'Enter' && mode === 'forgot' && handle()}
              />
            </div>

            {/* Password (not for forgot) */}
            {mode !== 'forgot' && (
              <div className="relative">
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Passwort"
                  style={{ ...inp, paddingLeft: 42, paddingRight: 48 }}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  onKeyDown={(e) => e.key === 'Enter' && handle()}
                />
                <button onClick={() => setShowPw((v) => !v)} type="button"
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            )}

            {/* Error / Success */}
            {error   && <p className="text-sm font-semibold rounded-2xl px-3 py-2.5" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>{error}</p>}
            {success && <p className="text-sm font-semibold rounded-2xl px-3 py-2.5" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>{success}</p>}

            {/* Primary button */}
            <button
              onClick={handle}
              disabled={loading || !email}
              className="w-full font-black rounded-2xl glass-press disabled:opacity-40"
              style={{
                paddingTop: 17, paddingBottom: 17, fontSize: 16,
                background: 'linear-gradient(135deg, #7db88a 0%, #4a8c5c 100%)',
                color: '#ffffff', border: 'none',
                boxShadow: '0 6px 24px rgba(74,140,92,0.3)',
              }}>
              {loading ? '…' : mode === 'login' ? 'Anmelden' : mode === 'register' ? 'Registrieren' : 'Reset-Link senden'}
            </button>

            {/* Forgot password link */}
            {mode === 'login' && (
              <button onClick={() => { setMode('forgot'); setError('') }}
                className="w-full text-center text-sm font-semibold glass-press py-1"
                style={{ color: 'var(--text-3)' }}>
                Passwort vergessen?
              </button>
            )}
          </div>

          {/* Divider + Google */}
          {mode !== 'forgot' && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px" style={{ background: 'rgba(74,140,92,0.08)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>ODER</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(74,140,92,0.08)' }} />
              </div>

              <button
                onClick={handleGoogle}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 font-bold rounded-2xl glass-press disabled:opacity-40"
                style={{
                  paddingTop: 15, paddingBottom: 15, fontSize: 15,
                  background: 'rgba(74,140,92,0.06)',
                  border: '1px solid rgba(125,184,138,0.2)',
                  color: 'var(--text-1)',
                }}>
                <Globe size={20} />
                Mit Google fortfahren
              </button>
            </>
          )}
        </div>

        {/* Bottom note */}
        <p className="mt-6 text-center" style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', lineHeight: 1.6, maxWidth: 280 }}>
          Mit der Registrierung stimmst du unseren Nutzungsbedingungen zu. Deine Daten werden sicher verschlüsselt gespeichert.
        </p>
      </div>
    </div>
  )
}
