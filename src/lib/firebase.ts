import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'

export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

let _app: FirebaseApp | null = null
let _db: Firestore | null = null

export function initFirebase(config: FirebaseConfig): Firestore {
  if (!config.apiKey || !config.projectId) throw new Error('Firebase Konfiguration unvollständig')
  if (!getApps().length) {
    _app = initializeApp(config)
  } else {
    _app = getApps()[0]
  }
  _db = getFirestore(_app)
  return _db
}

export function getDb(): Firestore | null {
  return _db
}

export function isFirebaseReady(): boolean {
  return _db !== null
}

// Versuche beim Start zu initialisieren falls Config im Store vorhanden
export function tryInitFromConfig(config: Partial<FirebaseConfig> | null): boolean {
  if (!config?.apiKey || !config?.projectId) return false
  try {
    initFirebase(config as FirebaseConfig)
    return true
  } catch {
    return false
  }
}
