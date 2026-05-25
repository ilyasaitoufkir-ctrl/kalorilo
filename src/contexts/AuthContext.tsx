import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db, gProvider, isFirebaseConfigured } from '../lib/firebase'
import { useStore } from '../store/useStore'

interface AuthCtx {
  user: User | null
  loading: boolean
  isConfigured: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<void>
  signInGoogle: () => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth must be inside AuthProvider')
  return c
}

async function loadUserData(uid: string) {
  if (!db) return
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    if (!snap.exists()) return
    const d = snap.data()
    const s = useStore.getState()
    if (d.profile)        s.setProfile(d.profile)
    if (d.apiKeys)        s.setApiKeys(d.apiKeys)
    if (d.foodLogs)       useStore.setState({ foodLogs: d.foodLogs })
    if (d.activityLogs)   useStore.setState({ activityLogs: d.activityLogs })
    if (d.weightHistory)  useStore.setState({ weightHistory: d.weightHistory })
    if (d.waterLogs)      useStore.setState({ waterLogs: d.waterLogs })
    if (d.runSessions)    useStore.setState({ runSessions: d.runSessions })
    if (d.cheatDays)      useStore.setState({ cheatDays: d.cheatDays })
    if (d.reminders)      useStore.setState({ reminders: d.reminders })
  } catch (e) {
    console.error('loadUserData failed:', e)
  }
}

const blankProfile = {
  name: '', age: 25, weight: 75, height: 175,
  gender: 'male' as const, activityLevel: 'moderate' as const,
  goal: 'lose' as const, targetWeight: 70, targetWeeks: 12,
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const initialized = useRef(false)

  useEffect(() => {
    if (!auth) { setLoading(false); return }

    // Handle Google redirect result (iOS Safari fallback)
    getRedirectResult(auth).catch(() => {})

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u)
        if (!initialized.current) {
          initialized.current = true
          await loadUserData(u.uid)
        }
      } else {
        setUser(null)
        initialized.current = false
        useStore.getState().clearUserData()
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase nicht konfiguriert')
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signUp = async (name: string, email: string, password: string) => {
    if (!auth || !db) throw new Error('Firebase nicht konfiguriert')
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName: name })
    await setDoc(doc(db, 'users', cred.user.uid), {
      profile: { ...blankProfile, name },
      createdAt: Date.now(),
    }, { merge: true })
  }

  const signInGoogle = async () => {
    if (!auth || !gProvider) throw new Error('Firebase nicht konfiguriert')
    try {
      const cred = await signInWithPopup(auth, gProvider)
      if (db) {
        const ref = doc(db, 'users', cred.user.uid)
        const snap = await getDoc(ref)
        if (!snap.exists()) {
          await setDoc(ref, {
            profile: { ...blankProfile, name: cred.user.displayName ?? '' },
            createdAt: Date.now(),
          })
        }
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user') {
        await signInWithRedirect(auth, gProvider)
      } else {
        throw err
      }
    }
  }

  const signOut = async () => {
    if (!auth) return
    await fbSignOut(auth)
  }

  const resetPassword = async (email: string) => {
    if (!auth) throw new Error('Firebase nicht konfiguriert')
    await sendPasswordResetEmail(auth, email)
  }

  return (
    <Ctx.Provider value={{
      user, loading, isConfigured: isFirebaseConfigured,
      signIn, signUp, signInGoogle, signOut, resetPassword,
    }}>
      {children}
    </Ctx.Provider>
  )
}
