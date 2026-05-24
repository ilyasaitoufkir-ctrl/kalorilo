import { useState, useRef, useCallback, useEffect } from 'react'
import type { GeoPoint, KmSplit, KmMarker } from '../types'

export type RunStatus = 'idle' | 'running' | 'paused' | 'finished'

export interface RunTrackerState {
  status: RunStatus
  elapsed: number       // active seconds, pause-excluded
  distance: number      // km (2 decimal)
  route: GeoPoint[]
  splits: KmSplit[]
  kmMarkers: KmMarker[]
  elevationGain: number // m
  currentPace: number   // sec/km (recent 200m window)
  avgPace: number       // sec/km overall
  calories: number
  gpsAccuracy: number | null   // metres, null = no fix yet
  gpsError: string | null
}

// ── Haversine distance formula ─────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Km announcement: vibration + German speech ────────────────────────────
function announceKm(km: number, paceSecPerKm: number) {
  if ('vibrate' in navigator) navigator.vibrate([300, 150, 300])
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
    const m = Math.floor(paceSecPerKm / 60)
    const s = Math.round(paceSecPerKm % 60)
    const u = new SpeechSynthesisUtterance(
      `${km} Kilometer geschafft – Pace: ${m}:${String(s).padStart(2, '0')} Minuten pro Kilometer`
    )
    u.lang = 'de-DE'
    u.rate = 0.95
    window.speechSynthesis.speak(u)
  }
}

const INIT: RunTrackerState = {
  status: 'idle', elapsed: 0, distance: 0, route: [],
  splits: [], kmMarkers: [], elevationGain: 0,
  currentPace: 0, avgPace: 0, calories: 0,
  gpsAccuracy: null, gpsError: null,
}

