import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const cfg = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY             ?? '',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN         ?? '',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID          ?? '',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET      ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID              ?? '',
}

export const isFirebaseConfigured = !!(cfg.apiKey && cfg.projectId)

const app = isFirebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(cfg))
  : null

export const auth      = app ? getAuth(app)      : null
export const db        = app ? getFirestore(app) : null
export const gProvider = isFirebaseConfigured ? new GoogleAuthProvider() : null

// Legacy no-ops kept for backward compatibility
export function tryInitFromConfig(_cfg: unknown): boolean { return isFirebaseConfigured }
export function getDb() { return db }
export function isFirebaseReady(): boolean { return !!db }
