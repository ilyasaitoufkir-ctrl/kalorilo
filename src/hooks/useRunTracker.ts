import { useState, useRef, useCallback, useEffect } from 'react'
import type { GeoPoint, KmSplit } from '../types'

export type RunStatus = 'idle' | 'running' | 'paused' | 'finished'

export interface RunTrackerState {
  status: RunStatus
  elapsed: number       // active seconds (pauses excluded)
  distance: number      // km
  route: GeoPoint[]
  splits: KmSplit[]
  elevationGain: number // m
  currentPace: number   // sec/km (recent window)
  avgPace: number       // sec/km (overall)
  calories: number
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const INIT: RunTrackerState = {
  status: 'idle', elapsed: 0, distance: 0, route: [],
  splits: [], elevationGain: 0, currentPace: 0, avgPace: 0, calories: 0,
}

export function useRunTracker(weightKg: number) {
  const [state, setState] = useState<RunTrackerState>(INIT)

  // All mutable values GPS callback needs live in refs to avoid stale closures
  const statusRef        = useRef<RunStatus>('idle')
  const watchIdRef       = useRef<number | null>(null)
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const wakeLockRef      = useRef<WakeLockSentinel | null>(null)
  const lastPointRef     = useRef<GeoPoint | null>(null)
  const elapsedRef       = useRef(0)
  const distRef          = useRef(0)
  const elevRef          = useRef(0)
  const splitDistRef     = useRef(0)  // partial km since last full split
  const splitTimeRef     = useRef(0)  // elapsed at start of current km
  const recentRef        = useRef<{ dist: number; elapsed: number }[]>([])
  const splitsRef        = useRef<KmSplit[]>([])
  const routeRef         = useRef<GeoPoint[]>([])

  const acquireWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
      }
    } catch { /* not supported */ }
  }

  const releaseWakeLock = () => {
    wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
  }

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  const stopGps = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }

  const startTimer = () => {
    stopTimer()
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1
      setState(s => ({ ...s, elapsed: elapsedRef.current }))
    }, 1000)
  }

  const onPosition = useCallback((pos: GeolocationPosition) => {
    if (statusRef.current !== 'running') return

    const point: GeoPoint = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      altitude: pos.coords.altitude ?? undefined,
      accuracy: pos.coords.accuracy,
      timestamp: pos.timestamp,
    }

    const prev = lastPointRef.current
    let addedDist = 0

    if (prev && (point.accuracy ?? 999) < 60) {
      const d = haversine(prev.lat, prev.lng, point.lat, point.lng)
      const dtSec = (point.timestamp - prev.timestamp) / 1000
      // Reject GPS jumps: max realistic running speed ~10 m/s (36 km/h)
      if (dtSec > 0 && (d * 1000) / dtSec < 10) {
        addedDist = d
      }
      // Elevation gain (only upward, min 0.5m to filter noise)
      if (point.altitude != null && prev.altitude != null && point.altitude > prev.altitude + 0.5) {
        elevRef.current += point.altitude - prev.altitude
      }
    }

    lastPointRef.current = point
    routeRef.current = [...routeRef.current, point]
    distRef.current += addedDist

    // Smoothed current pace: last ~200m sliding window
    recentRef.current.push({ dist: distRef.current, elapsed: elapsedRef.current })
    while (recentRef.current.length > 1 && distRef.current - recentRef.current[0].dist > 0.2) {
      recentRef.current.shift()
    }
    let currentPace = 0
    if (recentRef.current.length >= 2) {
      const oldest = recentRef.current[0]
      const dDist = distRef.current - oldest.dist
      const dTime = elapsedRef.current - oldest.elapsed
      if (dDist > 0.01) currentPace = dTime / dDist
    }

    // Kilometer splits
    splitDistRef.current += addedDist
    while (splitDistRef.current >= 1.0) {
      splitDistRef.current -= 1.0
      const splitTime = elapsedRef.current - splitTimeRef.current
      splitsRef.current = [...splitsRef.current, {
        km: splitsRef.current.length + 1,
        pace: splitTime,
        time: elapsedRef.current,
      }]
      splitTimeRef.current = elapsedRef.current
    }

    const avgPace = distRef.current > 0 ? elapsedRef.current / distRef.current : 0
    const calories = Math.round(weightKg * distRef.current * 1.036)

    setState(s => ({
      ...s,
      route: routeRef.current,
      distance: distRef.current,
      currentPace,
      avgPace,
      splits: splitsRef.current,
      elevationGain: Math.round(elevRef.current),
      calories,
    }))
  }, [weightKg])

  const startGps = useCallback(() => {
    if (!navigator.geolocation) return
    stopGps()
    watchIdRef.current = navigator.geolocation.watchPosition(
      onPosition,
      (err) => console.warn('[GPS]', err.message),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 2000 },
    )
  }, [onPosition])

  const start = useCallback(async () => {
    statusRef.current = 'running'
    setState(s => ({ ...s, status: 'running' }))
    await acquireWakeLock()
    startTimer()
    startGps()
  }, [startGps])

  const pause = useCallback(() => {
    statusRef.current = 'paused'
    setState(s => ({ ...s, status: 'paused' }))
    stopTimer()
    stopGps()
    releaseWakeLock()
    lastPointRef.current = null // prevent distance jump on resume
  }, [])

  const resume = useCallback(async () => {
    statusRef.current = 'running'
    setState(s => ({ ...s, status: 'running' }))
    await acquireWakeLock()
    startTimer()
    startGps()
  }, [startGps])

  const finish = useCallback(() => {
    statusRef.current = 'finished'
    setState(s => ({ ...s, status: 'finished' }))
    stopTimer()
    stopGps()
    releaseWakeLock()
  }, [])

  const reset = useCallback(() => {
    stopTimer()
    stopGps()
    releaseWakeLock()
    statusRef.current = 'idle'
    elapsedRef.current = 0
    distRef.current = 0
    elevRef.current = 0
    splitDistRef.current = 0
    splitTimeRef.current = 0
    recentRef.current = []
    splitsRef.current = []
    routeRef.current = []
    lastPointRef.current = null
    setState(INIT)
  }, [])

  useEffect(() => () => {
    stopTimer()
    stopGps()
    releaseWakeLock()
  }, [])

  return { ...state, start, pause, resume, finish, reset }
}
