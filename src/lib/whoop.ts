export const WHOOP_BASE    = 'https://api.prod.whoop.com/developer/v1'
export const WHOOP_AUTH    = 'https://api.prod.whoop.com/oauth/oauth2/auth'
export const REDIRECT_URI  = 'https://kalorilo.vercel.app/whoop-callback'

export interface WhoopTokens {
  accessToken:  string
  refreshToken: string
  expiresAt:    number   // unix ms
}

export interface WhoopSyncData {
  recovery:        number   // 0–100
  hrv:             number   // ms
  restingHR:       number
  respiratoryRate: number   // breaths/min
  sleepQuality:    number   // 0–100
  sleepDuration:   number   // hours
  deepSleep:       number   // hours (slow-wave)
  remSleep:        number   // hours
  strain:          number   // 0–21
  caloriesBurned:  number   // kcal from workouts only
  dailyBurn:       number   // kcal total from cycle
  date:            string   // YYYY-MM-DD
}

export interface WhoopDaySummary {
  date:          string
  recovery:      number
  hrv:           number
  sleepQuality:  number
  sleepDuration: number
  strain:        number
  caloriesBurned: number
}

export interface WhoopWorkoutRecord {
  id:             number
  start:          string
  end:            string
  strain:         number
  caloriesBurned: number   // kcal
  avgHR:          number
  maxHR:          number
  sportId:        number
}

// ── Build OAuth2 Authorization URL ────────────────────────────────────────
export function buildAuthUrl(clientId: string, state: string): string {
  return WHOOP_AUTH + '?' + new URLSearchParams({
    response_type: 'code',
    client_id:      clientId,
    redirect_uri:   REDIRECT_URI,
    scope:          'read:recovery read:sleep read:workout read:cycles read:body_measurement offline',
    state,
  })
}

// ── Token Exchange (via Vercel proxy to avoid CORS) ───────────────────────
export async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
): Promise<WhoopTokens> {
  const res = await fetch('/api/whoop-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type:    'authorization_code',
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  REDIRECT_URI,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error_description ?? err.error ?? `HTTP ${res.status}`)
  }
  const data = await res.json()
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    Date.now() + (data.expires_in ?? 3600) * 1000,
  }
}

// ── Refresh Access Token ───────────────────────────────────────────────────
export async function refreshAccessToken(
  tokens: WhoopTokens,
  clientId: string,
  clientSecret: string,
): Promise<WhoopTokens> {
  const res = await fetch('/api/whoop-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type:     'refresh_token',
      refresh_token:  tokens.refreshToken,
      client_id:      clientId,
      client_secret:  clientSecret,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error_description ?? `Refresh failed: HTTP ${res.status}`)
  }
  const data = await res.json()
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token ?? tokens.refreshToken,
    expiresAt:    Date.now() + (data.expires_in ?? 3600) * 1000,
  }
}

