import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../lib/firebase'
import { useStore } from '../store/useStore'

export interface CodeAuthCtx {
  code: string | null
  loading: boolean
  revoked: boolean          // stored code was found but deactivated since last login
  isConfigured: boolean
  enterCode: (code: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const Ctx = createContext<CodeAuthCtx | null>(null)

export function useCodeAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useCodeAuth must be inside CodeAuthProvider')
  return c
}

const LS_KEY        = 'kalorilo_access_code'
const LS_ADMIN_CODES = 'kalorilo_admin_codes'

// Normalize: uppercase, no spaces, no leading/trailing whitespace
function normalize(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '')
}

// Check localStorage codes (case-insensitive, checks active flag)
function checkLocalStorage(code: string): 'ok' | 'inactive' | 'not_found' {
  try {
    const list: { code: string; active?: boolean }[] = JSON.parse(localStorage.getItem(LS_ADMIN_CODES) ?? '[]')
    const match = list.find(c => c.code.toUpperCase() === code.toUpperCase())
    if (!match) return 'not_found'
    if (match.active === false) return 'inactive'
    return 'ok'
  } catch { return 'not_found' }
}

type ValidationResult = 'ok' | 'inactive' | 'not_found' | 'offline_fallback'

async function validateCode(code: string): Promise<ValidationResult> {
  // 1. localStorage check first (admin-generated codes, offline mode)
  const local = checkLocalStorage(code)
  if (local === 'ok')       return 'ok'
  if (local === 'inactive') return 'inactive'

  // 2. No Firebase configured → accept any properly formatted code
  if (!db || !isFirebaseConfigured) {
    return code.startsWith('KAL-') && code.length >= 8 ? 'offline_fallback' : 'not_found'
  }

  // 3. Firestore lookup with timeout
  try {
    const snap = await Promise.race([
      getDoc(doc(db, 'adminCodes', code)),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 7000)),
    ])
    if (!snap.exists()) return 'not_found'
    if (snap.data().active === false) return 'inactive'
    return 'ok'
  } catch (e) {
    // Firestore unreachable — allow properly formatted codes to avoid locking users out
    console.warn('[CodeAuth] Firestore unreachable, using fallback:', e)
    return code.startsWith('KAL-') && code.length >= 8 ? 'offline_fallback' : 'not_found'
  }
}

async function loadUserData(code: string) {
  if (!db) return
  try {
    const snap = await Promise.race([
      getDoc(doc(db, 'users', code)),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
    ])
    if (!snap.exists()) return
    const d = snap.data()
    const s = useStore.getState()
    if (d.profile)       s.setProfile(d.profile)
    if (d.apiKeys)       s.setApiKeys(d.apiKeys)
    if (d.foodLogs)      useStore.setState({ foodLogs: d.foodLogs })
    if (d.activityLogs)  useStore.setState({ activityLogs: d.activityLogs })
    if (d.weightHistory) useStore.setState({ weightHistory: d.weightHistory })
    if (d.waterLogs)     useStore.setState({ waterLogs: d.waterLogs })
    if (d.runSessions)   useStore.setState({ runSessions: d.runSessions })
    if (d.cheatDays)     useStore.setState({ cheatDays: d.cheatDays })
    if (d.reminders)     useStore.setState({ reminders: d.reminders })
  } catch (e) {
    console.warn('[CodeAuth] loadUserData failed (non-critical):', e)
  }
}

async function touchCode(code: string) {
  if (!db) return
  try {
    await updateDoc(doc(db, 'adminCodes', code), { lastUsed: Date.now() })
    await setDoc(doc(db, 'users', code), { lastActive: Date.now() }, { merge: true })
  } catch { /* non-critical */ }
}

function errorMessage(result: ValidationResult): string {
  if (result === 'inactive')   return 'Dieser Code wurde deaktiviert. Bitte kontaktiere den Administrator.'
  if (result === 'not_found')  return 'Dieser Code ist ungültig. Bitte prüfe die Schreibweise.'
  return 'Unbekannter Fehler.'
}

export function CodeAuthProvider({ children }: { children: ReactNode }) {
  const [code, setCode]       = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [revoked, setRevoked] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY)
    if (!stored) { setLoading(false); return }

    const normalized = normalize(stored)

    validateCode(normalized).then(async (result) => {
      if (result === 'ok' || result === 'offline_fallback') {
        localStorage.setItem(LS_KEY, normalized)
        setCode(normalized)
        await loadUserData(normalized)
        touchCode(normalized)
      } else {
        localStorage.removeItem(LS_KEY)
        // Show "revoked" message only when code existed but was deactivated
        if (result === 'inactive') setRevoked(true)
      }
      setLoading(false)
    })
  }, [])

  const enterCode = async (raw: string): Promise<{ success: boolean; error?: string }> => {
    const c = normalize(raw)

    if (c.length < 4) {
      return { success: false, error: 'Code zu kurz – mindestens 4 Zeichen.' }
    }

    const result = await validateCode(c)

    if (result === 'not_found' || result === 'inactive') {
      return { success: false, error: errorMessage(result) }
    }

    // Save normalized code to localStorage
    localStorage.setItem(LS_KEY, c)
    setCode(c)

    // Load user data (non-blocking — app shows onboarding if no profile)
    loadUserData(c).catch(() => {})
    touchCode(c)

    return { success: true }
  }

  const logout = () => {
    localStorage.removeItem(LS_KEY)
    setCode(null)
    setRevoked(false)
    useStore.getState().clearUserData()
  }

  return (
    <Ctx.Provider value={{ code, loading, revoked, isConfigured: isFirebaseConfigured, enterCode, logout }}>
      {children}
    </Ctx.Provider>
  )
}
