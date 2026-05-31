import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../lib/firebase'
import { useStore } from '../store/useStore'

export interface CodeAuthCtx {
  code: string | null
  loading: boolean
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

const LS_KEY = 'kalorilo_access_code'

async function loadUserData(code: string) {
  if (!db) return
  try {
    const snap = await getDoc(doc(db, 'users', code))
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
    console.error('[CodeAuth] loadUserData failed:', e)
  }
}

async function validateCode(code: string): Promise<boolean> {
  if (!db) return true // no Firebase → accept any code offline
  try {
    const snap = await getDoc(doc(db, 'adminCodes', code))
    if (!snap.exists()) return false
    if (snap.data().active === false) return false
    return true
  } catch {
    return false
  }
}

async function touchCode(code: string) {
  if (!db) return
  try {
    await updateDoc(doc(db, 'adminCodes', code), { lastUsed: Date.now() })
    await setDoc(doc(db, 'users', code), { lastActive: Date.now() }, { merge: true })
  } catch { /* non-critical */ }
}

export function CodeAuthProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY)
    if (!stored) { setLoading(false); return }

    if (!isFirebaseConfigured) {
      // Firebase not set up → accept stored code as-is (offline mode)
      setCode(stored)
      setLoading(false)
      return
    }

    validateCode(stored).then(async (valid) => {
      if (valid) {
        setCode(stored)
        await loadUserData(stored)
        touchCode(stored)
      } else {
        localStorage.removeItem(LS_KEY)
      }
      setLoading(false)
    })
  }, [])

  const enterCode = async (raw: string): Promise<{ success: boolean; error?: string }> => {
    const c = raw.trim().toUpperCase().replace(/\s/g, '')
    if (c.length < 4) return { success: false, error: 'Code zu kurz – mindestens 4 Zeichen' }

    if (!isFirebaseConfigured) {
      localStorage.setItem(LS_KEY, c)
      setCode(c)
      return { success: true }
    }

    const valid = await validateCode(c)
    if (!valid) return { success: false, error: 'Code nicht gefunden oder deaktiviert' }

    localStorage.setItem(LS_KEY, c)
    setCode(c)
    await loadUserData(c)
    touchCode(c)
    return { success: true }
  }

  const logout = () => {
    localStorage.removeItem(LS_KEY)
    setCode(null)
    useStore.getState().clearUserData()
  }

  return (
    <Ctx.Provider value={{ code, loading, isConfigured: isFirebaseConfigured, enterCode, logout }}>
      {children}
    </Ctx.Provider>
  )
}
