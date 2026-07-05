import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import {
  syncWhoopData,
  syncWhoopHistory,
  fetchTodayWorkouts,
  refreshAccessToken,
} from '../lib/whoop'
import { formatDate } from '../utils/calculations'

const SYNC_INTERVAL    = 5 * 60 * 1000    // 5 minutes
const THROTTLE_MS      = 4.5 * 60 * 1000  // prevent double-sync
const HISTORY_INTERVAL = 30 * 60 * 1000   // history every 30 min

// Whoop sport_id → local SportActivity id (best-effort mapping)
const WHOOP_SPORT_MAP: Record<number, string> = {
  0:   'sp1',   // Running
  1:   'sp2',   // Strength
  16:  'sp3',   // Cycling
  18:  'sp4',   // Swimming
  39:  'sp12',  // HIIT
  71:  'sp24',  // Spinning
  44:  'sp10',  // Yoga
  126: 'sp13',  // CrossFit
  52:  'sp1',   // Walking → Running fallback
}

const WHOOP_SPORT_NAMES: Record<number, string> = {
  0: 'Laufen', 1: 'Krafttraining', 16: 'Radfahren', 18: 'Schwimmen',
  39: 'HIIT', 71: 'Spinning', 44: 'Yoga', 126: 'CrossFit',
  52: 'Spazierengehen',
}

export function useWhoopSync() {
  const whoopTokens     = useStore((s) => s.whoopTokens)
  const setWhoopTokens  = useStore((s) => s.setWhoopTokens)
  const setWhoopData    = useStore((s) => s.setWhoopData)
  const setWhoopHistory = useStore((s) => s.setWhoopHistory)
  const apiKeys         = useStore((s) => s.apiKeys)
  const addActivityLog  = useStore((s) => s.addActivityLog)
  const lastSync        = useRef<number>(0)
  const lastHistorySync = useRef<number>(0)

  useEffect(() => {
    if (!whoopTokens?.accessToken) return
    if (!apiKeys.whoopClientId || !apiKeys.whoopClientSecret) return

    const getValidTokens = async () => {
      let tokens = whoopTokens
      if (tokens.expiresAt - Date.now() < 5 * 60 * 1000) {
        tokens = await refreshAccessToken(tokens, apiKeys.whoopClientId, apiKeys.whoopClientSecret)
        setWhoopTokens(tokens)
      }
      return tokens
    }

    const doSync = async () => {
      if (Date.now() - lastSync.current < THROTTLE_MS) return
      try {
        const tokens = await getValidTokens()
        const data   = await syncWhoopData(tokens.accessToken)

        setWhoopData({
          recovery:        data.recovery,
          hrv:             data.hrv,
          restingHR:       data.restingHR,
          sleepQuality:    data.sleepQuality,
          strain:          data.strain,
          date:            data.date,
          sleepDuration:   data.sleepDuration,
          deepSleep:       data.deepSleep,
          remSleep:        data.remSleep,
          respiratoryRate: data.respiratoryRate,
          caloriesBurned:  data.caloriesBurned,
          dailyBurn:       data.dailyBurn,
        })

        // Keep whoopExtended in sync for backward compat
        useStore.setState({
          whoopExtended: {
            sleepDuration:  data.sleepDuration,
            caloriesBurned: data.caloriesBurned,
            date:           data.date,
          },
          whoopLastSyncAt: Date.now(),
        })

        lastSync.current = Date.now()

        // Auto-import today's workouts
        await importTodayWorkouts(tokens.accessToken)

      } catch (e) {
        console.warn('[WhoopSync]', e)
      }
    }

    const doHistorySync = async () => {
      if (Date.now() - lastHistorySync.current < HISTORY_INTERVAL) return
      try {
        const tokens  = await getValidTokens()
        const history = await syncWhoopHistory(tokens.accessToken, 7)
        if (history.length > 0) setWhoopHistory(history)
        lastHistorySync.current = Date.now()
      } catch (e) {
        console.warn('[WhoopHistorySync]', e)
      }
    }

    const importTodayWorkouts = async (accessToken: string) => {
      try {
        const workouts    = await fetchTodayWorkouts(accessToken)
        const today       = formatDate()
        const state       = useStore.getState()
        const existingIds = new Set(state.activityLogs.map((l) => l.id))

        for (const w of workouts) {
          const logId = `whoop-${w.id}`
          if (existingIds.has(logId)) continue
          if (w.caloriesBurned <= 0) continue

          const sportName = WHOOP_SPORT_NAMES[w.sportId] ?? 'Whoop Workout'
          const duration  = w.start && w.end
            ? Math.round((new Date(w.end).getTime() - new Date(w.start).getTime()) / 60000)
            : 30

          addActivityLog({
            id: logId,
            date: today,
            sport: {
              id:       WHOOP_SPORT_MAP[w.sportId] ?? 'sp2',
              name:     sportName,
              icon:     '⌚',
              metLight: 5, metMedium: 8, metIntense: 11,
              category: 'Whoop',
            },
            duration,
            intensity: w.strain > 14 ? 'intense' : w.strain > 8 ? 'medium' : 'light',
            caloriesBurned: w.caloriesBurned,
            timestamp: new Date(w.start || Date.now()).getTime(),
          })
        }
      } catch { /* non-critical */ }
    }

    // Initial sync
    doSync()
    doHistorySync()

    // Every 5 minutes: data sync
    const syncInterval    = setInterval(doSync, SYNC_INTERVAL)
    // Every 30 minutes: history sync
    const historyInterval = setInterval(doHistorySync, HISTORY_INTERVAL)

    return () => {
      clearInterval(syncInterval)
      clearInterval(historyInterval)
    }
  }, [whoopTokens?.accessToken])
}
