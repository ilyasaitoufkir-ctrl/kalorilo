import { useState, useRef, useCallback, useEffect } from 'react'
import type { GeoPoint, KmSplit, KmMarker } from '../types'

export type RunStatus = 'idle' | 'running' | 'paused' | 'finished'
export type GpsStatus = 'searching' | 'weak' | 'good' | 'excellent'

export interface RunTrackerState {
  status: RunStatus
  elapsed: number
  distance: number
  route: GeoPoint[]
  splits: KmSplit[]
  kmMarkers: KmMarker[]
  elevationGain: number
  currentPace: number
  avgPace: number
  calories: number
  gpsAccuracy: number | null
  gpsStatus: GpsStatus
  gpsError: string | null
}

// ── Constants ──────────────────────────────────────────────────────────────
const MAX_ACCURACY_M   = 20    // reject GPS points worse than 20m accuracy
const MAX_SPEED_M_S    = 15    // reject jumps > 54 km/h (impossible on foot)
const MIN_MOVEMENT_M_S = 0.5   // below this = stationary, no distance added
const PACE_WINDOW_SEC  = 30    // rolling pace window in seconds

// ── 1D Kalman Filter ───────────────────────────────────────────────────────
class KalmanFilter1D {
  private p = 1.0
  private x = 0.0
  private initialized = false
  private readonly q: number
  private readonly r: number

  constructor(q = 1e-5, r = 5e-5) { this.q = q; this.r = r }

  filter(z: number): number {
    if (!this.initialized) { this.x = z; this.initialized = true; return z }
    this.p += this.q
    const k = this.p / (this.p + this.r)
    this.x += k * (z - this.x)
    this.p *= (1 - k)
    return this.x
  }

  reset() { this.p = 1.0; this.initialized = false }
}

// ── Haversine distance (km) ────────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function accuracyToStatus(acc: number): GpsStatus {
  if (acc <= 5)  return 'excellent'
  if (acc <= 15) return 'good'
  if (acc <= 30) return 'weak'
  return 'searching'
}

// ── KM announcement: vibration + German speech ─────────────────────────────
function announceKm(km: number, paceSecPerKm: number) {
  if ('vibrate' in navigator) navigator.vibrate([300, 150, 300])
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
    const m = Math.floor(paceSecPerKm / 60)
    const s = Math.round(paceSecPerKm % 60)
    const u = new SpeechSynthesisUtterance(
      `${km} Kilometer geschafft – Pace: ${m}:${String(s).padStart(2, '0')} Minuten pro Kilometer`
    )
    u.lang = 'de-DE'; u.rate = 0.95
    window.speechSynthesis.speak(u)
  }
}

const INIT: RunTrackerState = {
  status: 'idle', elapsed: 0, distance: 0, route: [],
  splits: [], kmMarkers: [], elevationGain: 0,
  currentPace: 0, avgPace: 0, calories: 0,
  gpsAccuracy: null, gpsStatus: 'searching', gpsError: null,
}

