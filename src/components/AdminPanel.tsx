import { useState, useEffect } from 'react'
import { collection, getDocs, setDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { Shield, Plus, RefreshCw, ToggleLeft, ToggleRight, Trash2, Copy, Check, LogOut } from 'lucide-react'

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
  return new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function AdminPanel() {
  const [authed, setAuthed]   = useState(false)
  const [pw, setPw]           = useState('')
  const [pwErr, setPwErr]     = useState(false)
  const [codes, setCodes]     = useState<CodeRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [note, setNote]       = useState('')
  const [copied, setCopied]   = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

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
    if (!db) return
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'adminCodes'))
      const list: CodeRecord[] = snap.docs.map(d => ({ code: d.id, ...(d.data() as Omit<CodeRecord, 'code'>) }))
      list.sort((a, b) => b.createdAt - a.createdAt)
      setCodes(list)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const createCode = async () => {
    if (!db) return
    setCreating(true)
    try {
      const code = generateCode()
      const rec: Omit<CodeRecord, 'code'> = { active: true, createdAt: Date.now(), note: note.trim() || undefined }
      await setDoc(doc(db, 'adminCodes', code), rec)
      setCodes(prev => [{ code, ...rec }, ...prev])
      setNote('')
      copyToClipboard(code)
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  const toggleActive = async (code: string, current: boolean) => {
    if (!db) return
    try {
      await updateDoc(doc(db, 'adminCodes', code), { active: !current })
      setCodes(prev => prev.map(c => c.code === code ? { ...c, active: !current } : c))
    } catch (e) { console.error(e) }
  }

  const deleteCode = async (code: string) => {
    if (!db) return
    if (!confirm(`Code ${code} löschen?`)) return
    try {
      await deleteDoc(doc(db, 'adminCodes', code))
      setCodes(prev => prev.filter(c => c.code !== code))
    } catch (e) { console.error(e) }
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

  const active = codes.filter(c => c.active).length
  const inactive = codes.filter(c => !c.active).length

  return (
    <div className="min-h-dvh px-4 py-6 max-w-2xl mx-auto" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
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

      {/* Create new code */}
      <div className="glass p-4 mb-4 space-y-3" style={{ borderRadius: 20 }}>
        <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Neuen Code erstellen</p>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Notiz (optional, z.B. Nutzername)"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1.5px solid rgba(74,140,92,0.15)',
            borderRadius: 12, color: 'var(--text-1)',
            padding: '10px 14px', width: '100%', fontSize: 14, outline: 'none',
          }}
        />
        <button onClick={createCode} disabled={creating}
          className="w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#4a8c5c,#7db88a)', color: '#fff' }}>
          {creating ? <RefreshCw size={15} className="animate-spin" /> : <Plus size={15} />}
          Code generieren & kopieren
        </button>
      </div>

      {/* Code list */}
      <div className="space-y-2">
        {codes.length === 0 && !loading && (
          <p className="text-center text-sm py-8" style={{ color: 'var(--text-3)' }}>Noch keine Codes vorhanden.</p>
        )}
        {codes.map(c => (
          <div key={c.code} className="glass p-4" style={{ borderRadius: 18, opacity: c.active ? 1 : 0.55 }}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono font-black text-base tracking-wider" style={{ color: 'var(--text-1)' }}>{c.code}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: c.active ? 'rgba(74,140,92,0.15)' : 'rgba(150,150,150,0.12)', color: c.active ? '#4a8c5c' : '#888' }}>
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
                  {copied === c.code ? <Check size={14} style={{ color: '#4a8c5c' }} /> : <Copy size={14} style={{ color: '#4a8c5c' }} />}
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
