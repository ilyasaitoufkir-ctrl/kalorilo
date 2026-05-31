import { useState, useEffect } from 'react'
import { collection, getDocs, setDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../lib/firebase'
import { Shield, Plus, RefreshCw, ToggleLeft, ToggleRight, Trash2, Copy, Check, LogOut, AlertTriangle } from 'lucide-react'

interface CodeRecord {
  code: string
  active: boolean
  createdAt: number
  lastUsed?: number
  note?: string
}

const ADMIN_PW = import.meta.env.VITE_ADMIN_PASSWORD ?? 'kalorilo-admin-2025'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const seg = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `KAL-${seg(4)}-${seg(4)}`
}

function fmtDate(ts?: number) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminPanel() {
  const [authed, setAuthed]     = useState(false)
  const [pw, setPw]             = useState('')
  const [pwErr, setPwErr]       = useState(false)
  const [codes, setCodes]       = useState<CodeRecord[]>([])
  const [loading, setLoading]   = useState(false)
  const [note, setNote]         = useState('')
  const [copied, setCopied]     = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  console.log('[AdminPanel] Firebase configured:', isFirebaseConfigured, '| db:', !!db)

  useEffect(() => {
    const ok = sessionStorage.getItem('kalorilo_admin_ok')
    if (ok === '1') setAuthed(true)
  }, [])

  useEffect(() => {
    if (authed) fetchCodes()
  }, [authed])

  const handleLogin = () => {
    if (pw === ADMIN_PW) {
      sessionStorage.setItem('kalorilo_admin_ok', '1')
      setAuthed(true)
    } else {
      setPwErr(true)
      setTimeout(() => setPwErr(false), 1500)
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('kalorilo_admin_ok')
    setAuthed(false)
    setPw('')
  }

  const fetchCodes = async () => {
    console.log('[AdminPanel] fetchCodes: db =', !!db)
    if (!db) {
      setError('Firebase nicht konfiguriert. Bitte VITE_FIREBASE_* Umgebungsvariablen setzen.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const snap = await getDocs(collection(db, 'adminCodes'))
      console.log('[AdminPanel] fetchCodes: got', snap.size, 'docs')
      const list: CodeRecord[] = snap.docs.map(d => ({ code: d.id, ...(d.data() as Omit<CodeRecord, 'code'>) }))
      list.sort((a, b) => b.createdAt - a.createdAt)
      setCodes(list)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[AdminPanel] fetchCodes failed:', e)
      setError(`Laden fehlgeschlagen: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const createCode = async () => {
    console.log('[AdminPanel] createCode: db =', !!db, 'isFirebaseConfigured =', isFirebaseConfigured)
    if (!db) {
      setError('Firebase nicht konfiguriert – Code kann nicht gespeichert werden.')
      return
    }
    setCreating(true)
    setError(null)
    try {
      const code = generateCode()
      console.log('[AdminPanel] Creating code:', code)
      const rec: Omit<CodeRecord, 'code'> = {
        active: true,
        createdAt: Date.now(),
        ...(note.trim() ? { note: note.trim() } : {}),
      }
      await setDoc(doc(db, 'adminCodes', code), rec)
      console.log('[AdminPanel] Code created successfully:', code)
      setCodes(prev => [{ code, ...rec }, ...prev])
      setNote('')
      copyToClipboard(code)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[AdminPanel] createCode failed:', e)
      setError(`Fehler beim Erstellen: ${msg}`)
    } finally {
      setCreating(false)
    }
  }

  const toggleActive = async (code: string, current: boolean) => {
    if (!db) { setError('Firebase nicht konfiguriert.'); return }
    setError(null)
    try {
      await updateDoc(doc(db, 'adminCodes', code), { active: !current })
      setCodes(prev => prev.map(c => c.code === code ? { ...c, active: !current } : c))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[AdminPanel] toggleActive failed:', e)
      setError(`Fehler: ${msg}`)
    }
  }

  const deleteCode = async (code: string) => {
    if (!db) { setError('Firebase nicht konfiguriert.'); return }
    if (!confirm(`Code ${code} löschen?`)) return
    setError(null)
    try {
      await deleteDoc(doc(db, 'adminCodes', code))
      setCodes(prev => prev.filter(c => c.code !== code))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[AdminPanel] deleteCode failed:', e)
      setError(`Fehler: ${msg}`)
    }
  }

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  if (!authed) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-sm glass p-8 space-y-5" style={{ borderRadius: 28 }}>
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: 'rgba(74,140,92,0.12)', border: '1px solid rgba(74,140,92,0.2)' }}>
              <Shield size={26} style={{ color: '#4a8c5c' }} />
            </div>
            <h1 className="text-xl font-black" style={{ color: 'var(--text-1)' }}>Admin Panel</h1>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Kalorilo Code-Verwaltung</p>
          </div>
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Admin-Passwort"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: pwErr ? '1.5px solid #ef4444' : '1.5px solid rgba(74,140,92,0.2)',
              borderRadius: 16, color: 'var(--text-1)',
              padding: '14px 18px', width: '100%', fontSize: 15, outline: 'none',
              transition: 'border-color 0.2s',
            }}
          />
          {pwErr && <p className="text-xs text-center font-semibold" style={{ color: '#ef4444' }}>❌ Falsches Passwort</p>}
          <button onClick={handleLogin}
            className="w-full py-3.5 rounded-2xl font-black text-base transition-all"
            style={{ background: 'linear-gradient(135deg,#4a8c5c,#7db88a)', color: '#fff' }}>
            Einloggen
          </button>
        </div>
      </div>
    )
  }

  const active   = codes.filter(c => c.active).length
  const inactive = codes.filter(c => !c.active).length

  return (
    <div className="min-h-dvh px-4 py-6 max-w-2xl mx-auto" style={{ background: 'var(--bg)' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(74,140,92,0.12)', border: '1px solid rgba(74,140,92,0.2)' }}>
            <Shield size={20} style={{ color: '#4a8c5c' }} />
          </div>
          <div>
            <h1 className="text-xl font-black" style={{ color: 'var(--text-1)' }}>Admin Panel</h1>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>{active} aktiv · {inactive} inaktiv</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchCodes}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(74,140,92,0.1)', border: '1px solid rgba(74,140,92,0.15)' }}>
            <RefreshCw size={16} style={{ color: '#4a8c5c' }} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleLogout}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <LogOut size={16} style={{ color: '#ef4444' }} />
          </button>
        </div>
      </div>

      {/* Firebase not configured warning */}
      {!isFirebaseConfigured && (
        <div className="glass p-4 mb-4 flex gap-3 items-start" style={{ borderRadius: 16, border: '1px solid rgba(245,158,11,0.3)' }}>
          <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p className="text-sm font-bold" style={{ color: '#f59e0b' }}>Firebase nicht konfiguriert</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              Bitte VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID etc. in Vercel → Settings → Environment Variables setzen und neu deployen.
            </p>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="glass p-3 mb-4 flex gap-3 items-center" style={{ borderRadius: 14, border: '1px solid rgba(239,68,68,0.3)' }}>
          <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
          <p className="text-xs font-semibold flex-1" style={{ color: '#ef4444' }}>{error}</p>
          <button onClick={() => setError(null)} className="text-xs" style={{ color: 'var(--text-3)' }}>✕</button>
        </div>
      )}

      {/* Firestore rules hint */}
      {isFirebaseConfigured && (
        <div className="glass p-3 mb-4" style={{ borderRadius: 14, border: '1px solid rgba(74,140,92,0.15)' }}>
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-2)' }}>Firestore Rules prüfen</p>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            Falls Fehler auftreten: Firebase Console → Firestore → Rules → temporär öffnen:
          </p>
          <pre className="text-xs mt-1 p-2 rounded-lg overflow-x-auto" style={{ background: 'rgba(0,0,0,0.3)', color: '#7db88a' }}>{`match /{document=**} {
  allow read, write: if true;
}`}</pre>
        </div>
      )}

      {/* Create new code */}
      <div className="glass p-4 mb-4 space-y-3" style={{ borderRadius: 20 }}>
        <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Neuen Code erstellen</p>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createCode()}
          placeholder="Notiz (optional, z.B. Nutzername)"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1.5px solid rgba(74,140,92,0.15)',
            borderRadius: 12, color: 'var(--text-1)',
            padding: '10px 14px', width: '100%', fontSize: 14, outline: 'none',
          }}
        />
        <button
          onClick={createCode}
          disabled={creating}
          className="w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#4a8c5c,#7db88a)', color: '#fff' }}
        >
          {creating ? <RefreshCw size={15} className="animate-spin" /> : <Plus size={15} />}
          {creating ? 'Wird erstellt…' : 'Code generieren & kopieren'}
        </button>
      </div>

      {/* Code list */}
      <div className="space-y-2">
        {loading && (
          <p className="text-center text-sm py-4" style={{ color: 'var(--text-3)' }}>
            <RefreshCw size={14} className="inline animate-spin mr-2" />Lade Codes…
          </p>
        )}
        {!loading && codes.length === 0 && !error && (
          <p className="text-center text-sm py-8" style={{ color: 'var(--text-3)' }}>Noch keine Codes vorhanden.</p>
        )}
        {codes.map(c => (
          <div key={c.code} className="glass p-4" style={{ borderRadius: 18, opacity: c.active ? 1 : 0.55 }}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="font-mono font-black text-base tracking-wider" style={{ color: 'var(--text-1)' }}>{c.code}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{
                      background: c.active ? 'rgba(74,140,92,0.15)' : 'rgba(150,150,150,0.12)',
                      color: c.active ? '#4a8c5c' : '#888',
                    }}>
                    {c.active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </div>
                {c.note && <p className="text-xs" style={{ color: 'var(--text-3)' }}>{c.note}</p>}
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                  Erstellt: {fmtDate(c.createdAt)}
                  {c.lastUsed ? ` · Zuletzt: ${fmtDate(c.lastUsed)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => copyToClipboard(c.code)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(74,140,92,0.1)' }}>
                  {copied === c.code
                    ? <Check size={14} style={{ color: '#4a8c5c' }} />
                    : <Copy size={14} style={{ color: '#4a8c5c' }} />}
                </button>
                <button onClick={() => toggleActive(c.code, c.active)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: c.active ? 'rgba(74,140,92,0.1)' : 'rgba(150,150,150,0.1)' }}>
                  {c.active
                    ? <ToggleRight size={18} style={{ color: '#4a8c5c' }} />
                    : <ToggleLeft size={18} style={{ color: '#888' }} />}
                </button>
                <button onClick={() => deleteCode(c.code)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(239,68,68,0.08)' }}>
                  <Trash2 size={14} style={{ color: '#ef4444' }} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
