export const WHOOP_BASE    = 'https://api.prod.whoop.com/developer/v1'
export const WHOOP_AUTH    = 'https://api.prod.whoop.com/oauth/oauth2/auth'
export const REDIRECT_URI  = 'https://kalorilo.vercel.app/whoop-callback'

export interface WhoopTokens {
  accessToken:  string
  refreshToken: string
  expiresAt:    number   // unix ms
}

export interface WhoopSyncData {
  recovery:       number   // 0–100
  hrv:            number   // ms
  restingHR:      number
  sleepQuality:   number   // 0–100 (sleep performance %)
  sleepDuration:  number   // hours
  strain:         number   // 0–21
  caloriesBurned: number   // kcal from Whoop workouts
  date:           string   // YYYY-MM-DD
}

// ── Build OAuth2 Authorization URL ────────────────────────────────────────
export function buildAuthUrl(clientId: string, state: string): string {
  return WHOOP_AUTH + '?' + new URLSearchParams({
    response_type: 'code',
    client_id:      clientId,
    redirect_uri:   REDIRECT_URI,
    scope:          'read:recovery read:sleep read:workout read:body_measurement offline',
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

// ── Authenticated GET helper ───────────────────────────────────────────────
async function whoopGet(path: string, accessToken: string) {
  const res = await fetch(`${WHOOP_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Whoop API ${path}: HTTP ${res.status}`)
  return res.json()
}

// ── Sync all data for today ────────────────────────────────────────────────
export async function syncWhoopData(accessToken: string): Promise<WhoopSyncData> {
  const now  = new Date()
  const end  = now.toISOString()
  const start = new Date(now.getTime() - 48 * 3600 * 1000).toISOString()  // last 48h

  const today = now.toISOString().split('T')[0]

  // ── Recovery ──
  let recovery = 0, hrv = 0, restingHR = 0
  try {
    const rec = await whoopGet(
      `/recovery?start=${start}&end=${end}&order=desc&limit=1`,
      accessToken
    )
    const r = rec.records?.[0]
    if (r) {
      recovery  = Math.round(r.score?.recovery_score ?? 0)
      hrv       = Math.round(r.score?.hrv_rmssd_milli ?? 0)
      restingHR = Math.round(r.score?.resting_heart_rate ?? 0)
    }
  } catch { /* non-critical */ }

  // ── Sleep ──
  let sleepQuality = 0, sleepDuration = 0
  try {
    const sleep = await whoopGet(
      `/activity/sleep?start=${start}&end=${end}&order=desc&limit=1`,
      accessToken
    )
    const s = sleep.records?.[0]
    if (s) {
      sleepQuality  = Math.round(s.score?.sleep_performance_percentage ?? 0)
      sleepDuration = Math.round((s.score?.stage_summary?.total_in_bed_time_milli ?? 0) / 3600000 * 10) / 10
    }
  } catch { /* non-critical */ }

  // ── Workouts / Strain + Calories ──
  let strain = 0, caloriesBurned = 0
  try {
    const workouts = await whoopGet(
      `/activity/workout?start=${start}&end=${end}&order=desc`,
      accessToken
    )
    for (const w of workouts.records ?? []) {
      strain         = Math.max(strain, w.score?.strain ?? 0)
      caloriesBurned += Math.round(w.score?.kilojoule ? w.score.kilojoule / 4.184 : 0)
    }
    strain = Math.round(strain * 10) / 10
  } catch { /* non-critical */ }

  return { recovery, hrv, restingHR, sleepQuality, sleepDuration, strain, caloriesBurned, date: today }
}

// ── Recovery-adjusted calorie modifier ────────────────────────────────────
export function recoveryCalorieAdjustment(recovery: number): number {
  if (recovery === 0) return 0
  if (recovery < 34)  return -200   // low recovery → rest day
  if (recovery < 67)  return 0      // normal
  return 150                         // high recovery → can push more
}