export function useRunTracker(weightKg: number) {
  const [state, setState] = useState<RunTrackerState>(INIT)

  // ── Refs ──────────────────────────────────────────────────────────────────
  const statusRef        = useRef<RunStatus>('idle')
  const watchIdRef       = useRef<number | null>(null)
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const wakeLockRef      = useRef<WakeLockSentinel | null>(null)

  // Kalman filters – one per coordinate axis
  const kalmanLat        = useRef(new KalmanFilter1D())
  const kalmanLng        = useRef(new KalmanFilter1D())

  // Jump detection uses last RAW point (before Kalman) so filter doesn't mask bad jumps
  const lastRawRef       = useRef<GeoPoint | null>(null)
  // Polyline uses last FILTERED point for smooth drawing
  const lastFilteredRef  = useRef<GeoPoint | null>(null)

  // Timestamp-based elapsed
  const sessionStartRef  = useRef<number>(0)
  const baseElapsedRef   = useRef<number>(0)

  const distRef          = useRef(0)
  const elevRef          = useRef(0)
  const splitDistRef     = useRef(0)
  const splitTimeRef     = useRef(0)

  // Time-based pace window: array of { elapsed, dist } snapshots
  const paceWindowRef    = useRef<{ elapsed: number; dist: number }[]>([])

  const splitsRef        = useRef<KmSplit[]>([])
  const routeRef         = useRef<GeoPoint[]>([])
  const kmMarkersRef     = useRef<KmMarker[]>([])

  const getElapsed = (): number => {
    if (statusRef.current !== 'running' || sessionStartRef.current === 0)
      return baseElapsedRef.current
    return baseElapsedRef.current + Math.round((Date.now() - sessionStartRef.current) / 1000)
  }

  // ── Wake lock ─────────────────────────────────────────────────────────────
  const acquireWakeLock = async () => {
    try {
      if ('wakeLock' in navigator)
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
    } catch { /* not critical */ }
  }
  const releaseWakeLock = () => {
    wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
  }

  // ── Timer ─────────────────────────────────────────────────────────────────
  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }
  const startTimer = () => {
    stopTimer()
    sessionStartRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setState(s => ({ ...s, elapsed: getElapsed() }))
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

    const acc = pos.coords.accuracy

    // Always update GPS status indicator even when not tracking
    setState(s => ({ ...s, gpsAccuracy: acc, gpsStatus: accuracyToStatus(acc) }))

    // Reject low-accuracy fix
    if (acc > MAX_ACCURACY_M) return

    const rawLat = pos.coords.latitude
    const rawLng = pos.coords.longitude
    const rawPoint: GeoPoint = {
      lat: rawLat, lng: rawLng,
      altitude: pos.coords.altitude ?? undefined,
      accuracy: acc,
      timestamp: pos.timestamp,
    }

    // Jump detection on raw coordinates
    const prevRaw = lastRawRef.current
    if (prevRaw) {
      const d = haversine(prevRaw.lat, prevRaw.lng, rawLat, rawLng) * 1000 // meters
      const dtSec = (pos.timestamp - prevRaw.timestamp) / 1000
      if (dtSec > 0 && d / dtSec > MAX_SPEED_M_S) return  // impossible jump, discard
    }
    lastRawRef.current = rawPoint

    // Apply Kalman smoothing
    const filteredLat = kalmanLat.current.filter(rawLat)
    const filteredLng = kalmanLng.current.filter(rawLng)
    const filteredPoint: GeoPoint = {
      lat: filteredLat, lng: filteredLng,
      altitude: pos.coords.altitude ?? undefined,
      accuracy: acc,
      timestamp: pos.timestamp,
    }

    const prevFiltered = lastFilteredRef.current
    let addedDist = 0

    if (prevFiltered) {
      const d = haversine(prevFiltered.lat, prevFiltered.lng, filteredLat, filteredLng)  // km
      const dtSec = (pos.timestamp - prevFiltered.timestamp) / 1000
      const speedMs = dtSec > 0 ? (d * 1000) / dtSec : 0

      // Only add distance if actually moving (avoids GPS drift inflation)
      if (speedMs >= MIN_MOVEMENT_M_S) addedDist = d

      // Elevation gain (require 0.5m to reduce noise)
      if (
        filteredPoint.altitude != null &&
        prevFiltered.altitude != null &&
        filteredPoint.altitude > prevFiltered.altitude + 0.5
      ) {
        elevRef.current += filteredPoint.altitude - prevFiltered.altitude
      }
    }

    lastFilteredRef.current = filteredPoint
    routeRef.current = [...routeRef.current, filteredPoint]
    distRef.current += addedDist

    const elapsed = getElapsed()

    // Time-based pace window (last PACE_WINDOW_SEC seconds)
    paceWindowRef.current.push({ elapsed, dist: distRef.current })
    while (
      paceWindowRef.current.length > 1 &&
      elapsed - paceWindowRef.current[0].elapsed > PACE_WINDOW_SEC
    ) paceWindowRef.current.shift()

    let currentPace = 0
    const pw = paceWindowRef.current
    if (pw.length >= 2) {
      const dD = pw[pw.length - 1].dist - pw[0].dist
      const dT = pw[pw.length - 1].elapsed - pw[0].elapsed
      if (dD > 0.005) currentPace = dT / dD  // only show pace when actually moving
    }

    // KM splits
    splitDistRef.current += addedDist
    while (splitDistRef.current >= 1.0) {
      splitDistRef.current -= 1.0
      const splitPace = elapsed - splitTimeRef.current
      const km = splitsRef.current.length + 1
      splitsRef.current = [...splitsRef.current, { km, pace: splitPace, time: elapsed }]
      kmMarkersRef.current = [...kmMarkersRef.current, { km, point: filteredPoint }]
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
      gpsAccuracy: acc,
      gpsStatus: accuracyToStatus(acc),
      gpsError: null,
    }))
  }, [weightKg])

  const onGpsError = useCallback((err: GeolocationPositionError) => {
    const msgs: Record<number, string> = {
      1: 'GPS-Zugriff verweigert. Bitte Berechtigung erteilen.',
      2: 'GPS-Signal nicht verfügbar.',
      3: 'GPS-Zeitüberschreitung. Bitte ins Freie gehen.',
    }
    setState(s => ({ ...s, gpsError: msgs[err.code] ?? 'GPS-Fehler', gpsStatus: 'searching' }))
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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }, [onPosition, onGpsError])

  // Re-sync timer on tab focus
  useEffect(() => {
    const onVisible = () => {
      if (statusRef.current === 'running')
        setState(s => ({ ...s, elapsed: getElapsed() }))
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // ── Public actions ────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    baseElapsedRef.current = 0
    statusRef.current = 'running'
    kalmanLat.current.reset()
    kalmanLng.current.reset()
    lastRawRef.current = null
    lastFilteredRef.current = null
    paceWindowRef.current = []
    setState(s => ({ ...s, status: 'running', gpsError: null, gpsStatus: 'searching' }))
    await acquireWakeLock()
    startTimer()
    startGps()
  }, [startGps])

  const pause = useCallback(() => {
    if ('vibrate' in navigator) navigator.vibrate(100)
    baseElapsedRef.current = getElapsed()
    statusRef.current = 'paused'
    paceWindowRef.current = []   // clear pace window so we don't show stale pace on resume
    setState(s => ({ ...s, status: 'paused', elapsed: baseElapsedRef.current, currentPace: 0 }))
    stopTimer()
    stopGps()
    releaseWakeLock()
    lastRawRef.current = null      // prevent distance jump on resume
    lastFilteredRef.current = null
  }, [])

  const resume = useCallback(async () => {
    statusRef.current = 'running'
    kalmanLat.current.reset()
    kalmanLng.current.reset()
    setState(s => ({ ...s, status: 'running', gpsStatus: 'searching' }))
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
    stopTimer(); stopGps(); releaseWakeLock()
    statusRef.current = 'idle'
    sessionStartRef.current = 0
    baseElapsedRef.current = 0
    distRef.current = 0
    elevRef.current = 0
    splitDistRef.current = 0
    splitTimeRef.current = 0
    paceWindowRef.current = []
    splitsRef.current = []
    routeRef.current = []
    kmMarkersRef.current = []
    lastRawRef.current = null
    lastFilteredRef.current = null
    kalmanLat.current.reset()
    kalmanLng.current.reset()
    setState(INIT)
  }, [])

  useEffect(() => () => { stopTimer(); stopGps(); releaseWakeLock() }, [])

  return { ...state, start, pause, resume, finish, reset }
}
