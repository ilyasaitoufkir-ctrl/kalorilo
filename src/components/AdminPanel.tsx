import { useState, useEffect, useCallback } from 'react'
import {
  collection, getDocs, setDoc, doc, updateDoc, deleteDoc, addDoc, query, orderBy, limit,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../lib/firebase'
import {
  Shield, Plus, RefreshCw, ToggleLeft, ToggleRight, Trash2, Copy, Check,
  LogOut, Wifi, WifiOff, Users, BarChart2, MessageSquare, Key,
  Activity, Send, RotateCcw, AlertTriangle,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────
interface CodeRecord {
  code: string
  active: boolean
  createdAt: number
  lastUsed?: number
  note?: string
}
interface UserRecord {
  code: string
  active: boolean
  name?: string
  goal?: string
  lastActive?: number
  createdAt: number
}
interface Broadcast {
  id: string
  text: string
  createdAt: number
}

// ── Constants ────────────────────────────────────────────────────────────────
const ADMIN_PW = import.meta.env.VITE_ADMIN_PASSWORD ?? 'kalorilo-admin-2025'
const LS_CODES = 'kalorilo_admin_codes'

// ── Helpers ──────────────────────────────────────────────────────────────────
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const seg = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `KAL-${seg(4)}-${seg(4)}`
}
function fmtDate(ts?: number) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function activityLabel(lastActive?: number): { label: string; color: string } {
  if (!lastActive) return { label: 'Nie', color: '#888' }
  const h = (Date.now() - lastActive) / 3600000
  if (h < 24)  return { label: 'Heute', color: '#4a8c5c' }
  if (h < 168) return { label: 'Diese Woche', color: '#f59e0b' }
  return { label: 'Inaktiv', color: '#ef4444' }
}
function goalLabel(goal?: string) {
  if (goal === 'lose')     return 'Abnehmen'
  if (goal === 'gain')     return 'Muskelaufbau'
  if (goal === 'maintain') return 'Halten'
  return '—'
}
function lsLoad(): CodeRecord[] {
  try { return JSON.parse(localStorage.getItem(LS_CODES) ?? '[]') } catch { return [] }
}
function lsSave(codes: CodeRecord[]) { localStorage.setItem(LS_CODES, JSON.stringify(codes)) }
function withTimeout<T>(p: Promise<T>, ms = 6000): Promise<T> {
  return Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error('TIMEOUT')), ms))])
}