export function useRunTracker(weightKg: number) {
  const [state, setState] = useState<RunTrackerState>(INIT)

  // ── Refs (GPS callback must not capture stale state) ──
  const statusRef       = useRef<RunStatus>('idle')
  const watchIdRef      = useRef<number | null>(null)
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  const wakeLockRef     = useRef<WakeLockSentinel | null>(null)
  const lastPointRef    = useRef<GeoPoint | null>(null)

  // Timestamp-based elapsed: accurate even when tab is backgrounded
  const sessionStartRef = useRef<number>(0)  // Date.now() when current run/resume started
  const baseElapsedRef  = useRef<number>(0)  // seconds accumulated before this session

  const distRef         = useRef(0)
  const elevRef         = useRef(0)
  const splitDistRef    = useRef(0)   // partial km since last full split
  const splitTimeRef    = useRef(0)   // elapsed-seconds at start of current km
  const recentRef       = useRef<{ dist: number; elapsed: number }[]>([])
  const splitsRef       = useRef<KmSplit[]>([])
  const routeRef        = useRef<GeoPoint[]>([])
  const kmMarkersRef    = useRef<KmMarker[]>([])

  const getElapsed = (): number => {
    if (statusRef.current !== 'running' || sessionStartRef.current === 0) {
      return baseElapsedRef.current
    }
    return baseElapsedRef.current + Math.round((Date.now() - sessionStartRef.current) / 1000)
  }

  // ── Wake lock ─────────────────────────────────────────────────────────────
  const acquireWakeLock = async () => {
    try {
      if ('wakeLock' in navigator)
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
    } catch { /* not supported on all browsers */ }
  }
  const releaseWakeLock = () => {
    wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
  }

  // ── Timer (1-second tick, displays timestamp-corrected value) ─────────────
  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }
  const startTimer = () => {
    stopTimer()
    sessionStartRef.current = Date.now()
    timerRef.current = setInterval(() => {
      const elapsed = getElapsed()
      setState(s => ({ ...s, elapsed }))
    }, 1000)
  }

  // ── GPS ───────────────────────────────────────────────────────────────────
  const stopGps = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
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
      // Sanity: reject GPS jumps > 10 m/s (36 km/h – faster than any sprinter)
      if (dtSec > 0 && (d * 1000) / dtSec < 10) addedDist = d
      // Elevation gain (filter out tiny noise with 0.5m threshold)
      if (point.altitude != null && prev.altitude != null && point.altitude > prev.altitude + 0.5)
        elevRef.current += point.altitude - prev.altitude
    }

    lastPointRef.current = point
    routeRef.current = [...routeRef.current, point]
    distRef.current += addedDist

    const elapsed = getElapsed()

    // Smoothed current pace: last 200m sliding window
    recentRef.current.push({ dist: distRef.current, elapsed })
    while (recentRef.current.length > 1 && distRef.current - recentRef.current[0].dist > 0.2)
      recentRef.current.shift()
    let currentPace = 0
    if (recentRef.current.length >= 2) {
      const old = recentRef.current[0]
      const dD = distRef.current - old.dist, dT = elapsed - old.elapsed
      if (dD > 0.01) currentPace = dT / dD
    }

    // Kilometer splits + vibration + speech
    splitDistRef.current += addedDist
    while (splitDistRef.current >= 1.0) {
      splitDistRef.current -= 1.0
      const splitPace = elapsed - splitTimeRef.current
      const km = splitsRef.current.length + 1
      splitsRef.current = [...splitsRef.current, { km, pace: splitPace, time: elapsed }]
      kmMarkersRef.current = [...kmMarkersRef.current, { km, point }]
      splitTimeRef.current = elapsed
      announceKm(km, splitPace)
    }

    const avgPace = distRef.current > 0 ? elapsed / distRef.current : 0
    const calories = Math.round(weightKg * distRef.current * 1.036)

    setState(s => ({
      ...s,
      route: routeRef.current,
      distance: distRef.current,
      splits: splitsRef.current,
      kmMarkers: kmMarkersRef.current,
      currentPace,
      avgPace,
      elevationGain: Math.round(elevRef.current),
      calories,
      gpsAccuracy: point.accuracy ?? null,
      gpsError: null,
    }))
  }, [weightKg])

  const onGpsError = useCallback((err: GeolocationPositionError) => {
    const msgs: Record<number, string> = {
      1: 'GPS-Zugriff verweigert. Bitte Berechtigung erteilen.',
      2: 'GPS-Signal nicht verfügbar.',
      3: 'GPS-Zeitüberschreitung. Bitte ins Freie gehen.',
    }
    setState(s => ({ ...s, gpsError: msgs[err.code] ?? 'GPS-Fehler' }))
  }, [])

  const startGps = useCallback(() => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, gpsError: 'GPS nicht unterstützt' }))
      return
    }
    stopGps()
    watchIdRef.current = navigator.geolocation.watchPosition(
      onPosition,
      onGpsError,
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 },
    )
  }, [onPosition, onGpsError])

  // Re-sync timer when tab comes back from background
  useEffect(() => {
    const onVisible = () => {
      if (statusRef.current === 'running') {
        const elapsed = getElapsed()
        setState(s => ({ ...s, elapsed }))
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // ── Public actions ────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    baseElapsedRef.current = 0
    statusRef.current = 'running'
    setState(s => ({ ...s, status: 'running', gpsError: null }))
    await acquireWakeLock()
    startTimer()
    startGps()
  }, [startGps])

  const pause = useCallback(() => {
    if ('vibrate' in navigator) navigator.vibrate(100)
    baseElapsedRef.current = getElapsed()
    statusRef.current = 'paused'
    setState(s => ({ ...s, status: 'paused', elapsed: baseElapsedRef.current }))
    stopTimer()
    stopGps()
    releaseWakeLock()
    lastPointRef.current = null  // prevents distance jump on resume
  }, [])

  const resume = useCallback(async () => {
    statusRef.current = 'running'
    setState(s => ({ ...s, status: 'running' }))
    await acquireWakeLock()
    startTimer()
    startGps()
  }, [startGps])

  const finish = useCallback(() => {
    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200, 100, 200])
    baseElapsedRef.current = getElapsed()
    statusRef.current = 'finished'
    setState(s => ({ ...s, status: 'finished', elapsed: baseElapsedRef.current }))
    stopTimer()
    stopGps()
    releaseWakeLock()
  }, [])

  const reset = useCallback(() => {
    stopTimer()
    stopGps()
    releaseWakeLock()
    statusRef.current = 'idle'
    sessionStartRef.current = 0
    baseElapsedRef.current = 0
    distRef.current = 0
    elevRef.current = 0
    splitDistRef.current = 0
    splitTimeRef.current = 0
    recentRef.current = []
    splitsRef.current = []
    routeRef.current = []
    kmMarkersRef.current = []
    lastPointRef.current = null
    setState(INIT)
  }, [])

  useEffect(() => () => { stopTimer(); stopGps(); releaseWakeLock() }, [])

  return { ...state, start, pause, resume, finish, reset }
}
