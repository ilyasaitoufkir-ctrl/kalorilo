import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { Settings, Droplets, Zap, Plus, ChevronRight, Footprints, RefreshCw, ChevronDown, ChevronUp, Loader } from 'lucide-react'
import { useStore } from '../store/useStore'
import { formatDate, getMacroTargets, getTodayQuote, waterGoal, getBMI } from '../utils/calculations'
import { generateEnergyPlan, getMuscleRecovery } from '../utils/insights'
import { generateScoreComment, getProteinHelp } from '../utils/api'
import type { WhoopData, WhoopDayHistory, ActivityLog } from '../types'

const today = formatDate()

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Guten Morgen'
  if (h < 18) return 'Guten Tag'
  return 'Guten Abend'
}

// ── Calorie Ring (hero) ───────────────────────────────────────────────────
function CalorieRing({ consumed, target, size = 180 }: { consumed: number; target: number; size?: number }) {
  const pct  = target > 0 ? Math.min(1, consumed / target) : 0
  const stroke = 18
  const r    = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = circ * pct
  const id   = 'ringGrad'
  return (
    <svg width={size} height={size} style={{ filter: 'drop-shadow(0 0 24px rgba(74,140,92,0.3))' }}>
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#a8c5a0" />
          <stop offset="50%"  stopColor="#7db88a" />
          <stop offset="100%" stopColor="#4a8c5c" />
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="rgba(74,140,92,0.12)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={`url(#${id})`} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.16,1,0.3,1)' }}
      />
    </svg>
  )
}

// ── Macro chip ────────────────────────────────────────────────────────────
function MacroCard({ label, value, max, color, unit = 'g' }: {
  label: string; value: number; max: number; color: string; unit?: string
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="glass flex-1 p-3 flex flex-col gap-2" style={{ minWidth: 0 }}>
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        <span className="text-xs font-bold" style={{ color }}>{Math.round(value)}{unit}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(74,140,92,0.08)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs" style={{ color: 'var(--text-3)' }}>/{max}{unit}</span>
    </div>
  )
}

// ── Daily Score helpers ───────────────────────────────────────────────────
function scoreColor(s: number) {
  if (s >= 85) return '#10b981'
  if (s >= 70) return '#22c55e'
  if (s >= 55) return '#f59e0b'
  if (s >= 40) return '#f97316'
  return '#ef4444'
}
function scoreLabel(s: number) {
  if (s >= 85) return '🔥 Ausgezeichnet!'
  if (s >= 70) return '💪 Sehr gut!'
  if (s >= 55) return '👍 Gut!'
  if (s >= 40) return '⚡ Verbesserungspotenzial'
  return '😴 Schlechter Tag'
}

// ── Large animated score ring ─────────────────────────────────────────────
function DailyScoreRing({ score, size = 180 }: { score: number; size?: number }) {
  const stroke = 16
  const r      = (size - stroke) / 2
  const circ   = 2 * Math.PI * r
  const dash   = circ * (Math.min(100, score) / 100)
  const color  = scoreColor(score)
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{
            transition: 'stroke-dasharray 1.5s cubic-bezier(0.16,1,0.3,1)',
            filter: `drop-shadow(0 0 12px ${color}99)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        <span className="font-black leading-none" style={{ fontSize: 48, color }}>{score}</span>
        <span className="text-[11px] font-bold mt-1" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>SCORE</span>
      </div>
    </div>
  )
}

// ── Small sub-ring ────────────────────────────────────────────────────────
function MiniScoreRing({ value, label, icon, color, size = 56 }: {
  value: number; label: string; icon: string; color: string; size?: number
}) {
  const stroke = 4.5
  const r      = (size - stroke) / 2
  const circ   = 2 * Math.PI * r
  const dash   = circ * (Math.min(100, value) / 100)
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ position: 'absolute' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke={color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            transform={`rotate(-90 ${size/2} ${size/2})`}
            style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.16,1,0.3,1)' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: 18 }}>{icon}</div>
      </div>
      <p className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</p>
      <p className="text-xs font-black" style={{ color }}>{Math.round(value)}</p>
    </div>
  )
}

// ── 7-day score bar chart ─────────────────────────────────────────────────
function ScoreBarChart({ scores }: { scores: { date: string; score: number }[] }) {
  if (scores.length === 0) return null
  const maxVal  = Math.max(...scores.map((s) => s.score), 1)
  const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
  const todayStr = new Date().toISOString().split('T')[0]
  return (
    <div className="flex items-end gap-1.5" style={{ height: 80 }}>
      {scores.map((s) => {
        const isToday = s.date === todayStr
        const color   = s.score > 0 ? scoreColor(s.score) : 'rgba(255,255,255,0.08)'
        const barH    = s.score > 0 ? Math.max(6, (s.score / maxVal) * 56) : 6
        const dayName = dayNames[new Date(s.date).getDay()]
        return (
          <div key={s.date} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[9px] font-black" style={{ color: isToday && s.score > 0 ? color : 'transparent' }}>
              {s.score > 0 ? s.score : '–'}
            </span>
            <div className="w-full rounded-t-xl transition-all duration-700"
              style={{
                height: barH,
                background: isToday ? color : `${color}55`,
                boxShadow: isToday && s.score > 0 ? `0 -4px 14px ${color}55` : 'none',
              }} />
            <span className="text-[9px]" style={{ color: isToday ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)' }}>
              {dayName}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Whoop recovery helpers ────────────────────────────────────────────────
function recoveryColor(r: number) {
  if (r >= 67) return '#10b981'
  if (r >= 34) return '#f59e0b'
  return '#ef4444'
}
function recoveryLabel(r: number) {
  if (r >= 67) return 'Vollgas! 💪'
  if (r >= 34) return 'Moderat 🟡'
  return 'Ruhetag 🔴'
}
function recoveryAdvice(d: WhoopData): string {
  const r      = d.recovery
  const strain = d.strain ?? 0
  const sleep  = d.sleepDuration ?? 0
  if (r >= 67) {
    if (strain > 15) return 'Hoher Strain gestern – heute lockerer Ausdauertag empfohlen'
    return 'Hohe Recovery – perfekter Tag für intensives Krafttraining! 💪'
  }
  if (r >= 34) return 'Mittlere Recovery – leichtes Training oder Spaziergang empfohlen'
  const sleepNote = sleep > 0 && sleep < 6 ? ' & Schlaf nachholen' : ''
  return `Niedrige Recovery – Ruhetag empfohlen${sleepNote}. Iss viel Protein!`
}
function sleepAdvice(d: WhoopData): string {
  const dur = d.sleepDuration ?? 0
  const q   = d.sleepQuality  ?? 0
  if (dur === 0)   return ''
  if (dur < 5)     return `Nur ${dur}h Schlaf – heute mehr Protein & leichtes Training!`
  if (dur < 6.5)   return `${dur}h Schlaf – genug Eiweiß & Erholung einplanen`
  if (q >= 80)     return 'Exzellenter Schlaf – perfekter Tag zum Trainieren! 🎯'
  return 'Guter Schlaf – du bist bereit für den Tag!'
}

// ── Whoop recovery mini-ring ──────────────────────────────────────────────
function RecoveryRing({ value, size = 72 }: { value: number; size?: number }) {
  const stroke = 7
  const r      = (size - stroke) / 2
  const circ   = 2 * Math.PI * r
  const dash   = circ * Math.min(1, value / 100)
  const color  = recoveryColor(value)
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.16,1,0.3,1)', filter: `drop-shadow(0 0 6px ${color}66)` }}
      />
    </svg>
  )
}

// ── 7-day sparkline ───────────────────────────────────────────────────────
function Sparkline({ data, color = '#10b981' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null
  const max  = Math.max(...data, 1)
  const min  = Math.min(...data)
  const w    = 100
  const h    = 28
  const pad  = 3
  const pts  = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2)
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 3px ${color}88)` }} />
      {data.map((v, i) => {
        const x = pad + (i / (data.length - 1)) * (w - pad * 2)
        const y = h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2)
        return <circle key={i} cx={x} cy={y} r="2.5" fill={color} />
      })}
    </svg>
  )
}