// ── Authenticated GET helper (via Vercel proxy to avoid CORS) ─────────────
async function whoopGet(path: string, accessToken: string) {
  // Split path and query string so the proxy can forward them separately
  const [pathname, qs] = path.split('?')
  const proxyUrl = `/api/whoop-data?path=${encodeURIComponent(pathname)}${qs ? '&' + qs : ''}`
  const res = await fetch(proxyUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Whoop API ${path}: HTTP ${res.status}`)
  return res.json()
}

// ── Sync all data for today ────────────────────────────────────────────────
export async function syncWhoopData(accessToken: string): Promise<WhoopSyncData> {
  const now   = new Date()
  const end   = now.toISOString()
  // 7 days back — recovery/sleep are created at different times than workouts
  const start = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString()
  const today = now.toISOString().split('T')[0]

  // ── Recovery ──
  let recovery = 0, hrv = 0, restingHR = 0
  try {
    const rec = await whoopGet(
      `/recovery?start=${start}&end=${end}&order=desc&limit=1`,
      accessToken
    )
    console.log('[WHOOP] /recovery raw:', JSON.stringify(rec))
    const r = rec.records?.[0]
    if (r?.score_state === 'SCORED' && r.score) {
      recovery  = Math.round(r.score.recovery_score ?? 0)
      hrv       = Math.round(r.score.hrv_rmssd_milli ?? 0)
      restingHR = Math.round(r.score.resting_heart_rate ?? 0)
    } else if (r) {
      console.log('[WHOOP] recovery score_state:', r.score_state, '→ kein Score verfügbar')
    }
  } catch (e) {
    console.error('[WHOOP] /recovery Fehler:', e)
  }

  // ── Sleep ──
  let sleepQuality = 0, sleepDuration = 0, deepSleep = 0, remSleep = 0, respiratoryRate = 0
  try {
    const sleep = await whoopGet(
      `/activity/sleep?start=${start}&end=${end}&order=desc&limit=1`,
      accessToken
    )
    console.log('[WHOOP] /activity/sleep raw:', JSON.stringify(sleep))
    const s = sleep.records?.[0]
    if (s?.score_state === 'SCORED' && s.score) {
      sleepQuality    = Math.round(s.score.sleep_performance_percentage ?? 0)
      sleepDuration   = Math.round((s.score.stage_summary?.total_in_bed_time_milli ?? 0) / 360000) / 10
      deepSleep       = Math.round((s.score.stage_summary?.total_slow_wave_sleep_time_milli ?? 0) / 360000) / 10
      remSleep        = Math.round((s.score.stage_summary?.total_rem_sleep_time_milli ?? 0) / 360000) / 10
      respiratoryRate = Math.round((s.score.respiratory_rate ?? 0) * 10) / 10
    } else if (s) {
      console.log('[WHOOP] sleep score_state:', s.score_state, '→ kein Score verfügbar')
    }
  } catch (e) {
    console.error('[WHOOP] /activity/sleep Fehler:', e)
  }

  // ── Workouts / Strain + Calories ──
  let strain = 0, caloriesBurned = 0
  try {
    const workouts = await whoopGet(
      `/activity/workout?start=${start}&end=${end}&order=desc`,
      accessToken
    )
    console.log('[WHOOP] /activity/workout records:', workouts.records?.length ?? 0)
    for (const w of workouts.records ?? []) {
      if (w.score_state === 'SCORED' && w.score) {
        strain         = Math.max(strain, w.score.strain ?? 0)
        caloriesBurned += Math.round(w.score.kilojoule ? w.score.kilojoule / 4.184 : 0)
      }
    }
    strain = Math.round(strain * 10) / 10
  } catch (e) {
    console.error('[WHOOP] /activity/workout Fehler:', e)
  }

  // ── Cycle (total daily burn incl. NEAT) ──
  let dailyBurn = 0
  try {
    const cycles = await whoopGet(
      `/cycle?start=${start}&end=${end}&order=desc&limit=1`,
      accessToken
    )
    console.log('[WHOOP] /cycle raw:', JSON.stringify(cycles))
    const c = cycles.records?.[0]
    if (c?.score_state === 'SCORED' && c.score) {
      dailyBurn = Math.round((c.score.kilojoule ?? 0) / 4.184)
    }
  } catch (e) {
    console.error('[WHOOP] /cycle Fehler:', e)
  }

  console.log('[WHOOP] syncWhoopData result:', { recovery, hrv, restingHR, sleepQuality, sleepDuration, strain, caloriesBurned, dailyBurn })
  return {
    recovery, hrv, restingHR, respiratoryRate,
    sleepQuality, sleepDuration, deepSleep, remSleep,
    strain, caloriesBurned, dailyBurn,
    date: today,
  }
}

// ── Fetch today's workouts for auto-import ────────────────────────────────
export async function fetchTodayWorkouts(accessToken: string): Promise<WhoopWorkoutRecord[]> {
  const now   = new Date()
  const end   = now.toISOString()
  const start = new Date(now.getTime() - 24 * 3600 * 1000).toISOString()

  try {
    const data = await whoopGet(
      `/activity/workout?start=${start}&end=${end}&order=desc`,
      accessToken
    )
    return (data.records ?? []).map((w: any): WhoopWorkoutRecord => ({
      id:             w.id,
      start:          w.start ?? '',
      end:            w.end ?? '',
      strain:         Math.round((w.score?.strain ?? 0) * 10) / 10,
      caloriesBurned: Math.round((w.score?.kilojoule ?? 0) / 4.184),
      avgHR:          Math.round(w.score?.average_heart_rate ?? 0),
      maxHR:          Math.round(w.score?.max_heart_rate ?? 0),
      sportId:        w.sport_id ?? 0,
    }))
  } catch {
    return []
  }
}

// ── Fetch 7-day history for trend charts ─────────────────────────────────
export async function syncWhoopHistory(accessToken: string, days = 7): Promise<WhoopDaySummary[]> {
  const now   = new Date()
  const end   = now.toISOString()
  const start = new Date(now.getTime() - (days + 1) * 24 * 3600 * 1000).toISOString()

  try {
    const [recData, sleepData, workoutData] = await Promise.all([
      whoopGet(`/recovery?start=${start}&end=${end}&order=asc&limit=${days}`, accessToken),
      whoopGet(`/activity/sleep?start=${start}&end=${end}&order=asc&limit=${days}`, accessToken),
      whoopGet(`/activity/workout?start=${start}&end=${end}&order=asc`, accessToken),
    ])

    const summaries: WhoopDaySummary[] = []

    for (const r of (recData.records ?? [])) {
      const date = (r.created_at ?? r.updated_at ?? '').split('T')[0]
      if (!date) continue

      const sleepRec = (sleepData.records ?? []).find((s: any) =>
        (s.start ?? '').startsWith(date) || (s.end ?? '').startsWith(date)
      )

      const dayWorkouts = (workoutData.records ?? []).filter((w: any) =>
        (w.start ?? '').startsWith(date)
      )
      const kcal = dayWorkouts.reduce(
        (sum: number, w: any) => sum + Math.round((w.score?.kilojoule ?? 0) / 4.184), 0
      )
      const dayStrain = dayWorkouts.reduce(
        (max: number, w: any) => Math.max(max, w.score?.strain ?? 0), 0
      )

      summaries.push({
        date,
        recovery:      Math.round(r.score?.recovery_score ?? 0),
        hrv:           Math.round(r.score?.hrv_rmssd_milli ?? 0),
        sleepQuality:  Math.round(sleepRec?.score?.sleep_performance_percentage ?? 0),
        sleepDuration: Math.round((sleepRec?.score?.stage_summary?.total_in_bed_time_milli ?? 0) / 360000) / 10,
        strain:        Math.round(dayStrain * 10) / 10,
        caloriesBurned: kcal,
      })
    }

    return summaries
  } catch {
    return []
  }
}

// ── Recovery-adjusted calorie modifier ────────────────────────────────────
export function recoveryCalorieAdjustment(recovery: number): number {
  if (recovery === 0) return 0
  if (recovery < 34)  return -200
  if (recovery < 67)  return 0
  return 150
}