// ── Mini bar chart ────────────────────────────────────────────────────────────
function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end gap-1.5" style={{ height: 80 }}>
      {data.map(d => (
        <div key={d.label} className="flex flex-col items-center flex-1 gap-1">
          <div className="w-full rounded-t-lg transition-all"
            style={{ height: `${(d.value / max) * 64}px`, background: d.value > 0 ? 'linear-gradient(180deg,#4a8c5c,#7db88a)' : 'rgba(74,140,92,0.15)', minHeight: 4 }} />
          <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [authed, setAuthed]         = useState(false)
  const [pw, setPw]                 = useState('')
  const [pwErr, setPwErr]           = useState(false)
  const [tab, setTab]               = useState<'stats' | 'users' | 'msgs' | 'codes'>('stats')
  const [firestoreOk, setFirestoreOk] = useState<boolean | null>(null)

  // Codes
  const [codes, setCodes]           = useState<CodeRecord[]>([])
  const [loadingCodes, setLoadingCodes] = useState(false)
  const [note, setNote]             = useState('')
  const [creating, setCreating]     = useState(false)
  const [copied, setCopied]         = useState<string | null>(null)
  const [codeError, setCodeError]   = useState<string | null>(null)

  // Users
  const [users, setUsers]           = useState<UserRecord[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Broadcasts
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [msgText, setMsgText]       = useState('')
  const [sending, setSending]       = useState(false)
  const [msgSent, setMsgSent]       = useState(false)

  useEffect(() => {
    const ok = sessionStorage.getItem('kalorilo_admin_ok')
    if (ok === '1') setAuthed(true)
  }, [])

  useEffect(() => {
    if (authed) { fetchCodes(); fetchUsers(); fetchBroadcasts() }
  }, [authed])

  // ── Codes ─────────────────────────────────────────────────────────────────
  const fetchCodes = useCallback(async () => {
    setLoadingCodes(true)
    const local = lsLoad()
    if (!db || !isFirebaseConfigured) {
      setFirestoreOk(false); setCodes(local); setLoadingCodes(false); return
    }
    try {
      const snap = await withTimeout(getDocs(collection(db, 'adminCodes')))
      const remote: CodeRecord[] = snap.docs.map(d => ({ code: d.id, ...(d.data() as Omit<CodeRecord,'code'>) }))
      remote.sort((a, b) => b.createdAt - a.createdAt)
      setFirestoreOk(true)
      const remoteSet = new Set(remote.map(c => c.code))
      setCodes([...remote, ...local.filter(c => !remoteSet.has(c.code))])
    } catch {
      setFirestoreOk(false); setCodes(local)
    } finally { setLoadingCodes(false) }
  }, [])

  const createCode = async () => {
    setCreating(true); setCodeError(null)
    const code = generateCode()
    const rec: CodeRecord = { code, active: true, createdAt: Date.now(), ...(note.trim() ? { note: note.trim() } : {}) }
    lsSave([rec, ...lsLoad()])
    setCodes(prev => [rec, ...prev])
    setNote(''); copyToClipboard(code)
    if (db) {
      try {
        await withTimeout(setDoc(doc(db, 'adminCodes', code), { active: rec.active, createdAt: rec.createdAt, ...(rec.note ? { note: rec.note } : {}) }))
        setFirestoreOk(true)
      } catch { setFirestoreOk(false) }
    }
    setCreating(false)
  }

  const toggleCode = async (code: string, current: boolean) => {
    setCodes(prev => prev.map(c => c.code === code ? { ...c, active: !current } : c))
    lsSave(lsLoad().map(c => c.code === code ? { ...c, active: !current } : c))
    if (db) { try { await withTimeout(updateDoc(doc(db, 'adminCodes', code), { active: !current })) } catch {} }
  }

  const deleteCode = async (code: string) => {
    if (!confirm(`Code ${code} löschen?`)) return
    setCodes(prev => prev.filter(c => c.code !== code))
    lsSave(lsLoad().filter(c => c.code !== code))
    if (db) { try { await withTimeout(deleteDoc(doc(db, 'adminCodes', code))) } catch {} }
  }

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopied(code); setTimeout(() => setCopied(null), 2000)
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true)
    const codeList = lsLoad()
    if (!db) {
      setUsers(codeList.map(c => ({ code: c.code, active: c.active, createdAt: c.createdAt, lastActive: c.lastUsed })))
      setLoadingUsers(false); return
    }
    try {
      // Load codes from Firestore
      const codesSnap = await withTimeout(getDocs(collection(db, 'adminCodes')))
      const allCodes = codesSnap.docs.map(d => ({ id: d.id, ...d.data() as Omit<CodeRecord,'code'> }))
      // Load user profiles (parallel)
      const userDocs = await Promise.allSettled(
        allCodes.map(c => withTimeout(import('firebase/firestore').then(({ getDoc, doc: fiDoc }) => getDoc(fiDoc(db!, 'users', c.id)))))
      )
      const result: UserRecord[] = allCodes.map((c, i) => {
        const settled = userDocs[i]
        let name: string | undefined
        let goal: string | undefined
        let lastActive: number | undefined
        if (settled.status === 'fulfilled') {
          const snap = settled.value
          if (snap.exists()) {
            const d = snap.data()
            name = d.profile?.name
            goal = d.profile?.goal
            lastActive = d.lastActive ?? c.lastUsed
          } else {
            lastActive = c.lastUsed
          }
        } else {
          lastActive = c.lastUsed
        }
        return { code: c.id, active: c.active, createdAt: c.createdAt, name, goal, lastActive }
      })
      result.sort((a, b) => (b.lastActive ?? 0) - (a.lastActive ?? 0))
      setUsers(result)
    } catch {
      setUsers(codeList.map(c => ({ code: c.code, active: c.active, createdAt: c.createdAt, lastActive: c.lastUsed })))
    } finally { setLoadingUsers(false) }
  }, [])

  const resetUserData = async (code: string) => {
    if (!confirm(`Nutzerdaten für ${code} zurücksetzen? Dies kann nicht rückgängig gemacht werden.`)) return
    if (!db) return
    try {
      await withTimeout(setDoc(doc(db, 'users', code), { lastActive: Date.now(), profile: null }, { merge: false }))
      alert('Daten zurückgesetzt.')
    } catch (e) { alert('Fehler: ' + String(e)) }
  }

  // ── Broadcasts ────────────────────────────────────────────────────────────
  const fetchBroadcasts = useCallback(async () => {
    if (!db) return
    try {
      const snap = await withTimeout(getDocs(query(collection(db, 'broadcasts'), orderBy('createdAt', 'desc'), limit(20))))
      setBroadcasts(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Broadcast,'id'>) })))
    } catch {}
  }, [])

  const sendBroadcast = async () => {
    if (!msgText.trim()) return
    setSending(true)
    try {
      if (db) {
        await withTimeout(addDoc(collection(db, 'broadcasts'), { text: msgText.trim(), createdAt: Date.now() }))
      }
      setBroadcasts(prev => [{ id: Date.now().toString(), text: msgText.trim(), createdAt: Date.now() }, ...prev])
      setMsgText(''); setMsgSent(true); setTimeout(() => setMsgSent(false), 2500)
    } catch (e) { alert('Fehler: ' + String(e)) }
    finally { setSending(false) }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const now = Date.now()
  const activeToday  = users.filter(u => u.lastActive && now - u.lastActive < 86400000).length
  const activeWeek   = users.filter(u => u.lastActive && now - u.lastActive < 604800000).length
  const totalActive  = codes.filter(c => c.active).length
  const lastUser     = users.find(u => u.lastActive)

  // 7-day chart
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const end   = start + 86400000
    return {
      label: d.toLocaleDateString('de-DE', { weekday: 'short' }),
      value: users.filter(u => u.lastActive && u.lastActive >= start && u.lastActive < end).length,
    }
  })

  // ── Login ──────────────────────────────────────────────────────────────────
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
          <input type="password" value={pw} onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (() => {
              if (pw === ADMIN_PW) { sessionStorage.setItem('kalorilo_admin_ok','1'); setAuthed(true) }
              else { setPwErr(true); setTimeout(() => setPwErr(false), 1500) }
            })()}
            placeholder="Admin-Passwort"
            style={{ background: 'rgba(255,255,255,0.05)', border: pwErr ? '1.5px solid #ef4444' : '1.5px solid rgba(74,140,92,0.2)', borderRadius: 16, color: 'var(--text-1)', padding: '14px 18px', width: '100%', fontSize: 15, outline: 'none' }} />
          {pwErr && <p className="text-xs text-center font-semibold" style={{ color: '#ef4444' }}>❌ Falsches Passwort</p>}
          <button onClick={() => {
            if (pw === ADMIN_PW) { sessionStorage.setItem('kalorilo_admin_ok','1'); setAuthed(true) }
            else { setPwErr(true); setTimeout(() => setPwErr(false), 1500) }
          }} className="w-full py-3.5 rounded-2xl font-black text-base"
            style={{ background: 'linear-gradient(135deg,#4a8c5c,#7db88a)', color: '#fff' }}>
            Einloggen
          </button>
        </div>
      </div>
    )
  }

  // ── Panel ──────────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'stats', icon: BarChart2, label: 'Stats' },
    { id: 'users', icon: Users,     label: 'Nutzer' },
    { id: 'msgs',  icon: MessageSquare, label: 'Nachricht' },
    { id: 'codes', icon: Key,       label: 'Codes' },
  ] as const

  return (
    <div className="min-h-dvh max-w-2xl mx-auto pb-24" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-3">
        <div className="flex items-center gap-2">
          <Shield size={20} style={{ color: '#4a8c5c' }} />
          <h1 className="text-lg font-black" style={{ color: 'var(--text-1)' }}>Admin Panel</h1>
          {firestoreOk !== null && (
            firestoreOk
              ? <Wifi size={13} style={{ color: '#4a8c5c' }} />
              : <WifiOff size={13} style={{ color: '#f59e0b' }} />
          )}
        </div>
        <button onClick={() => { sessionStorage.removeItem('kalorilo_admin_ok'); setAuthed(false); setPw('') }}
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,0.1)' }}>
          <LogOut size={15} style={{ color: '#ef4444' }} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mx-4 mb-4 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        {TABS.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all"
            style={{ background: tab === id ? 'rgba(74,140,92,0.15)' : 'transparent' }}>
            <Icon size={16} style={{ color: tab === id ? '#4a8c5c' : 'var(--text-3)' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: tab === id ? '#4a8c5c' : 'var(--text-3)' }}>{label}</span>
          </button>
        ))}
      </div>

      <div className="px-4 space-y-3">

        {/* ── STATS ─────────────────────────────────────────────────── */}
        {tab === 'stats' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Gesamt Nutzer', value: codes.length, icon: Users },
                { label: 'Aktive Codes', value: totalActive, icon: Key },
                { label: 'Aktiv heute', value: activeToday, icon: Activity },
                { label: 'Aktiv diese Woche', value: activeWeek, icon: Activity },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="glass p-4" style={{ borderRadius: 18 }}>
                  <Icon size={16} style={{ color: '#4a8c5c', marginBottom: 6 }} />
                  <p className="text-2xl font-black" style={{ color: 'var(--text-1)' }}>{value}</p>
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>{label}</p>
                </div>
              ))}
            </div>

            {/* 7-day chart */}
            <div className="glass p-4" style={{ borderRadius: 18 }}>
              <p className="text-sm font-bold mb-3" style={{ color: 'var(--text-1)' }}>Aktive Nutzer – letzte 7 Tage</p>
              <BarChart data={chartData} />
            </div>

            {/* Last active user */}
            {lastUser && (
              <div className="glass p-4" style={{ borderRadius: 18 }}>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-3)' }}>Zuletzt aktiv</p>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold" style={{ color: 'var(--text-1)' }}>
                    {lastUser.name ?? lastUser.code}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>{fmtDate(lastUser.lastActive)}</span>
                </div>
              </div>
            )}

            {users.length === 0 && (
              <button onClick={fetchUsers} className="w-full py-3 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(74,140,92,0.1)', color: '#4a8c5c' }}>
                Nutzerdaten laden
              </button>
            )}
          </>
        )}

        {/* ── USERS ─────────────────────────────────────────────────── */}
        {tab === 'users' && (
          <>
            <div className="flex gap-2">
              <button onClick={fetchUsers}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1"
                style={{ background: 'rgba(74,140,92,0.1)', color: '#4a8c5c' }}>
                <RefreshCw size={13} className={loadingUsers ? 'animate-spin' : ''} /> Aktualisieren
              </button>
            </div>

            {loadingUsers && (
              <p className="text-center text-sm py-4" style={{ color: 'var(--text-3)' }}>
                <RefreshCw size={14} className="inline animate-spin mr-1" /> Lade Nutzerdaten…
              </p>
            )}

            {users.map(u => {
              const act = activityLabel(u.lastActive)
              return (
                <div key={u.code} className="glass p-4" style={{ borderRadius: 18, opacity: u.active ? 1 : 0.5 }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-mono font-black text-sm" style={{ color: 'var(--text-1)' }}>{u.code}</span>
                        {u.name && <span className="text-xs font-semibold" style={{ color: '#4a8c5c' }}>{u.name}</span>}
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                          style={{ background: `${act.color}22`, color: act.color }}>
                          {act.label}
                        </span>
                      </div>
                      <div className="flex gap-3 text-xs" style={{ color: 'var(--text-3)' }}>
                        <span>Ziel: {goalLabel(u.goal)}</span>
                        <span>Login: {fmtDate(u.lastActive)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => toggleCode(u.code, u.active)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: u.active ? 'rgba(74,140,92,0.1)' : 'rgba(150,150,150,0.1)' }}>
                        {u.active ? <ToggleRight size={14} style={{ color: '#4a8c5c' }} /> : <ToggleLeft size={14} style={{ color: '#888' }} />}
                      </button>
                      <button onClick={() => resetUserData(u.code)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(239,68,68,0.08)' }}
                        title="Daten zurücksetzen">
                        <RotateCcw size={12} style={{ color: '#ef4444' }} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            {!loadingUsers && users.length === 0 && (
              <p className="text-center text-sm py-8" style={{ color: 'var(--text-3)' }}>Keine Nutzer gefunden.</p>
            )}
          </>
        )}

        {/* ── MESSAGES ──────────────────────────────────────────────── */}
        {tab === 'msgs' && (
          <>
            <div className="glass p-4 space-y-3" style={{ borderRadius: 20 }}>
              <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Nachricht an alle Nutzer</p>
              <textarea
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                placeholder="Nachricht eingeben…"
                rows={3}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(74,140,92,0.15)',
                  borderRadius: 12, color: 'var(--text-1)', padding: '10px 14px',
                  width: '100%', fontSize: 14, outline: 'none', resize: 'none',
                }}
              />
              <button onClick={sendBroadcast} disabled={sending || !msgText.trim() || !db}
                className="w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#4a8c5c,#7db88a)', color: '#fff' }}>
                {msgSent ? <><Check size={15} />Gesendet!</> : sending ? <><RefreshCw size={15} className="animate-spin" />Senden…</> : <><Send size={15} />An alle schicken</>}
              </button>
              {!db && <p className="text-xs text-center" style={{ color: '#f59e0b' }}>Nachrichten benötigen eine Firestore-Verbindung.</p>}
            </div>

            <p className="text-xs font-semibold px-1" style={{ color: 'var(--text-3)' }}>Gesendete Nachrichten</p>
            {broadcasts.length === 0 && (
              <p className="text-center text-sm py-6" style={{ color: 'var(--text-3)' }}>Noch keine Nachrichten gesendet.</p>
            )}
            {broadcasts.map(b => (
              <div key={b.id} className="glass p-3" style={{ borderRadius: 16 }}>
                <p className="text-sm" style={{ color: 'var(--text-1)' }}>📢 {b.text}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{fmtDate(b.createdAt)}</p>
              </div>
            ))}
          </>
        )}

        {/* ── CODES ─────────────────────────────────────────────────── */}
        {tab === 'codes' && (
          <>
            {firestoreOk === false && (
              <div className="glass p-3 flex gap-2 items-start" style={{ borderRadius: 14, border: '1px solid rgba(245,158,11,0.25)' }}>
                <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                <p className="text-xs" style={{ color: '#f59e0b' }}>
                  <strong>Offline-Modus:</strong> Codes werden lokal gespeichert.
                </p>
              </div>
            )}
            {codeError && (
              <div className="glass p-3 flex gap-2 items-center" style={{ borderRadius: 14, border: '1px solid rgba(239,68,68,0.25)' }}>
                <AlertTriangle size={14} style={{ color: '#ef4444' }} />
                <p className="text-xs flex-1" style={{ color: '#ef4444' }}>{codeError}</p>
                <button onClick={() => setCodeError(null)} style={{ fontSize: 12, color: 'var(--text-3)' }}>✕</button>
              </div>
            )}

            {/* Create */}
            <div className="glass p-4 space-y-3" style={{ borderRadius: 20 }}>
              <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Neuen Code erstellen</p>
              <input value={note} onChange={e => setNote(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createCode()}
                placeholder="Notiz (optional, z.B. Nutzername)"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(74,140,92,0.15)', borderRadius: 12, color: 'var(--text-1)', padding: '10px 14px', width: '100%', fontSize: 14, outline: 'none' }} />
              <button onClick={createCode} disabled={creating}
                className="w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#4a8c5c,#7db88a)', color: '#fff' }}>
                {creating ? <><RefreshCw size={15} className="animate-spin" />Wird erstellt…</> : <><Plus size={15} />Code generieren & kopieren</>}
              </button>
            </div>

            {/* List */}
            <div className="flex gap-2">
              <button onClick={fetchCodes}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1"
                style={{ background: 'rgba(74,140,92,0.1)', color: '#4a8c5c' }}>
                <RefreshCw size={13} className={loadingCodes ? 'animate-spin' : ''} /> Aktualisieren
              </button>
            </div>

            {codes.length === 0 && !loadingCodes && (
              <p className="text-center text-sm py-8" style={{ color: 'var(--text-3)' }}>Noch keine Codes vorhanden.</p>
            )}
            {codes.map(c => (
              <div key={c.code} className="glass p-4" style={{ borderRadius: 18, opacity: c.active ? 1 : 0.55 }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-mono font-black text-base tracking-wider" style={{ color: 'var(--text-1)' }}>{c.code}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: c.active ? 'rgba(74,140,92,0.15)' : 'rgba(150,150,150,0.12)', color: c.active ? '#4a8c5c' : '#888' }}>
                        {c.active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </div>
                    {c.note && <p className="text-xs" style={{ color: 'var(--text-3)' }}>{c.note}</p>}
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                      Erstellt: {fmtDate(c.createdAt)}{c.lastUsed ? ` · Zuletzt: ${fmtDate(c.lastUsed)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => copyToClipboard(c.code)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(74,140,92,0.1)' }}>
                      {copied === c.code ? <Check size={14} style={{ color: '#4a8c5c' }} /> : <Copy size={14} style={{ color: '#4a8c5c' }} />}
                    </button>
                    <button onClick={() => toggleCode(c.code, c.active)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: c.active ? 'rgba(74,140,92,0.1)' : 'rgba(150,150,150,0.1)' }}>
                      {c.active ? <ToggleRight size={18} style={{ color: '#4a8c5c' }} /> : <ToggleLeft size={18} style={{ color: '#888' }} />}
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
          </>
        )}
      </div>
    </div>
  )
}