// ── Full Whoop Widget ─────────────────────────────────────────────────────
function WhoopWidget({
  whoopData, whoopHistory, lastSyncAt, onConnect,
}: {
  whoopData:    WhoopData | null
  whoopHistory: WhoopDayHistory[]
  lastSyncAt:   number
  onConnect:    () => void
}) {
  const minAgo = lastSyncAt > 0
    ? Math.round((Date.now() - lastSyncAt) / 60000)
    : null

  if (!whoopData) {
    return (
      <button onClick={onConnect}
        className="glass glass-press p-4 w-full flex items-center gap-3 text-left">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background:'rgba(74,140,92,0.06)', border:'1px solid rgba(125,184,138,0.2)' }}>⌚</div>
        <div className="flex-1" style={{ minWidth:0 }}>
          <p className="text-sm font-black" style={{ color:'var(--text-1)' }}>Whoop verbinden</p>
          <p className="text-xs" style={{ color:'var(--text-3)' }}>Recovery, Schlaf & Workouts automatisch</p>
        </div>
        <ChevronRight size={16} style={{ color:'var(--text-3)', flexShrink:0 }}/>
      </button>
    )
  }

  const rc     = recoveryColor(whoopData.recovery)
  const sleep  = whoopData.sleepDuration   ?? 0
  const deep   = whoopData.deepSleep       ?? 0
  const rem    = whoopData.remSleep        ?? 0
  const rrate  = whoopData.respiratoryRate ?? 0
  const strain = whoopData.strain          ?? 0
  const burned = whoopData.caloriesBurned  ?? 0
  const daily  = whoopData.dailyBurn       ?? 0

  const recoveryHistory = whoopHistory.map((d) => d.recovery)
  const sleepHistory    = whoopHistory.map((d) => d.sleepDuration)

  return (
    <div className="glass p-4" style={{ background: '#080808', border: '1px solid #1a1a1a' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span style={{ fontSize: 16 }}>⌚</span>
        <p className="text-sm font-black tracking-wide" style={{ color: '#fff' }}>WHOOP</p>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
          style={{ background:'rgba(16,185,129,0.15)', color:'#10b981' }}>● Live</span>
        {minAgo !== null && (
          <span className="ml-auto text-[10px] flex items-center gap-1" style={{ color: '#555' }}>
            <RefreshCw size={9} />
            {minAgo === 0 ? 'gerade' : `vor ${minAgo} Min.`}
          </span>
        )}
      </div>

      {/* Recovery + Vitals */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex items-center justify-center" style={{ width: 72, height: 72, flexShrink: 0 }}>
          <RecoveryRing value={whoopData.recovery} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-black leading-none" style={{ color: rc }}>{whoopData.recovery}%</span>
          </div>
        </div>
        <div className="flex-1" style={{ minWidth: 0 }}>
          <p className="text-base font-black mb-1.5" style={{ color: rc }}>{recoveryLabel(whoopData.recovery)}</p>
          <div className="flex flex-col gap-0.5">
            {whoopData.hrv > 0 && (
              <p className="text-xs" style={{ color: '#888' }}>
                HRV: <span className="font-bold" style={{ color: '#60a5fa' }}>{whoopData.hrv} ms</span>
              </p>
            )}
            {whoopData.restingHR > 0 && (
              <p className="text-xs" style={{ color: '#888' }}>
                Ruhe: <span className="font-bold" style={{ color: '#f87171' }}>{whoopData.restingHR} bpm</span>
              </p>
            )}
            {rrate > 0 && (
              <p className="text-xs" style={{ color: '#888' }}>
                Atem: <span className="font-bold" style={{ color: '#c084fc' }}>{rrate} /min</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Sleep */}
      {sleep > 0 && (
        <div className="rounded-2xl p-3 mb-3"
          style={{ background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.12)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold" style={{ color: '#a78bfa' }}>😴 Schlaf letzte Nacht</p>
            {whoopData.sleepQuality > 0 && (
              <p className="text-xs font-black" style={{ color: '#a78bfa' }}>{whoopData.sleepQuality}%</p>
            )}
          </div>
          <p className="text-xl font-black mb-2" style={{ color: '#fff' }}>{sleep}h</p>
          <div className="h-1.5 rounded-full mb-2" style={{ background: 'rgba(167,139,250,0.15)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, (sleep / 8) * 100)}%`, background: 'linear-gradient(90deg,#a78bfa,#7c3aed)' }} />
          </div>
          <div className="flex gap-2 mb-2">
            {deep > 0 && (
              <span className="text-xs px-2 py-1 rounded-xl font-semibold"
                style={{ background:'rgba(59,130,246,0.1)', color:'#60a5fa' }}>💤 {deep}h Tief</span>
            )}
            {rem > 0 && (
              <span className="text-xs px-2 py-1 rounded-xl font-semibold"
                style={{ background:'rgba(167,139,250,0.1)', color:'#a78bfa' }}>🌙 {rem}h REM</span>
            )}
          </div>
          <p className="text-[10px]" style={{ color: '#666' }}>{sleepAdvice(whoopData)}</p>
        </div>
      )}

      {/* Strain + Calories */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-2xl p-2.5"
          style={{ background: 'rgba(251,146,60,0.07)', border: '1px solid rgba(251,146,60,0.1)' }}>
          <p className="text-[10px] mb-1" style={{ color: '#888' }}>Strain heute</p>
          <p className="text-xl font-black mb-1.5" style={{ color: '#fb923c' }}>{strain.toFixed(1)}</p>
          <div className="h-1 rounded-full" style={{ background: 'rgba(251,146,60,0.15)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(strain / 21) * 100}%`, background: '#fb923c' }} />
          </div>
          <p className="text-[10px] mt-1" style={{ color: '#555' }}>
            {strain > 17 ? 'Extrem' : strain > 14 ? 'Hoch' : strain > 10 ? 'Mittel' : strain > 0 ? 'Leicht' : '–'}
          </p>
        </div>
        <div className="rounded-2xl p-2.5"
          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.1)' }}>
          <p className="text-[10px] mb-1" style={{ color: '#888' }}>🔥 Verbrannt</p>
          {burned > 0 ? (
            <>
              <p className="text-xl font-black mb-0.5" style={{ color: '#f87171' }}>{burned} kcal</p>
              <p className="text-[10px]" style={{ color: '#555' }}>Workouts</p>
            </>
          ) : daily > 0 ? (
            <>
              <p className="text-xl font-black mb-0.5" style={{ color: '#f87171' }}>{daily} kcal</p>
              <p className="text-[10px]" style={{ color: '#555' }}>gesamt heute</p>
            </>
          ) : (
            <p className="text-sm font-bold mt-2" style={{ color: '#444' }}>–</p>
          )}
        </div>
      </div>

      {/* Recommendation */}
      <div className="rounded-2xl px-3 py-2.5 mb-3"
        style={{ background: `${rc}11`, border: `1px solid ${rc}22` }}>
        <p className="text-xs font-bold" style={{ color: rc }}>{recoveryAdvice(whoopData)}</p>
      </div>

      {/* 7-day trends */}
      {recoveryHistory.length > 1 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold" style={{ color: '#444' }}>7 Tage Recovery</p>
            <div className="flex gap-2">
              {whoopHistory.slice(-3).map((d) => (
                <span key={d.date} className="text-[9px] font-bold" style={{ color: recoveryColor(d.recovery) }}>
                  {d.recovery}%
                </span>
              ))}
            </div>
          </div>
          <Sparkline data={recoveryHistory} color={rc} />
          {sleepHistory.some((v) => v > 0) && (
            <>
              <p className="text-[10px] font-semibold mt-2 mb-1" style={{ color: '#444' }}>7 Tage Schlaf</p>
              <Sparkline data={sleepHistory} color="#a78bfa" />
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Energie-Plan Card ─────────────────────────────────────────────────────
function EnergyPlanCard({ whoopData }: { whoopData: WhoopData | null }) {
  const [open, setOpen] = useState(false)
  const plan = useMemo(() => generateEnergyPlan(whoopData), [whoopData])
  const r = whoopData?.recovery ?? 50
  const label = r >= 67 ? 'Hochleistung heute' : r < 34 ? 'Erholungstag heute' : 'Normaler Tag heute'
  const labelColor = r >= 67 ? '#10b981' : r < 34 ? '#f59e0b' : '#60a5fa'

  return (
    <div className="glass overflow-hidden">
      <button className="w-full p-4 flex items-center gap-3 text-left" onClick={() => setOpen((v) => !v)}>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>⚡</div>
        <div className="flex-1" style={{ minWidth: 0 }}>
          <p className="text-sm font-black" style={{ color: 'var(--text-1)' }}>Dein Energie-Plan</p>
          <p className="text-xs font-semibold" style={{ color: labelColor }}>{label}</p>
        </div>
        {open
          ? <ChevronUp size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          : <ChevronDown size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2.5">
          {plan.map((block) => {
            const now = new Date()
            const [startH] = block.time.split('–').map(Number)
            const isCurrent = now.getHours() >= startH && now.getHours() < startH + 2
            return (
              <div key={block.time} className={`flex items-start gap-3 rounded-2xl px-3 py-2.5 transition-all ${isCurrent ? 'ring-1' : ''}`}
                style={{
                  background: isCurrent ? `${block.color}18` : 'rgba(255,255,255,0.02)',
                  border: isCurrent ? `1px solid ${block.color}44` : '1px solid transparent',
                }}>
                <span className="text-lg flex-shrink-0 mt-0.5">{block.icon}</span>
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold tabular-nums" style={{ color: block.color }}>{block.time}</span>
                    {isCurrent && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                      style={{ background: `${block.color}22`, color: block.color }}>JETZT</span>}
                  </div>
                  <p className="text-xs font-semibold mt-0.5" style={{ color: isCurrent ? 'var(--text-1)' : 'var(--text-2)' }}>{block.label}</p>
                  {block.tip && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>{block.tip}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Muskel-Regenerations Card ─────────────────────────────────────────────
function MuscleTrackerCard({ activityLogs }: { activityLogs: ActivityLog[] }) {
  const muscles = useMemo(() => getMuscleRecovery(activityLogs), [activityLogs])
  if (muscles.length === 0) return null

  const ready    = muscles.filter((m) => m.ready)
  const notReady = muscles.filter((m) => !m.ready)

  return (
    <div className="glass p-4">
      <div className="flex items-center gap-2 mb-3">
        <span style={{ fontSize: 18 }}>💪</span>
        <p className="text-sm font-black" style={{ color: 'var(--text-1)' }}>Muskel-Regeneration</p>
        {ready.length > 0 && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-bold"
            style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
            {ready.length} bereit
          </span>
        )}
      </div>

      {notReady.length > 0 && (
        <div className="space-y-2 mb-3">
          {notReady.map((m) => (
            <div key={m.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>
                  {m.emoji} {m.name}
                </span>
                <span className="text-xs font-bold" style={{ color: m.pctRecovered >= 75 ? '#f59e0b' : '#ef4444' }}>
                  {m.pctRecovered}%
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${m.pctRecovered}%`,
                    background: m.pctRecovered >= 75 ? '#f59e0b' : '#ef4444',
                  }} />
              </div>
              {m.lastSport && (
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                  Letzter Sport: {m.lastSport}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {ready.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {ready.map((m) => (
            <span key={m.name} className="text-xs px-2.5 py-1 rounded-full font-bold"
              style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
              {m.emoji} {m.name} ✓
            </span>
          ))}
        </div>
      )}

      {notReady.length > 0 && (
        <p className="text-[10px] mt-2" style={{ color: 'var(--text-3)' }}>
          💡 Trainiere heute: {ready.map((m) => m.name).join(', ') || 'Ruhetag empfohlen'}
        </p>
      )}
    </div>
  )
}

// ── Protein Tracker ───────────────────────────────────────────────────────
const PGOAL = 170

function pColor(g: number): string {
  if (g >= PGOAL) return '#f59e0b'
  if (g >= 141)   return '#10b981'
  if (g >= 101)   return '#eab308'
  if (g >= 51)    return '#f97316'
  return '#ef4444'
}

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
  const [showGraph, setShowGraph]     = useState(false)

  const todayFoods = useMemo(() => foodLogs.filter((l) => l.date === todayStr), [foodLogs, todayStr])
  const protein    = useMemo(() => Math.round(todayFoods.reduce((s, f) => s + (f.macros?.protein ?? 0), 0)), [todayFoods])
  const remaining  = Math.max(0, PGOAL - protein)
  const pct        = Math.min(100, Math.round((protein / PGOAL) * 100))
  const color      = pColor(protein)

  // Streak: consecutive days (including today if goal met)
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

  // Weekly: days in last 7 where goal met
  const weeklyDays = useMemo(() => {
    let count = 0
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const ds = d.toISOString().split('T')[0]
      const p  = i === 0 ? protein : foodLogs.filter((l) => l.date === ds).reduce((s, f) => s + (f.macros?.protein ?? 0), 0)
      if (p >= PGOAL) count++
    }
    return count
  }, [protein, foodLogs])

  // Hourly accumulation for graph
  const hourlyData = useMemo(() => {
    const byHour: Record<number, number> = {}
    todayFoods.forEach((l) => {
      const h = new Date(l.timestamp).getHours()
      byHour[h] = (byHour[h] || 0) + (l.macros?.protein ?? 0)
    })
    let cum = 0
    return Array.from({ length: 17 }, (_, i) => i + 6).map((h) => {
      cum += byHour[h] || 0
      return { h, actual: Math.round(cum), ideal: Math.round(Math.min(PGOAL, ((h - 6) / 16) * PGOAL)) }
    })
  }, [todayFoods])

  const nowH        = new Date().getHours()
  const idealNow    = Math.min(PGOAL, Math.max(0, ((nowH - 6) / 16) * PGOAL))
  const behindIdeal = protein < idealNow - 15 && nowH >= 9

  const LEGEND = [
    { max: 50,   color: '#ef4444', label: '0–50g 🔴'    },
    { max: 100,  color: '#f97316', label: '51–100g 🟠'   },
    { max: 140,  color: '#eab308', label: '101–140g 🟡'  },
    { max: 170,  color: '#10b981', label: '141–170g 🟢'  },
    { max: 9999, color: '#f59e0b', label: '170g+ 🏆'     },
  ]
  const activeIdx = LEGEND.findIndex((l, i) => protein <= l.max || i === LEGEND.length - 1)

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

  // Ring SVG
  const ringSize = 140, ringStroke = 14
  const ringR    = (ringSize - ringStroke) / 2
  const ringCirc = 2 * Math.PI * ringR
  const ringDash = ringCirc * Math.min(1, protein / PGOAL)

  return (
    <div className="glass p-4" style={{ border: `1px solid ${color}22` }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-black" style={{ color: 'var(--text-1)' }}>🥩 Protein-Tracker</p>
        <div className="flex items-center gap-2">
          {proteinStreak >= 2 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>
              🔥 {proteinStreak}d Streak
            </span>
          )}
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
            style={{ background: `${color}15`, color }}>
            {weeklyDays}/7 Tage
          </span>
        </div>
      </div>

      {/* Ring + Stats row */}
      <div className="flex items-center gap-4 mb-4">
        {/* Protein Ring */}
        <div className="relative flex items-center justify-center flex-shrink-0"
          style={{ width: ringSize, height: ringSize }}>
          <svg width={ringSize} height={ringSize} style={{ position: 'absolute' }}>
            <circle cx={ringSize/2} cy={ringSize/2} r={ringR} fill="none"
              stroke="rgba(255,255,255,0.06)" strokeWidth={ringStroke} />
            <circle cx={ringSize/2} cy={ringSize/2} r={ringR} fill="none"
              stroke={color} strokeWidth={ringStroke}
              strokeDasharray={`${ringDash} ${ringCirc}`} strokeLinecap="round"
              transform={`rotate(-90 ${ringSize/2} ${ringSize/2})`}
              style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.16,1,0.3,1)', filter: `drop-shadow(0 0 8px ${color}77)` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <span className="font-black leading-none" style={{ fontSize: 34, color }}>{protein}</span>
            <span className="text-xs font-semibold mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>/ {PGOAL}g</span>
            <span className="text-[10px] font-bold mt-1" style={{ color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em' }}>PROTEIN</span>
          </div>
        </div>

        {/* Right stats */}
        <div className="flex-1 flex flex-col gap-2.5" style={{ minWidth: 0 }}>
          {/* Progress bar */}
          <div>
            <div className="flex justify-between mb-1.5">
              <span className="text-xs font-bold" style={{ color }}>{pct}% erreicht</span>
              {protein < PGOAL && (
                <span className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>Noch {remaining}g</span>
              )}
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}55` }} />
            </div>
          </div>

          {/* Color legend */}
          <div className="grid grid-cols-2 gap-1">
            {LEGEND.map((l, i) => (
              <div key={l.label} className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: l.color, opacity: i === activeIdx ? 1 : 0.3 }} />
                <span className="text-[9px]"
                  style={{ color: i === activeIdx ? l.color : 'rgba(255,255,255,0.22)', fontWeight: i === activeIdx ? 700 : 400 }}>
                  {l.label}
                </span>
              </div>
            ))}
          </div>

          {/* Status pill */}
          <div className="rounded-xl px-2.5 py-1.5" style={{ background: `${color}12`, border: `1px solid ${color}22` }}>
            <p className="text-[10px] font-bold leading-snug" style={{ color }}>
              {protein >= PGOAL
                ? `🏆 Ziel erreicht! +${protein - PGOAL}g Bonus`
                : behindIdeal
                ? `⚠️ Hinter Idealverlauf – nachlegen!`
                : protein === 0
                ? `💡 Starte mit einem proteinreichen Frühstück`
                : `💪 Weiter so!`}
            </p>
          </div>
        </div>
      </div>

      {/* Hourly graph (collapsible) */}
      {todayFoods.length > 0 && (
        <div className="mb-3">
          <button onClick={() => setShowGraph((v) => !v)}
            className="flex items-center gap-1.5 text-xs mb-2 w-full"
            style={{ color: 'var(--text-3)' }}>
            <span>📈 Protein-Verlauf</span>
            <span style={{ fontSize: 9 }}>{showGraph ? '▲' : '▼'}</span>
          </button>
          {showGraph && (
            <div>
              <div className="flex items-end gap-px" style={{ height: 60 }}>
                {hourlyData
                  .filter((d) => d.h <= Math.max(nowH, 8))
                  .map(({ h, actual, ideal }) => {
                    const isNow   = h === nowH
                    const barCol  = pColor(actual)
                    const actualH = actual > 0 ? Math.max(4, (actual / PGOAL) * 52) : 0
                    const idealH  = Math.max(2, (ideal  / PGOAL) * 52)
                    return (
                      <div key={h} className="flex-1 relative" style={{ height: 60 }}>
                        {/* Ideal (ghost) */}
                        <div className="absolute bottom-0 w-full rounded-t-sm"
                          style={{ height: idealH, background: 'rgba(255,255,255,0.07)' }} />
                        {/* Actual */}
                        {actualH > 0 && (
                          <div className="absolute bottom-0 w-3/4 left-[12.5%] rounded-t-sm transition-all duration-700"
                            style={{ height: actualH, background: isNow ? barCol : `${barCol}99` }} />
                        )}
                      </div>
                    )
                  })}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[8px]" style={{ color: 'var(--text-3)' }}>6h</span>
                <span className="text-[8px]" style={{ color: 'var(--text-3)' }}>
                  <span style={{ opacity: 0.4 }}>■ Ideal</span>{'  '}
                  <span style={{ color }}>{pct}% jetzt</span>
                </span>
                <span className="text-[8px]" style={{ color: 'var(--text-3)' }}>22h</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Help button */}
      <button
        onClick={getHelp}
        disabled={helpLoading || !apiKey || protein >= PGOAL}
        className="w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 glass-press transition-all disabled:opacity-50"
        style={{ background: `${color}10`, border: `1px solid ${color}25`, color }}>
        {helpLoading
          ? <><Loader size={14} className="animate-spin" />Kalo denkt nach…</>
          : protein >= PGOAL
          ? '🏆 Tagesziel erreicht! Perfekt!'
          : '🍗 Was soll ich jetzt essen?'}
      </button>

      {showHelp && helpText && (
        <div className="mt-3 rounded-2xl p-3.5"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-xs font-black mb-1.5" style={{ color }}>🤖 Kalos Empfehlung</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-1)' }}>{helpText}</p>
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────
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

  // Pull-to-refresh
  const [pullY, setPullY]        = useState(0)
  const [refreshing, setRefresh] = useState(false)
  const scrollRef  = useRef<HTMLDivElement>(null)
  const touchY0    = useRef(0)

  const onTouchStart = useCallback((e: React.TouchEvent) => { touchY0.current = e.touches[0].clientY }, [])
  const onTouchMove  = useCallback((e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop > 0) return
    const dy = e.touches[0].clientY - touchY0.current
    if (dy > 0) setPullY(Math.min(54, dy * 0.42))
  }, [])
  const onTouchEnd = useCallback(() => {
    if (pullY > 42) { setRefresh(true); setTimeout(() => { setRefresh(false); setPullY(0) }, 1200) }
    else setPullY(0)
  }, [pullY])

  // Computed values
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

  const whoopBurnedToday = useMemo(() => {
    if (whoopData?.date === today) {
      const b = whoopData.caloriesBurned ?? 0
      const d = whoopData.dailyBurn ?? 0
      if (b > 0) return b
      if (d > 0) return d
    }
    if (!whoopExtended || !whoopExtended.caloriesBurned) return 0
    if (whoopExtended.date && whoopExtended.date !== today) return 0
    return Math.round(whoopExtended.caloriesBurned)
  }, [whoopData, whoopExtended])

  const adjustedTarget = target + whoopBurnedToday
  const net      = calories - burned
  const remain   = adjustedTarget - net
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
  }, [foodLogs, activityLogs, target])

  // ── Daily Score ──────────────────────────────────────────────────────────
  const nutritionScore = useMemo(() => {
    // Protein: stepped scoring (60 pts max)
    const protGoal  = (Number(profile?.weight) || 75) * 2
    const pRatio    = protGoal > 0 ? protein / protGoal : 0
    const proteinSc = pRatio >= 1.0 ? 60 : pRatio >= 0.9 ? 50 : pRatio >= 0.8 ? 40 : pRatio >= 0.7 ? 25 : Math.round(pRatio * 20)
    // Calorie deficit scoring (40 pts max)
    const deficit   = target - calories  // positive = under budget
    const calSc     = deficit >= 0 && deficit <= 500 ? 40
                    : deficit > 500                  ? 25
                    : deficit >= -100                ? 30
                    : Math.max(0, Math.round(30 + (deficit + 100) / 10))
    return Math.min(100, proteinSc + calSc)
  }, [calories, target, protein, profile])

  const sportScore = useMemo(() => {
    const strain    = whoopData?.strain ?? 0
    const strainSc  = Math.min(50, (strain / 21) * 50)
    const workoutSc = todayActs.length > 0 ? 30 : stepsToday >= 10000 ? 15 : 0
    const burnedSc  = Math.min(20, (burned / 400) * 20)
    return Math.min(100, Math.round(strainSc + workoutSc + burnedSc))
  }, [whoopData, stepsToday, todayActs, burned])

  const sleepScore = whoopData?.sleepQuality ?? 50
  const recScore   = whoopData?.recovery     ?? 50

  const dailyScore = useMemo(() => Math.round(
    nutritionScore * 0.35 + sportScore * 0.25 + sleepScore * 0.20 + recScore * 0.20
  ), [nutritionScore, sportScore, sleepScore, recScore])

  // Save today's score + generate AI comment once per day
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
      const dd = new Date(d)
      dd.setDate(d.getDate() - i)
      const ds = dd.toISOString().split('T')[0]
      arr.push({ date: ds, score: scoreHistory[ds] ?? 0 })
    }
    return arr
  }, [scoreHistory])

  const yesterday = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate()-1)
    return d.toISOString().split('T')[0]
  }, [])
  const yesterdayScore = scoreHistory[yesterday] ?? 0
  const scoreDelta     = yesterdayScore > 0 ? dailyScore - yesterdayScore : null

  // Score streak (days >= 70)
  const scoreStreak = useMemo(() => {
    let count = 0
    const d = new Date()
    for (let i = 0; i < 30; i++) {
      const ds = d.toISOString().split('T')[0]
      if ((scoreHistory[ds] ?? 0) >= 70) count++
      else break
      d.setDate(d.getDate()-1)
    }
    return count
  }, [scoreHistory])

  const isCheatDay = cheatDays.some((c) => c.date === today)
  const bmi        = profile ? getBMI(Number(profile.weight)||0, Number(profile.height)||1) : null
  const dateStr    = new Date().toLocaleDateString('de-DE', { weekday:'long', day:'numeric', month:'long' })

  return (
    <div ref={scrollRef} className="pb-nav overflow-y-auto overflow-x-hidden h-dvh anim-fade"
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>

      {/* Pull indicator */}
      {(pullY > 6 || refreshing) && (
        <div className="ptr" style={{ height: pullY || 40 }}>
          <span>{refreshing ? '↻ Aktualisiert…' : '↓ Loslassen'}</span>
        </div>
      )}

      {/* ── Hero Header ──────────────────────────────────────────── */}
      <div className="relative overflow-hidden pt-safe px-5 pb-6"
        style={{ background: 'var(--grad-hero)' }}>

        {/* Glow orb */}
        <div className="absolute pointer-events-none" style={{
          top: -60, right: -60, width: 280, height: 280,
          background: 'radial-gradient(circle, rgba(74,140,92,0.1) 0%, transparent 65%)',
        }} />

        {/* Top row */}
        <div className="flex items-start justify-between mb-4 relative">
          <div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-3)' }}>{dateStr}</p>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>
              {greeting()}, {profile?.name?.split(' ')[0] ?? 'Kalorilo'} 👋
            </h1>
          </div>
          <button onClick={() => setActiveTab('profile')}
            className="glass-sm glass-press w-10 h-10 flex items-center justify-center mt-1 flex-shrink-0">
            <Settings size={17} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        {/* Quote */}
        <div className="glass-sm px-4 py-3 mb-6" style={{ background: 'rgba(74,140,92,0.06)', borderColor: 'rgba(74,140,92,0.12)' }}>
          <p className="text-sm italic" style={{ color: 'var(--text-2)' }}>{getTodayQuote()}</p>
        </div>

        {/* Calorie Ring */}
        <div className="flex items-center justify-center gap-6">
          <div className="relative flex items-center justify-center flex-shrink-0">
            <CalorieRing consumed={net} target={adjustedTarget} size={180} />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-4xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>
                {Math.round(net)}
              </span>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>kcal</span>
              <span className="text-xs mt-1 font-bold" style={{ color: remain >= 0 ? '#10b981' : '#ef4444' }}>
                {remain >= 0 ? `${Math.round(remain)} übrig` : `${Math.abs(Math.round(remain))} drüber`}
              </span>
            </div>
          </div>

          {/* Stats column */}
          <div className="flex flex-col gap-3 flex-shrink-0">
            {[
              { label: 'Budget',    val: adjustedTarget,       unit: 'kcal', color: 'var(--text-2)' },
              { label: 'Gegessen',  val: Math.round(calories), unit: 'kcal', color: 'var(--text-1)' },
              { label: 'Verbrannt', val: Math.round(burned),   unit: 'kcal', color: '#10b981' },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-[10px] font-semibold" style={{ color: 'var(--text-3)' }}>{s.label}</p>
                <p className="text-lg font-black leading-tight" style={{ color: s.color }}>
                  {s.val} <span className="text-xs font-medium opacity-60">{s.unit}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Whoop calorie bonus */}
        {whoopBurnedToday > 0 && (
          <div className="mt-3 px-4 py-2.5 rounded-2xl flex items-center gap-2"
            style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.2)' }}>
            <span style={{ fontSize: 16 }}>🔥</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black" style={{ color: '#fb923c' }}>
                +{whoopBurnedToday} kcal durch Whoop-Aktivität
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                Basis {target} + Whoop {whoopBurnedToday} = Budget {adjustedTarget} kcal
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Content ──────────────────────────────────────────────── */}
      <div className="px-4 space-y-3" style={{ paddingBottom: 4 }}>

        {/* ── Tages-Score Ring ── */}
        <div className="glass p-5"
          style={{ background: 'rgba(8,8,8,0.9)', border: `1px solid ${scoreColor(dailyScore)}22` }}>

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-black tracking-wide" style={{ color: 'var(--text-1)' }}>🎯 Tages-Score</p>
            {scoreStreak >= 3 && (
              <span className="text-xs px-2.5 py-1 rounded-full font-bold"
                style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>
                🔥 {scoreStreak} Tage über 70!
              </span>
            )}
          </div>

          {/* Ring + mini rings */}
          <div className="flex flex-col items-center gap-4">
            <DailyScoreRing score={dailyScore} size={180} />

            {/* Label + comparison */}
            <div className="text-center px-4">
              <p className="text-base font-black" style={{ color: scoreColor(dailyScore) }}>
                {scoreLabel(dailyScore)}
              </p>
              {scoreDelta !== null && (
                <p className="text-xs mt-1" style={{ color: scoreDelta >= 0 ? '#10b981' : '#f87171' }}>
                  {scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta} Punkte vs. gestern
                  {scoreDelta >= 5 ? ' 🔥' : scoreDelta <= -5 ? ' ⬇️' : ''}
                </p>
              )}
              {scoreComment && scoreCommentDate === today && (
                <p className="text-xs mt-2 italic leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {scoreComment}
                </p>
              )}
            </div>

            {/* 4 Mini Rings */}
            <div className="flex justify-around w-full px-2">
              <MiniScoreRing value={nutritionScore} label="Ernährung" icon="🍽️" color="#10b981" />
              <MiniScoreRing value={sportScore}     label="Sport"     icon="💪" color="#f59e0b" />
              <MiniScoreRing value={sleepScore}     label="Schlaf"    icon="😴" color="#a78bfa" />
              <MiniScoreRing value={recScore}       label="Recovery"  icon="⌚" color="#60a5fa" />
            </div>
          </div>
        </div>

        {/* ── Energie Plan ── */}
        <EnergyPlanCard whoopData={whoopData} />

        {/* Makros */}
        <div>
          <p className="label mb-2 px-1">Makros heute</p>
          <div className="flex gap-2">
            <MacroCard label="Eiweiß"        value={protein} max={macroT.protein} color="#3b82f6" />
            <MacroCard label="Kohlenhydrate" value={carbs}   max={macroT.carbs}   color="#f59e0b" />
            <MacroCard label="Fett"          value={fat}     max={macroT.fat}     color="#ef4444" />
          </div>
        </div>

        {/* ── Protein Tracker ── */}
        <ProteinTrackerCard />

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setActiveTab('food')}
            className="glass glass-press p-4 flex items-center gap-3 text-left">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--gold-dim)', border: '1px solid rgba(74,140,92,0.18)' }}>
              <Plus size={20} style={{ color: 'var(--gold)' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p className="text-sm font-black" style={{ color: 'var(--text-1)' }}>Essen</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Eintragen</p>
            </div>
          </button>
          <button onClick={() => setActiveTab('sport')}
            className="glass glass-press p-4 flex items-center gap-3 text-left">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--green-dim)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Zap size={20} style={{ color: 'var(--green)' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p className="text-sm font-black" style={{ color: 'var(--text-1)' }}>Sport</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Aktivität</p>
            </div>
          </button>
        </div>

        {/* Water */}
        <div className="glass p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Droplets size={17} style={{ color: '#38bdf8' }} />
              <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Wasser</p>
            </div>
            <p className="text-sm font-bold" style={{ color: '#38bdf8' }}>
              {water} <span className="font-normal" style={{ color: 'var(--text-3)' }}>/ {waterGoal()} ml</span>
            </p>
          </div>
          <div className="h-2 rounded-full mb-3 overflow-hidden" style={{ background: 'rgba(74,140,92,0.08)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${waterPct * 100}%`, background: 'linear-gradient(90deg, #38bdf8, #0ea5e9)' }} />
          </div>
          <div className="flex gap-2">
            {[150, 250, 500].map((ml) => (
              <button key={ml} onClick={() => addWater(today, ml)}
                className="flex-1 py-2.5 rounded-2xl text-xs font-bold glass-press transition-all"
                style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)', color: '#38bdf8' }}>
                +{ml}ml
              </button>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="glass p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <Footprints size={18} style={{ color: 'var(--green)' }} />
          </div>
          <div className="flex-1" style={{ minWidth: 0 }}>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>Schritte heute</p>
            <input
              type="number" inputMode="numeric"
              value={stepsToday || ''}
              onChange={(e) => setStepsToday(parseInt(e.target.value)||0)}
              className="text-lg font-black bg-transparent border-none outline-none w-full"
              style={{ color: 'var(--text-1)' }}
              placeholder="0"
            />
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-black" style={{ color: 'var(--green)' }}>+{Math.round(stepsToday*0.04)}</p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>kcal</p>
          </div>
        </div>

        {/* Whoop Widget */}
        <WhoopWidget
          whoopData={whoopData}
          whoopHistory={whoopHistory}
          lastSyncAt={whoopLastSync}
          onConnect={() => setActiveTab('profile')}
        />

        {/* ── Muskel-Regeneration ── */}
        <MuscleTrackerCard activityLogs={activityLogs} />

        {/* ── Score History 7 Tage ── */}
        <div className="glass p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-black" style={{ color: 'var(--text-1)' }}>📊 Score Verlauf</p>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>7 Tage</span>
          </div>
          <ScoreBarChart scores={scoreHistoryArr} />

          {/* Best day */}
          {scoreHistoryArr.some((s) => s.score > 0) && (() => {
            const best = scoreHistoryArr.reduce((a, b) => b.score > a.score ? b : a)
            const bestDay = new Date(best.date).toLocaleDateString('de-DE', { weekday: 'long' })
            const isToday = best.date === today
            return best.score >= 70 ? (
              <p className="text-xs mt-3 text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
                🏆 Bester Tag: <span style={{ color: scoreColor(best.score), fontWeight: 700 }}>
                  {isToday ? 'heute' : bestDay} ({best.score} Punkte)
                </span>
              </p>
            ) : null
          })()}
        </div>

        {/* ── Streak + Achievement ── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass p-3 text-center">
            <p className="text-xl mb-1">🔥</p>
            <p className="text-xl font-black" style={{ color: '#4a8c5c' }}>{streak}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>Kalorien-Streak</p>
          </div>
          <div className="glass p-3 text-center">
            <p className="text-xl mb-1">⭐</p>
            <p className="text-xl font-black" style={{ color: '#f59e0b' }}>{scoreStreak}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>Score ≥70 Streak</p>
          </div>
          <div className="glass p-3 text-center">
            <p className="text-xl mb-1">📊</p>
            <p className="text-xl font-black" style={{ color: '#60a5fa' }}>{bmi ?? '–'}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>BMI</p>
          </div>
        </div>

        {/* Cheat Day */}
        <div className="glass p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍕</span>
            <div>
              <p className="text-sm font-black" style={{ color: 'var(--text-1)' }}>Cheat Day</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>{isCheatDay ? 'Heute aktiv' : 'Nicht aktiv'}</p>
            </div>
          </div>
          <button
            onClick={() => isCheatDay ? removeCheatDay(today) : addCheatDay({ date: today })}
            className="px-4 py-2.5 rounded-2xl text-sm font-bold glass-press transition-all"
            style={isCheatDay
              ? { background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444' }
              : { background:'var(--gold-dim)', border:'1px solid rgba(74,140,92,0.18)', color:'var(--gold)' }
            }>
            {isCheatDay ? 'Deaktivieren' : 'Aktivieren'}
          </button>
        </div>

        {/* KI shortcut */}
        <button onClick={() => setActiveTab('ai')}
          className="glass glass-press w-full p-4 flex items-center gap-3 text-left">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.2)' }}>🤖</div>
          <div className="flex-1" style={{ minWidth: 0 }}>
            <p className="text-sm font-black" style={{ color: 'var(--text-1)' }}>KI-Ernährungsberater</p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>Frag mich alles rund ums Essen</p>
          </div>
          <ChevronRight size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
        </button>

        {/* Recent food */}
        {todayFoods.length > 0 && (
          <div className="glass p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="label">Heute gegessen</p>
              <button onClick={() => setActiveTab('food')}
                className="text-xs font-bold" style={{ color: 'var(--gold)' }}>Alle</button>
            </div>
            <div className="space-y-2.5">
              {todayFoods.slice(-3).map((log) => (
                <div key={log.id} className="flex items-center justify-between">
                  <div style={{ minWidth: 0 }}>
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-1)' }}>{log.foodItem.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>{log.amount}g</p>
                  </div>
                  <p className="text-sm font-black flex-shrink-0 ml-2" style={{ color: 'var(--gold)' }}>{log.macros?.calories ?? 0} kcal</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
