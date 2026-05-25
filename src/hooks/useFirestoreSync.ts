import { useEffect, useRef } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useStore } from '../store/useStore'

export function useFirestoreSync(uid: string | null) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!uid || !db) return

    const schedule = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(async () => {
        const s = useStore.getState()
        try {
          await setDoc(doc(db!, 'users', uid), {
            profile:       s.profile,
            apiKeys:       { anthropic: s.apiKeys.anthropic },
            foodLogs:      s.foodLogs.slice(-500),
            activityLogs:  s.activityLogs.slice(-200),
            weightHistory: s.weightHistory.slice(-365),
            waterLogs:     s.waterLogs.slice(-90),
            runSessions:   s.runSessions.slice(-50),
            cheatDays:     s.cheatDays,
            reminders:     s.reminders,
            updatedAt:     Date.now(),
          }, { merge: true })
        } catch (e) {
          console.error('Firestore sync failed:', e)
        }
      }, 8000)
    }

    // Subscribe to store changes and sync relevant fields only
    const unsub = useStore.subscribe((state, prev) => {
      if (
        state.profile        !== prev.profile        ||
        state.foodLogs       !== prev.foodLogs       ||
        state.activityLogs   !== prev.activityLogs   ||
        state.weightHistory  !== prev.weightHistory  ||
        state.waterLogs      !== prev.waterLogs      ||
        state.runSessions    !== prev.runSessions    ||
        state.apiKeys        !== prev.apiKeys        ||
        state.cheatDays      !== prev.cheatDays      ||
        state.reminders      !== prev.reminders
      ) {
        schedule()
      }
    })

    return () => {
      unsub()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [uid])
}
