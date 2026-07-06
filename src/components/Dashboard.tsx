import { useMemo, useState, useRef, useCallback, useEffect, lazy, Suspense } from 'react'
import { Settings, Droplets, Zap, Plus, ChevronRight, Footprints, RefreshCw, ChevronDown, ChevronUp, Loader, Brain } from 'lucide-react'
import { useStore } from '../store/useStore'
import { formatDate, getMacroTargets, getTodayQuote, waterGoal, getBMI } from '../utils/calculations'
import { generateEnergyPlan, getMuscleRecovery } from '../utils/insights'
import { generateScoreComment, getProteinHelp } from '../utils/api'
import type { WhoopData, WhoopDayHistory, ActivityLog } from '../types'

const BodyScanScreen = lazy(() => import('./BodyScanScreen'))

const today = formatDate()

const C = {
  primary:   '#5a8a6a',
  accent:    '#7ab08a',
  light:     '#e8f2ec',
  text:      '#1a2e1f',
  secondary: '#6b8570',
  tertiary:  '#9db3a2',
  border:    '#e8f0ea',
  bg:        '#f8faf8',
  card:      '#ffffff',
} as const

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Guten Morgen'
  if (h < 18) return 'Guten Tag'
  return 'Guten Abend'
}

// ── Score helpers ──────────────────────────────────────────────────────────
function scoreColor(s: number) {
  if (s >= 70) return C.primary
  if (s >= 50) return '#8aaa6a'
  return C.secondary
}
function scoreLabel(s: number) {
  if (s >= 85) return 'Ausgezeichnet'
  if (s >= 70) return 'Sehr gut'
  if (s >= 55) return 'Gut'
  if (s >= 40) return 'Ausbaufähig'
  return 'Schwacher Tag'
}

// ── Elegant Score Ring ─────────────────────────────────────────────────────
function DailyScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const stroke = 12
  const r      = (size - stroke) / 2
  const circ   = 2 * Math.PI * r
  const dash   = circ * (Math.min(100, score) / 100)
  const color  = scoreColor(score)
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={C.light} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: 'stroke-dasharray 1.4s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        <span style={{ fontSize: 44, fontWeight: 600, color, lineHeight: 1, letterSpacing: '-1px' }}>{score}</span>
        <span style={{ fontSize: 11, fontWeight: 500, color: C.tertiary, letterSpacing: '0.06em', marginTop: 2 }}>SCORE</span>
      </div>
    </div>
  )
}

// ── Compact sub-score bar ──────────────────────────────────────────────────
function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ fontSize: 11, color: C.secondary, width: 70, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: C.light, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: scoreColor(value), borderRadius: 2, transition: 'width 1s cubic-bezier(0.16,1,0.3,1)' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: scoreColor(value), width: 28, textAlign: 'right', flexShrink: 0 }}>{value}</span>
    </div>
  )
}

