import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { syncWhoopData, refreshAccessToken } from '../lib/whoop'

/** Automatically syncs Whoop data on mount and every 30 minutes */
export function useWhoopSync() {
  const whoopTokens    = useStore((s) => s.whoopTokens)
  const setWhoopTokens = useStore((s) => s.setWhoopTokens)
  const setWhoopData   = useStore((s) => s.setWhoopData)
  const apiKeys        = useStore((s) => s.apiKeys)
  const lastSync       = useRef<number>(0)

  useEffect(() => {
    if (!whoopTokens?.accessToken) return
    if (!apiKeys.whoopClientId || !apiKeys.whoopClientSecret) return

    const doSync = async () => {
      // Throttle: max once per 30 minutes
      if (Date.now() - lastSync.current < 30 * 60 * 1000) return

      try {
        let tokens = whoopTokens

        // Auto-refresh if token expired (or expires in < 5 min)
        if (tokens.expiresAt - Date.now() < 5 * 60 * 1000) {
          tokens = await refreshAccessToken(tokens, apiKeys.whoopClientId, apiKeys.whoopClientSecret)
          setWhoopTokens(tokens)
        }

        const data = await syncWhoopData(tokens.accessToken)
        setWhoopData({
          recovery:     data.recovery,
          hrv:          data.hrv,
          restingHR:    data.restingHR,
          sleepQuality: data.sleepQuality,
          strain:       data.strain,
          date:         data.date,
        })

        // Store extended data back into store-compatible WhoopData
        // (sleepDuration + caloriesBurned stored in whoopExtended)
        useStore.setState({ whoopExtended: data })

        lastSync.current = Date.now()
      } catch (e) {
        console.warn('[WhoopSync]', e)
      }
    }

    doSync()
    const interval = setInterval(doSync, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [whoopTokens?.accessToken])
}