// ── 7-day score chart ──────────────────────────────────────────────────────
function ScoreBarChart({ scores }: { scores: { date: string; score: number }[] }) {
  if (scores.length === 0) return null
  const maxVal   = Math.max(...scores.map((s) => s.score), 1)
  const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
  const todayStr = new Date().toISOString().split('T')[0]
  return (
    <div className="flex items-end gap-1.5" style={{ height: 72 }}>
      {scores.map((s) => {
        const isToday = s.date === todayStr
        const barH    = s.score > 0 ? Math.max(6, (s.score / maxVal) * 48) : 4
        const dayName = dayNames[new Date(s.date).getDay()]
        return (
          <div key={s.date} className="flex-1 flex flex-col items-center gap-1">
            {s.score > 0 && (
              <span style={{ fontSize: 9, fontWeight: 600, color: isToday ? C.primary : C.tertiary }}>
                {s.score}
              </span>
            )}
            <div className="w-full rounded-t-sm transition-all duration-700 flex-1 flex flex-col justify-end">
              <div style={{
                height: barH,
                background: isToday ? C.primary : C.light,
                borderRadius: '3px 3px 0 0',
                border: isToday ? 'none' : `1px solid ${C.border}`,
                transition: 'height 0.7s ease',
              }} />
            </div>
            <span style={{ fontSize: 9, fontWeight: isToday ? 600 : 400, color: isToday ? C.primary : C.tertiary }}>
              {dayName}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Recovery color (restrained) ────────────────────────────────────────────
function recoveryColor(r: number) {
  if (r >= 67) return C.primary
  if (r >= 34) return '#8aaa6a'
  return C.secondary
}
function recoveryLabel(r: number) {
  if (r >= 67) return 'Hohe Recovery'
  if (r >= 34) return 'Moderate Recovery'
  return 'Niedrige Recovery'
}
function recoveryAdvice(d: WhoopData): string {
  const r = d.recovery
  if (r >= 67) return 'Guter Tag für intensives Training'
  if (r >= 34) return 'Leichtes Training oder Spaziergang empfohlen'
  return 'Ruhetag empfohlen – viel Protein und Schlaf'
}
function sleepAdvice(d: WhoopData): string {
  const dur = d.sleepDuration ?? 0
  if (dur === 0)  return ''
  if (dur < 6)    return `Nur ${dur}h – mehr Erholung einplanen`
  if (dur >= 7.5) return 'Sehr guter Schlaf'
  return 'Ausreichend Schlaf'
}

// ── Whoop Widget (light design) ────────────────────────────────────────────
function WhoopWidget({
  whoopData, whoopHistory, lastSyncAt, onConnect,
}: {
  whoopData: WhoopData | null
  whoopHistory: WhoopDayHistory[]
  lastSyncAt: number
  onConnect: () => void
}) {
  const minAgo = lastSyncAt > 0 ? Math.round((Date.now() - lastSyncAt) / 60000) : null

  if (!whoopData) {
    return (
      <button onClick={onConnect}
        className="glass-press w-full flex items-center gap-3 text-left"
        style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '14px 16px' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: C.light, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>⌚</div>
        <div className="flex-1" style={{ minWidth: 0 }}>
          <p style={{ color: C.text, fontSize: 15, fontWeight: 500 }}>Whoop verbinden</p>
          <p style={{ color: C.secondary, fontSize: 13 }}>Recovery, Schlaf & Workouts automatisch</p>
        </div>
        <ChevronRight size={16} style={{ color: C.tertiary, flexShrink: 0 }} />
      </button>
    )
  }

  const rc     = recoveryColor(whoopData.recovery)
  const sleep  = whoopData.sleepDuration   ?? 0
  const deep   = whoopData.deepSleep       ?? 0
  const rem    = whoopData.remSleep        ?? 0
  const strain = whoopData.strain          ?? 0
  const burned = whoopData.caloriesBurned  ?? 0
  const daily  = whoopData.dailyBurn       ?? 0

  const ringSize = 64
  const ringStroke = 6
  const ringR = (ringSize - ringStroke) / 2
  const ringCirc = 2 * Math.PI * ringR
  const ringDash = ringCirc * Math.min(1, whoopData.recovery / 100)

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '16px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 15 }}>⌚</span>
          <span style={{ color: C.text, fontSize: 14, fontWeight: 500 }}>Whoop</span>
          <span style={{ fontSize: 11, color: C.primary, fontWeight: 500 }}>● Live</span>
        </div>
        {minAgo !== null && (
          <div className="flex items-center gap-1" style={{ color: C.tertiary, fontSize: 11 }}>
            <RefreshCw size={10} />
            <span>{minAgo === 0 ? 'gerade' : `vor ${minAgo} Min.`}</span>
          </div>
        )}
      </div>

      {/* Recovery row */}
      <div className="flex items-center gap-4" style={{ marginBottom: 14 }}>
        <div style={{ position: 'relative', width: ringSize, height: ringSize, flexShrink: 0 }}>
          <svg width={ringSize} height={ringSize} style={{ position: 'absolute' }}>
            <circle cx={ringSize/2} cy={ringSize/2} r={ringR} fill="none" stroke={C.light} strokeWidth={ringStroke} />
            <circle cx={ringSize/2} cy={ringSize/2} r={ringR} fill="none" stroke={rc} strokeWidth={ringStroke}
              strokeDasharray={`${ringDash} ${ringCirc}`} strokeLinecap="round"
              transform={`rotate(-90 ${ringSize/2} ${ringSize/2})`}
              style={{ transition: 'stroke-dasharray 0.8s ease' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: rc, lineHeight: 1 }}>{whoopData.recovery}%</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: rc, fontSize: 15, fontWeight: 500, marginBottom: 2 }}>{recoveryLabel(whoopData.recovery)}</p>
          <p style={{ color: C.secondary, fontSize: 12 }}>{recoveryAdvice(whoopData)}</p>
          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            {whoopData.hrv > 0 && (
              <span style={{ color: C.secondary, fontSize: 11 }}>HRV <strong style={{ color: C.text }}>{whoopData.hrv}ms</strong></span>
            )}
            {whoopData.restingHR > 0 && (
              <span style={{ color: C.secondary, fontSize: 11 }}>Ruhepuls <strong style={{ color: C.text }}>{whoopData.restingHR}</strong></span>
            )}
          </div>
        </div>
      </div>

      {/* Sleep + Strain row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {sleep > 0 && (
          <div style={{ background: C.bg, borderRadius: 12, padding: '12px 14px', border: `1px solid ${C.border}` }}>
            <p style={{ color: C.secondary, fontSize: 11, marginBottom: 4 }}>Schlaf</p>
            <p style={{ color: C.text, fontSize: 22, fontWeight: 600, lineHeight: 1 }}>{sleep}h</p>
            {whoopData.sleepQuality > 0 && (
              <p style={{ color: C.secondary, fontSize: 11, marginTop: 2 }}>{whoopData.sleepQuality}% Qualität</p>
            )}
            {(deep > 0 || rem > 0) && (
              <p style={{ color: C.tertiary, fontSize: 10, marginTop: 4 }}>
                {deep > 0 ? `${deep}h Tief` : ''}{deep > 0 && rem > 0 ? ' · ' : ''}{rem > 0 ? `${rem}h REM` : ''}
              </p>
            )}
            <p style={{ color: C.primary, fontSize: 10, marginTop: 2 }}>{sleepAdvice(whoopData)}</p>
          </div>
        )}
        <div style={{ background: C.bg, borderRadius: 12, padding: '12px 14px', border: `1px solid ${C.border}` }}>
          <p style={{ color: C.secondary, fontSize: 11, marginBottom: 4 }}>
            {burned > 0 ? 'Workout' : 'Tagesverbrauch'}
          </p>
          <p style={{ color: C.text, fontSize: 22, fontWeight: 600, lineHeight: 1 }}>
            {burned > 0 ? burned : daily > 0 ? daily : '–'}
          </p>
          {(burned > 0 || daily > 0) && (
            <p style={{ color: C.secondary, fontSize: 11, marginTop: 2 }}>kcal</p>
          )}
          {strain > 0 && (
            <p style={{ color: C.secondary, fontSize: 10, marginTop: 4 }}>
              Strain: <strong style={{ color: C.text }}>{strain.toFixed(1)}</strong>
            </p>
          )}
        </div>
      </div>

      {/* 7-day trend */}
      {whoopHistory.length > 1 && (
        <div style={{ marginTop: 12, display: 'flex', gap: 3 }}>
          {whoopHistory.slice(-7).map((d) => {
            const col = recoveryColor(d.recovery)
            return (
              <div key={d.date} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ height: 3, borderRadius: 2, background: col, marginBottom: 2 }} />
                <span style={{ fontSize: 8, color: C.tertiary }}>{d.recovery}%</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Energy Plan Card (light) ───────────────────────────────────────────────
function EnergyPlanCard({ whoopData }: { whoopData: WhoopData | null }) {
  const [open, setOpen] = useState(false)
  const plan  = useMemo(() => generateEnergyPlan(whoopData), [whoopData])
  const r     = whoopData?.recovery ?? 50
  const label = r >= 67 ? 'Hochleistungstag' : r < 34 ? 'Erholungstag' : 'Normaler Tag'

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
      <button className="glass-press w-full flex items-center gap-3 text-left" style={{ padding: '14px 16px' }} onClick={() => setOpen((v) => !v)}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: C.light, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>⚡</div>
        <div className="flex-1" style={{ minWidth: 0 }}>
          <p style={{ color: C.text, fontSize: 15, fontWeight: 500 }}>Energie-Plan</p>
          <p style={{ color: C.primary, fontSize: 12 }}>{label}</p>
        </div>
        {open ? <ChevronUp size={16} style={{ color: C.tertiary, flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: C.tertiary, flexShrink: 0 }} />}
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {plan.map((block) => {
            const now = new Date()
            const [startH] = block.time.split('–').map(Number)
            const isCurrent = now.getHours() >= startH && now.getHours() < startH + 2
            return (
              <div key={block.time} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 12px', borderRadius: 12,
                background: isCurrent ? C.light : C.bg,
                border: `1px solid ${isCurrent ? C.primary + '33' : C.border}`,
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{block.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 11, color: C.primary, fontWeight: 500 }}>{block.time}</span>
                    {isCurrent && <span style={{ fontSize: 9, color: C.primary, fontWeight: 600, background: C.light, padding: '1px 6px', borderRadius: 6 }}>JETZT</span>}
                  </div>
                  <p style={{ fontSize: 13, color: isCurrent ? C.text : C.secondary, marginTop: 1 }}>{block.label}</p>
                  {block.tip && <p style={{ fontSize: 11, color: C.tertiary, marginTop: 1 }}>{block.tip}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Muscle Tracker (light) ─────────────────────────────────────────────────
function MuscleTrackerCard({ activityLogs }: { activityLogs: ActivityLog[] }) {
  const muscles  = useMemo(() => getMuscleRecovery(activityLogs), [activityLogs])
  if (muscles.length === 0) return null

  const ready    = muscles.filter((m) => m.ready)
  const notReady = muscles.filter((m) => !m.ready)

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '14px 16px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <p style={{ color: C.text, fontSize: 14, fontWeight: 500 }}>Muskel-Regeneration</p>
        {ready.length > 0 && (
          <span style={{ fontSize: 11, color: C.primary, fontWeight: 500, background: C.light, padding: '2px 8px', borderRadius: 8 }}>
            {ready.length} bereit
          </span>
        )}
      </div>

      {notReady.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
          {notReady.map((m) => (
            <div key={m.name}>
              <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: C.secondary }}>{m.emoji} {m.name}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: m.pctRecovered >= 75 ? C.accent : C.secondary }}>
                  {m.pctRecovered}%
                </span>
              </div>
              <div style={{ height: 4, background: C.light, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${m.pctRecovered}%`, background: m.pctRecovered >= 75 ? C.accent : C.border, borderRadius: 2, transition: 'width 0.7s ease' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {ready.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ready.map((m) => (
            <span key={m.name} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, background: C.light, color: C.primary, border: `1px solid ${C.border}` }}>
              {m.emoji} {m.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Protein Tracker (light) ────────────────────────────────────────────────
const PGOAL = 170

function ProteinTrackerCard() {
  const foodLogs    = useStore((s) => s.foodLogs)
  const profile     = useStore((s) => s.profile)
  const apiKeys     = useStore((s) => s.apiKeys)
  const personality = useStore((s) => s.userPersonality)
  const apiKey      = apiKeys.anthropic || apiKeys.openai
  const todayStr    = formatDate()

  const [helpText, setHelpText]       = useState('')
  const [helpLoading, setHelpLoading] = useState(false)
  const [showHelp, setShowHelp]       = useState(false)

  const todayFoods = useMemo(() => foodLogs.filter((l) => l.date === todayStr), [foodLogs, todayStr])
  const protein    = useMemo(() => Math.round(todayFoods.reduce((s, f) => s + (f.macros?.protein ?? 0), 0)), [todayFoods])
  const remaining  = Math.max(0, PGOAL - protein)
  const pct        = Math.min(100, Math.round((protein / PGOAL) * 100))

  const proteinStreak = useMemo(() => {
    let count = protein >= PGOAL ? 1 : 0
    for (let i = 1; i <= 60; i++) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const ds = d.toISOString().split('T')[0]
      const p  = foodLogs.filter((l) => l.date === ds).reduce((s, f) => s + (f.macros?.protein ?? 0), 0)
      if (p >= PGOAL) count++
      else break
    }
    return count
  }, [protein, foodLogs])

  const getHelp = async () => {
    if (!apiKey || protein >= PGOAL) return
    setHelpLoading(true)
    setShowHelp(true)
    const now = new Date()
    const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`
    try {
      const text = await getProteinHelp(
        protein, PGOAL, timeStr,
        profile?.name?.split(' ')[0] ?? 'Du',
        personality.favoriteFoods,
        apiKey,
      )
      setHelpText(text)
    } catch { setHelpText('Keine Empfehlung verfügbar.') }
    setHelpLoading(false)
  }

  const ringSize = 120, ringStroke = 10
  const ringR    = (ringSize - ringStroke) / 2
  const ringCirc = 2 * Math.PI * ringR
  const ringDash = ringCirc * Math.min(1, protein / PGOAL)

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '16px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <p style={{ color: C.text, fontSize: 14, fontWeight: 500 }}>Protein</p>
        {proteinStreak >= 2 && (
          <span style={{ fontSize: 11, color: C.primary, fontWeight: 500, background: C.light, padding: '2px 8px', borderRadius: 8 }}>
            {proteinStreak}d Streak
          </span>
        )}
      </div>

      <div className="flex items-center gap-4" style={{ marginBottom: 14 }}>
        {/* Ring */}
        <div style={{ position: 'relative', width: ringSize, height: ringSize, flexShrink: 0 }}>
          <svg width={ringSize} height={ringSize} style={{ position: 'absolute' }}>
            <circle cx={ringSize/2} cy={ringSize/2} r={ringR} fill="none" stroke={C.light} strokeWidth={ringStroke} />
            <circle cx={ringSize/2} cy={ringSize/2} r={ringR} fill="none" stroke={C.primary} strokeWidth={ringStroke}
              strokeDasharray={`${ringDash} ${ringCirc}`} strokeLinecap="round"
              transform={`rotate(-90 ${ringSize/2} ${ringSize/2})`}
              style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.16,1,0.3,1)' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 28, fontWeight: 600, color: C.text, lineHeight: 1 }}>{protein}</span>
            <span style={{ fontSize: 11, color: C.tertiary, marginTop: 2 }}>/ {PGOAL}g</span>
          </div>
        </div>

        {/* Stats */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div>
            <div className="flex justify-between" style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: C.secondary }}>{pct}% erreicht</span>
              {protein < PGOAL && <span style={{ fontSize: 12, color: C.tertiary }}>noch {remaining}g</span>}
            </div>
            <div style={{ height: 6, background: C.light, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: C.primary, borderRadius: 3, transition: 'width 0.7s ease' }} />
            </div>
          </div>
          <div style={{ background: C.bg, borderRadius: 10, padding: '8px 10px', border: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 12, color: protein >= PGOAL ? C.primary : C.secondary }}>
              {protein >= PGOAL
                ? 'Tagesziel erreicht!'
                : protein === 0
                ? 'Noch kein Protein heute'
                : `Noch ${remaining}g bis zum Ziel`}
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={getHelp}
        disabled={helpLoading || !apiKey || protein >= PGOAL}
        className="glass-press w-full"
        style={{
          padding: '11px', borderRadius: 12, border: `1px solid ${C.border}`,
          background: protein >= PGOAL ? C.light : C.bg,
          color: protein >= PGOAL ? C.primary : C.secondary,
          fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          opacity: (!apiKey || protein >= PGOAL) ? 0.6 : 1,
        }}>
        {helpLoading ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Kalo denkt…</> : protein >= PGOAL ? 'Tagesziel erreicht!' : 'Was soll ich jetzt essen?'}
      </button>

      {showHelp && helpText && (
        <div style={{ marginTop: 10, padding: '12px 14px', background: C.light, borderRadius: 12, border: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: C.primary, marginBottom: 4 }}>Kalos Empfehlung</p>
          <p style={{ fontSize: 13, color: C.text, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{helpText}</p>
        </div>
      )}
    </div>
  )
}

// ── Adaptive TDEE Card (light) ─────────────────────────────────────────────
function AdaptiveTDEECard() {
  const whoopData    = useStore((s) => s.whoopData)
  const whoopHistory = useStore((s) => s.whoopHistory)
  const profile      = useStore((s) => s.profile)
  const [open, setOpen] = useState(false)

  const dailyBurn = whoopData?.dailyBurn ?? 0
  const strain    = whoopData?.strain    ?? 8
  const recovery  = whoopData?.recovery  ?? 50
  const hasWhoop  = dailyBurn > 0

  let deficit = -400
  let deficitReason = 'Standarddefizit'
  if (hasWhoop) {
    if (strain > 15)        { deficit = -200; deficitReason = 'Hoher Strain → kleines Defizit' }
    else if (recovery < 40) { deficit = -150; deficitReason = 'Niedrige Recovery → kleines Defizit' }
    else if (strain < 8)    { deficitReason = 'Niedriger Strain → volles Defizit' }
    else                    { deficitReason = 'Normaler Aktivitätstag' }
  }

  const adaptiveTarget = hasWhoop ? Math.max(1800, Math.round(dailyBurn + deficit)) : null
  const daysOfData     = whoopHistory.length
  const learningPct    = Math.min(100, Math.round((daysOfData / 30) * 100))

  const wt  = Number(profile?.weight)||75, ht = Number(profile?.height)||175, ag = Number(profile?.age)||25
  const bmr = profile?.gender === 'male' ? 10*wt+6.25*ht-5*ag+5 : 10*wt+6.25*ht-5*ag-161
  const mlt: Record<string, number> = { sedentary:1.2, light:1.375, moderate:1.55, active:1.725, very_active:1.9 }
  const formulaTarget = Math.round(bmr * (mlt[profile?.activityLevel ?? 'moderate'] ?? 1.55))

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
      <button className="glass-press w-full flex items-center gap-3 text-left" style={{ padding: '14px 16px' }} onClick={() => setOpen((v) => !v)}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: C.light, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Brain size={18} style={{ color: C.primary }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: C.text, fontSize: 15, fontWeight: 500 }}>Adaptives Kalorienziel</p>
          <p style={{ color: C.secondary, fontSize: 12 }}>
            {hasWhoop ? `${adaptiveTarget} kcal · Whoop-basiert` : 'Formel-basiert'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 11, color: C.primary }}>{daysOfData}/30d</span>
          {open ? <ChevronUp size={16} style={{ color: C.tertiary }} /> : <ChevronDown size={16} style={{ color: C.tertiary }} />}
        </div>
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: C.bg, borderRadius: 12, padding: '12px 14px', border: `1px solid ${C.border}` }}>
            {hasWhoop ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
                {[
                  { v: dailyBurn, l: 'Verbrauch' },
                  { v: Math.abs(deficit), l: 'Defizit' },
                  { v: adaptiveTarget, l: 'Ziel' },
                ].map(({ v, l }) => (
                  <div key={l}>
                    <p style={{ color: C.text, fontSize: 18, fontWeight: 600 }}>{v}</p>
                    <p style={{ color: C.tertiary, fontSize: 10 }}>{l} kcal</p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: C.secondary, fontSize: 13, textAlign: 'center' }}>
                Formel-TDEE: <strong style={{ color: C.text }}>{formulaTarget} kcal</strong>
              </p>
            )}
            {hasWhoop && <p style={{ color: C.tertiary, fontSize: 11, textAlign: 'center', marginTop: 6 }}>{deficitReason}</p>}
          </div>

          <div>
            <div className="flex justify-between" style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: C.secondary }}>Lernfortschritt</span>
              <span style={{ fontSize: 12, color: C.primary }}>{daysOfData} Tage</span>
            </div>
            <div style={{ height: 6, background: C.light, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${learningPct}%`, background: C.primary, borderRadius: 3, transition: 'width 0.7s ease' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const profile        = useStore((s) => s.profile)
  const foodLogs       = useStore((s) => s.foodLogs)
  const activityLogs   = useStore((s) => s.activityLogs)
  const waterLogs      = useStore((s) => s.waterLogs)
  const whoopData      = useStore((s) => s.whoopData)
  const whoopExtended  = useStore((s) => s.whoopExtended)
  const whoopHistory   = useStore((s) => s.whoopHistory)
  const whoopLastSync  = useStore((s) => s.whoopLastSyncAt)
  const cheatDays      = useStore((s) => s.cheatDays)
  const stepsToday     = useStore((s) => s.stepsToday)
  const setStepsToday  = useStore((s) => s.setStepsToday)
  const addWater       = useStore((s) => s.addWater)
  const addCheatDay    = useStore((s) => s.addCheatDay)
  const removeCheatDay = useStore((s) => s.removeCheatDay)
  const setActiveTab   = useStore((s) => s.setActiveTab)
  const setDailyScore      = useStore((s) => s.setDailyScore)
  const scoreHistory       = useStore((s) => s.scoreHistory)
  const apiKeys            = useStore((s) => s.apiKeys)
  const scoreComment       = useStore((s) => s.scoreComment)
  const scoreCommentDate   = useStore((s) => s.scoreCommentDate)
  const setScoreComment    = useStore((s) => s.setScoreComment)

  const [showBodyScan, setShowBodyScan] = useState(false)
  const [pullY, setPullY]        = useState(0)
  const [refreshing, setRefresh] = useState(false)
  const scrollRef  = useRef<HTMLDivElement>(null)
  const touchY0    = useRef(0)

  const onTouchStart = useCallback((e: React.TouchEvent) => { touchY0.current = e.touches[0].clientY }, [])
  const onTouchMove  = useCallback((e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop > 0) return
    const dy = e.touches[0].clientY - touchY0.current
    if (dy > 0) setPullY(Math.min(48, dy * 0.4))
  }, [])
  const onTouchEnd = useCallback(() => {
    if (pullY > 38) { setRefresh(true); setTimeout(() => { setRefresh(false); setPullY(0) }, 1200) }
    else setPullY(0)
  }, [pullY])

  const todayFoods = useMemo(() => foodLogs.filter((l) => l.date === today), [foodLogs])
  const todayActs  = useMemo(() => activityLogs.filter((l) => l.date === today), [activityLogs])
  const water      = useMemo(() => waterLogs.find((w) => w.date === today)?.amount ?? 0, [waterLogs])

  const calories = useMemo(() => todayFoods.reduce((s, f) => s + (f.macros?.calories ?? 0), 0), [todayFoods])
  const protein  = useMemo(() => todayFoods.reduce((s, f) => s + (f.macros?.protein  ?? 0), 0), [todayFoods])
  const fat      = useMemo(() => todayFoods.reduce((s, f) => s + (f.macros?.fat      ?? 0), 0), [todayFoods])
  const carbs    = useMemo(() => todayFoods.reduce((s, f) => s + (f.macros?.carbs    ?? 0), 0), [todayFoods])
  const burned   = useMemo(() => todayActs.reduce((s, a) => s + a.caloriesBurned, 0) + Math.round(stepsToday * 0.04), [todayActs, stepsToday])

  const target = useMemo(() => {
    if (!profile) return 2000
    const w = Number(profile.weight)||75, h = Number(profile.height)||175, a = Number(profile.age)||25
    const bmr = profile.gender === 'male' ? 10*w+6.25*h-5*a+5 : 10*w+6.25*h-5*a-161
    const m: Record<string,number> = { sedentary:1.2, light:1.375, moderate:1.55, active:1.725, very_active:1.9 }
    const tdee = bmr * (m[profile.activityLevel]??1.55)
    const wks  = Number(profile.targetWeeks)||12
    const delta = (w-(Number(profile.targetWeight)||w))*7700/wks
    if (profile.goal==='lose') return Math.max(1200, Math.round(tdee-delta/7))
    if (profile.goal==='gain') return Math.round(tdee+Math.abs(delta)/7)
    return Math.round(tdee)
  }, [profile])

  const macroT = useMemo(() => getMacroTargets(target), [target])

  // Rolling average of WHOOP dailyBurn (≥3 days → use learned burn; else today's value as fallback)
  const adjustedTarget = useMemo(() => {
    const burnHistory = whoopHistory
      .filter((h) => h.dailyBurn && h.dailyBurn > 500)
      .map((h) => h.dailyBurn!)
      .slice(-14)

    if (burnHistory.length >= 3) {
      const avgBurn = Math.round(burnHistory.reduce((s, b) => s + b, 0) / burnHistory.length)
      // Apply goal adjustment on top of learned burn
      if (!profile) return avgBurn
      const weeklyDelta = (Number(profile.weight) - (Number(profile.targetWeight) || Number(profile.weight))) * 7700 / (Number(profile.targetWeeks) || 12)
      let goalAdjust = 0
      if (profile.goal === 'lose') goalAdjust = -weeklyDelta / 7
      else if (profile.goal === 'gain') goalAdjust = Math.abs(weeklyDelta) / 7
      return Math.max(1500, Math.round(avgBurn + goalAdjust))
    }

    // Fallback: profile TDEE + today's WHOOP burn (wenn vorhanden)
    const todayBurn = whoopData?.date === today
      ? (whoopData.dailyBurn ?? whoopData.caloriesBurned ?? 0)
      : (whoopExtended?.date === today ? (whoopExtended.caloriesBurned ?? 0) : 0)
    return target + todayBurn
  }, [whoopHistory, whoopData, whoopExtended, target, profile])
  const net    = calories - burned
  const remain = adjustedTarget - net
  const waterPct = Math.min(1, water / waterGoal())

  const streak = useMemo(() => {
    let count = 0
    const d = new Date()
    for (let i = 0; i < 365; i++) {
      const ds = d.toISOString().split('T')[0]
      const c  = foodLogs.filter((l) => l.date===ds).reduce((s,f)=>s+(f.macros?.calories??0),0)
      const b  = activityLogs.filter((l) => l.date===ds).reduce((s,a)=>s+a.caloriesBurned,0)
      if (c>0 && Math.abs((c-b)-adjustedTarget)<=200) count++
      else if (i>0) break
      d.setDate(d.getDate()-1)
    }
    return count
  }, [foodLogs, activityLogs, adjustedTarget])

  // Score
  const nutritionScore = useMemo(() => {
    const protGoal  = (Number(profile?.weight) || 75) * 2
    const pRatio    = protGoal > 0 ? protein / protGoal : 0
    const proteinSc = pRatio >= 1.0 ? 60 : pRatio >= 0.9 ? 50 : pRatio >= 0.8 ? 40 : pRatio >= 0.7 ? 25 : Math.round(pRatio * 20)
    const deficit   = target - calories
    const calSc     = deficit >= 0 && deficit <= 500 ? 40 : deficit > 500 ? 25 : deficit >= -100 ? 30 : Math.max(0, Math.round(30 + (deficit + 100) / 10))
    return Math.min(100, proteinSc + calSc)
  }, [calories, target, protein, profile])

  const sportScore = useMemo(() => {
    const strainSc  = Math.min(50, ((whoopData?.strain ?? 0) / 21) * 50)
    const workoutSc = todayActs.length > 0 ? 30 : stepsToday >= 10000 ? 15 : 0
    const burnedSc  = Math.min(20, (burned / 400) * 20)
    return Math.min(100, Math.round(strainSc + workoutSc + burnedSc))
  }, [whoopData, stepsToday, todayActs, burned])

  const sleepScore = whoopData?.sleepQuality ?? 50
  const recScore   = whoopData?.recovery     ?? 50

  const dailyScore = useMemo(() => Math.round(
    nutritionScore * 0.35 + sportScore * 0.25 + sleepScore * 0.20 + recScore * 0.20
  ), [nutritionScore, sportScore, sleepScore, recScore])

  const commentGenRef = useRef(false)
  useEffect(() => {
    if (dailyScore > 0) setDailyScore(today, dailyScore)
    const apiKey = apiKeys.anthropic || apiKeys.openai
    if (dailyScore > 0 && apiKey && profile && scoreCommentDate !== today && !commentGenRef.current) {
      commentGenRef.current = true
      generateScoreComment(dailyScore, nutritionScore, sportScore, sleepScore, recScore, profile.name.split(' ')[0], apiKey)
        .then((c) => { if (c) setScoreComment(c, today) })
        .catch(() => {})
        .finally(() => { commentGenRef.current = false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyScore])

  const scoreHistoryArr = useMemo(() => {
    const arr: { date: string; score: number }[] = []
    const d = new Date()
    for (let i = 6; i >= 0; i--) {
      const dd = new Date(d); dd.setDate(d.getDate() - i)
      const ds = dd.toISOString().split('T')[0]
      arr.push({ date: ds, score: scoreHistory[ds] ?? 0 })
    }
    return arr
  }, [scoreHistory])

  const yesterday     = useMemo(() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().split('T')[0] }, [])
  const yesterdayScore = scoreHistory[yesterday] ?? 0
  const scoreDelta     = yesterdayScore > 0 ? dailyScore - yesterdayScore : null
  const scoreStreak    = useMemo(() => {
    let count = 0; const d = new Date()
    for (let i = 0; i < 30; i++) {
      const ds = d.toISOString().split('T')[0]
      if ((scoreHistory[ds] ?? 0) >= 70) count++; else break
      d.setDate(d.getDate()-1)
    }
    return count
  }, [scoreHistory])

  const isCheatDay = cheatDays.some((c) => c.date === today)
  const bmi        = profile ? getBMI(Number(profile.weight)||0, Number(profile.height)||1) : null
  const dateStr    = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

  // Shared card style
  const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '16px' }
  const cardSm = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '14px' }

  return (
    <div ref={scrollRef} className="pb-nav overflow-y-auto overflow-x-hidden h-dvh anim-fade"
      style={{ background: C.bg }}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>

      {/* Pull indicator */}
      {(pullY > 6 || refreshing) && (
        <div className="ptr" style={{ height: pullY || 36 }}>
          <span style={{ color: C.tertiary }}>{refreshing ? 'Aktualisiert…' : 'Loslassen'}</span>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="pt-safe px-5 pb-4" style={{ background: C.card, borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-start justify-between">
          <div>
            <p style={{ color: C.secondary, fontSize: 13, fontWeight: 500 }}>{greeting()}</p>
            <h1 style={{ color: C.text, fontSize: 26, fontWeight: 600, letterSpacing: '-0.5px', marginTop: 2, lineHeight: 1.1 }}>
              {profile?.name?.split(' ')[0] ?? 'Kalorilo'}
            </h1>
            <p style={{ color: C.tertiary, fontSize: 12, marginTop: 3 }}>{dateStr}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveTab('profile')} className="glass-press"
              style={{ width: 36, height: 36, borderRadius: 10, background: C.light, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Settings size={16} style={{ color: C.primary }} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Quote */}
        <p style={{ color: C.tertiary, fontSize: 12, fontStyle: 'italic', marginTop: 12, lineHeight: 1.5 }}>
          {getTodayQuote()}
        </p>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div style={{ padding: '14px 14px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* ── Score Ring Card ── */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 24, paddingBottom: 20 }}>
          <DailyScoreRing score={dailyScore} size={160} />

          <div style={{ textAlign: 'center' }}>
            <p style={{ color: scoreColor(dailyScore), fontSize: 16, fontWeight: 500 }}>{scoreLabel(dailyScore)}</p>
            {scoreDelta !== null && (
              <p style={{ color: scoreDelta >= 0 ? C.primary : C.secondary, fontSize: 12, marginTop: 3 }}>
                {scoreDelta >= 0 ? `+${scoreDelta}` : `${scoreDelta}`} vs. gestern
              </p>
            )}
            {scoreStreak >= 3 && (
              <p style={{ color: C.primary, fontSize: 11, marginTop: 3 }}>{scoreStreak} Tage ≥ 70</p>
            )}
            {scoreComment && scoreCommentDate === today && (
              <p style={{ color: C.tertiary, fontSize: 12, marginTop: 8, fontStyle: 'italic', lineHeight: 1.5, maxWidth: 260, margin: '8px auto 0' }}>
                {scoreComment}
              </p>
            )}
          </div>

          {/* Sub-scores */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
            <ScoreRow label="Ernährung" value={nutritionScore} />
            <ScoreRow label="Sport"     value={sportScore} />
            <ScoreRow label="Schlaf"    value={sleepScore} />
            <ScoreRow label="Recovery"  value={recScore} />
          </div>
        </div>

        {/* ── 2×2 Grid: Protein, Kalorien, Training, Schlaf ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

          {/* Protein */}
          <div style={{ ...cardSm, background: C.light, border: `1px solid ${C.border}` }}>
            <p style={{ color: C.secondary, fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Protein</p>
            <p style={{ color: C.text, fontSize: 36, fontWeight: 600, lineHeight: 1, marginTop: 6, letterSpacing: '-1px' }}>{Math.round(protein)}</p>
            <p style={{ color: C.secondary, fontSize: 12, marginTop: 2 }}>/ {macroT.protein}g</p>
            <div style={{ height: 4, background: 'rgba(90,138,106,0.15)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, macroT.protein > 0 ? (protein/macroT.protein)*100 : 0)}%`, background: C.primary, borderRadius: 2, transition: 'width 0.8s ease' }} />
            </div>
          </div>

          {/* Kalorien */}
          <button onClick={() => setActiveTab('food')} className="glass-press" style={{ ...cardSm, textAlign: 'left', width: '100%' }}>
            <p style={{ color: C.secondary, fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Übrig</p>
            <p style={{ color: remain >= 0 ? C.text : '#e07070', fontSize: 36, fontWeight: 600, lineHeight: 1, marginTop: 6, letterSpacing: '-1px' }}>
              {remain >= 0 ? Math.round(remain) : `-${Math.abs(Math.round(remain))}`}
            </p>
            <p style={{ color: C.tertiary, fontSize: 12, marginTop: 2 }}>{Math.round(calories)} gegessen</p>
            <div style={{ height: 4, background: C.light, borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, adjustedTarget > 0 ? (calories/adjustedTarget)*100 : 0)}%`, background: remain >= 0 ? C.primary : '#e07070', borderRadius: 2, transition: 'width 0.8s ease' }} />
            </div>
          </button>

          {/* Training */}
          <button onClick={() => setActiveTab('sport')} className="glass-press" style={{ ...cardSm, textAlign: 'left', width: '100%' }}>
            <p style={{ color: C.secondary, fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Training</p>
            <p style={{ color: C.text, fontSize: 36, fontWeight: 600, lineHeight: 1, marginTop: 6, letterSpacing: '-1px' }}>{todayActs.length}</p>
            <p style={{ color: C.secondary, fontSize: 12, marginTop: 2 }}>Einheiten heute</p>
            {burned > 0 && <p style={{ color: C.primary, fontSize: 11, marginTop: 6 }}>{Math.round(burned)} kcal verbrannt</p>}
          </button>

          {/* Schlaf */}
          <div style={cardSm}>
            <p style={{ color: C.secondary, fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Schlaf</p>
            <p style={{ color: C.text, fontSize: 36, fontWeight: 600, lineHeight: 1, marginTop: 6, letterSpacing: '-1px' }}>
              {whoopData?.sleepDuration ? `${whoopData.sleepDuration}h` : '—'}
            </p>
            <p style={{ color: C.secondary, fontSize: 12, marginTop: 2 }}>
              {whoopData?.sleepQuality ? `${whoopData.sleepQuality}% Qualität` : 'kein Whoop'}
            </p>
          </div>
        </div>

        {/* ── Wasser ── */}
        <div style={card}>
          <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
            <div className="flex items-center gap-2">
              <Droplets size={16} style={{ color: C.primary }} strokeWidth={1.5} />
              <p style={{ color: C.text, fontSize: 14, fontWeight: 500 }}>Wasser</p>
            </div>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>
              {water}<span style={{ color: C.tertiary, fontSize: 12, fontWeight: 400 }}> / {waterGoal()} ml</span>
            </p>
          </div>
          <div style={{ height: 6, background: C.light, borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ height: '100%', width: `${waterPct * 100}%`, background: C.primary, borderRadius: 3, transition: 'width 0.7s ease' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[150, 250, 500].map((ml) => (
              <button key={ml} onClick={() => addWater(today, ml)} className="glass-press"
                style={{ flex: 1, padding: '8px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.secondary, fontSize: 13, fontWeight: 500 }}>
                +{ml}ml
              </button>
            ))}
          </div>
        </div>

        {/* ── Schritte ── */}
        <div style={card}>
          <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
            <div className="flex items-center gap-2">
              <Footprints size={16} style={{ color: C.primary }} strokeWidth={1.5} />
              <p style={{ color: C.text, fontSize: 14, fontWeight: 500 }}>Schritte</p>
            </div>
            <p style={{ color: stepsToday >= 10000 ? C.primary : C.text, fontSize: 14, fontWeight: 600 }}>
              {stepsToday.toLocaleString('de')}
              <span style={{ color: C.tertiary, fontSize: 12, fontWeight: 400 }}> / 10.000</span>
            </p>
          </div>
          <div style={{ height: 6, background: C.light, borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ height: '100%', width: `${Math.min(100, (stepsToday/10000)*100)}%`, background: C.primary, borderRadius: 3, transition: 'width 0.7s ease' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1000, 2000, 5000].map((s) => (
              <button key={s} onClick={() => setStepsToday(Math.min(50000, stepsToday + s))} className="glass-press"
                style={{ flex: 1, padding: '8px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.secondary, fontSize: 13, fontWeight: 500 }}>
                +{(s/1000).toFixed(0)}k
              </button>
            ))}
          </div>
        </div>

        {/* ── Makros ── */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ color: C.secondary, fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Makros heute</p>
          {[
            { label: 'Eiweiß',        value: protein, max: macroT.protein, unit: 'g' },
            { label: 'Kohlenhydrate', value: carbs,   max: macroT.carbs,   unit: 'g' },
            { label: 'Fett',          value: fat,     max: macroT.fat,     unit: 'g' },
          ].map(({ label, value, max, unit }) => {
            const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
            return (
              <div key={label}>
                <div className="flex justify-between" style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: C.secondary }}>{label}</span>
                  <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{Math.round(value)}{unit} <span style={{ color: C.tertiary, fontWeight: 400 }}>/ {max}{unit}</span></span>
                </div>
                <div style={{ height: 5, background: C.light, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: C.primary, borderRadius: 3, transition: 'width 0.7s ease' }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Whoop ── */}
        <WhoopWidget
          whoopData={whoopData}
          whoopHistory={whoopHistory}
          lastSyncAt={whoopLastSync}
          onConnect={() => setActiveTab('profile')}
        />

        {/* ── Energie-Plan ── */}
        <EnergyPlanCard whoopData={whoopData} />

        {/* ── Protein Tracker ── */}
        <ProteinTrackerCard />

        {/* ── Adaptives TDEE ── */}
        <AdaptiveTDEECard />

        {/* ── Quick Actions ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button onClick={() => setActiveTab('food')} className="glass-press"
            style={{ ...cardSm, display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.light, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Plus size={18} style={{ color: C.primary }} strokeWidth={1.5} />
            </div>
            <div>
              <p style={{ color: C.text, fontSize: 14, fontWeight: 500 }}>Essen</p>
              <p style={{ color: C.secondary, fontSize: 11 }}>Eintragen</p>
            </div>
          </button>
          <button onClick={() => setActiveTab('sport')} className="glass-press"
            style={{ ...cardSm, display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.light, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Zap size={18} style={{ color: C.primary }} strokeWidth={1.5} />
            </div>
            <div>
              <p style={{ color: C.text, fontSize: 14, fontWeight: 500 }}>Sport</p>
              <p style={{ color: C.secondary, fontSize: 11 }}>Aktivität</p>
            </div>
          </button>
        </div>

        {/* ── Score Verlauf ── */}
        <div style={card}>
          <p style={{ color: C.secondary, fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 14 }}>7-Tage Score</p>
          <ScoreBarChart scores={scoreHistoryArr} />
        </div>

        {/* ── Streak + BMI ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: 'Kcal-Streak', value: streak,      unit: 'Tage' },
            { label: 'Score ≥70',   value: scoreStreak, unit: 'Tage' },
            { label: 'BMI',         value: bmi ?? '–',  unit: '' },
          ].map(({ label, value, unit }) => (
            <div key={label} style={{ ...cardSm, textAlign: 'center' }}>
              <p style={{ color: C.text, fontSize: 22, fontWeight: 600 }}>{value}</p>
              {unit && <p style={{ color: C.tertiary, fontSize: 10, marginTop: 1 }}>{unit}</p>}
              <p style={{ color: C.secondary, fontSize: 10, marginTop: 2 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* ── Muskel-Regeneration ── */}
        <MuscleTrackerCard activityLogs={activityLogs} />

        {/* ── Körper Scan ── */}
        <button onClick={() => setShowBodyScan(true)} className="glass-press w-full"
          style={{ ...cardSm, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: C.light, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>🏋️</div>
          <div style={{ flex: 1 }}>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 500 }}>Körper Scan</p>
            <p style={{ color: C.secondary, fontSize: 12 }}>KI schätzt Körperfett & Body Type</p>
          </div>
          <ChevronRight size={16} style={{ color: C.tertiary, flexShrink: 0 }} strokeWidth={1.5} />
        </button>

        {/* ── KI-Berater ── */}
        <button onClick={() => setActiveTab('ai')} className="glass-press w-full"
          style={{ ...cardSm, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: C.light, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>🤖</div>
          <div style={{ flex: 1 }}>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 500 }}>KI-Ernährungsberater</p>
            <p style={{ color: C.secondary, fontSize: 12 }}>Frag mich alles rund ums Essen</p>
          </div>
          <ChevronRight size={16} style={{ color: C.tertiary, flexShrink: 0 }} strokeWidth={1.5} />
        </button>

        {/* ── Heute gegessen ── */}
        {todayFoods.length > 0 && (
          <div style={card}>
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <p style={{ color: C.secondary, fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Heute gegessen</p>
              <button onClick={() => setActiveTab('food')} style={{ color: C.primary, fontSize: 12, fontWeight: 500 }}>Alle</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todayFoods.slice(-3).map((log) => (
                <div key={log.id} className="flex items-center justify-between">
                  <div style={{ minWidth: 0 }}>
                    <p style={{ color: C.text, fontSize: 13, fontWeight: 500 }} className="truncate">{log.foodItem.name}</p>
                    <p style={{ color: C.tertiary, fontSize: 11 }}>{log.amount}g</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    <p style={{ color: C.text, fontSize: 13, fontWeight: 500 }}>{Math.round(log.macros?.calories ?? 0)} kcal</p>
                    <p style={{ color: C.primary, fontSize: 11 }}>{Math.round(log.macros?.protein ?? 0)}g P</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Cheat Day ── */}
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: C.light, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>🍕</div>
          <div style={{ flex: 1 }}>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 500 }}>Cheat Day</p>
            <p style={{ color: C.secondary, fontSize: 12 }}>{isCheatDay ? 'Heute aktiv' : 'Nicht aktiv'}</p>
          </div>
          <button onClick={() => isCheatDay ? removeCheatDay(today) : addCheatDay({ date: today })}
            className="glass-press"
            style={{ padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 500, background: isCheatDay ? C.light : C.bg, border: `1px solid ${isCheatDay ? C.primary + '44' : C.border}`, color: isCheatDay ? C.primary : C.secondary }}>
            {isCheatDay ? 'Deaktivieren' : 'Aktivieren'}
          </button>
        </div>

      </div>

      {/* Body Scan overlay */}
      {showBodyScan && (
        <Suspense fallback={null}>
          <BodyScanScreen onClose={() => setShowBodyScan(false)} />
        </Suspense>
      )}
    </div>
  )
}
