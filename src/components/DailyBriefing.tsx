import { useEffect, useState, useRef } from 'react'
import { useStore } from '../store/useStore'
import { generateDailyBriefingText } from '../utils/api'

const C = {
  primary:   '#5a8a6a',
  light:     '#e8f2ec',
  text:      '#1a2e1f',
  secondary: '#6b8570',
  tertiary:  '#9db3a2',
  border:    '#e8f0ea',
  bg:        '#f8faf8',
  card:      '#ffffff',
} as const

function MiniScoreRing({ score }: { score: number }) {
  const size   = 88
  const stroke = 7
  const r      = (size - stroke) / 2
  const circ   = 2 * Math.PI * r
  const dash   = circ * Math.min(1, score / 100)
  const color  = score >= 70 ? C.primary : score >= 50 ? '#8aaa6a' : C.secondary
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ position: 'absolute' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.light} strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            transform={`rotate(-90 ${size/2} ${size/2})`}
            style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.16,1,0.3,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span style={{ fontSize: 24, fontWeight: 600, color, lineHeight: 1 }}>{score}</span>
        </div>
      </div>
      <p style={{ fontSize: 11, color: C.tertiary, marginTop: 4 }}>Gestern Score</p>
    </div>
  )
}

function BriefCard({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '16px', width: '100%', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.primary }}>{label}</span>
      </div>
      {children}
    </div>
  )
}

export default function DailyBriefing({ onDismiss }: { onDismiss: () => void }) {
  const profile      = useStore((s) => s.profile)
  const scoreHistory = useStore((s) => s.scoreHistory)
  const foodLogs     = useStore((s) => s.foodLogs)
  const activityLogs = useStore((s) => s.activityLogs)
  const whoopData    = useStore((s) => s.whoopData)
  const whoopHistory = useStore((s) => s.whoopHistory)
  const apiKeys      = useStore((s) => s.apiKeys)

  const yesterday = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  })()

  const yesterdayScore       = scoreHistory[yesterday] ?? 0
  const yesterdayFoods       = foodLogs.filter((l) => l.date === yesterday)
  const yesterdayProtein     = Math.round(yesterdayFoods.reduce((s, f) => s + (f.macros?.protein ?? 0), 0))
  const yesterdayCalories    = Math.round(yesterdayFoods.reduce((s, f) => s + (f.macros?.calories ?? 0), 0))
  const yesterdayHasTraining = activityLogs.some((l) => l.date === yesterday)
  const yesterdayWhoop       = whoopHistory.find((h) => h.date === yesterday)
  const yesterdaySleepH      = yesterdayWhoop?.sleepDuration ?? 0

  const todayRecovery = whoopData?.recovery      ?? 0
  const todayHrv      = whoopData?.hrv           ?? 0
  const todaySleepH   = whoopData?.sleepDuration ?? 0
  const todayStrain   = whoopData?.strain        ?? 0

  const wt  = Number(profile?.weight) || 75
  const ht  = Number(profile?.height) || 175
  const ag  = Number(profile?.age)    || 25
  const bmr = profile?.gender === 'male' ? 10*wt+6.25*ht-5*ag+5 : 10*wt+6.25*ht-5*ag-161
  const mlt: Record<string, number> = { sedentary:1.2, light:1.375, moderate:1.55, active:1.725, very_active:1.9 }
  const calTarget = Math.round(bmr * (mlt[profile?.activityLevel ?? 'moderate'] ?? 1.55))

  const [briefText, setBriefText] = useState<{ gestern: string; heute: string; morgen: string } | null>(null)
  const [loading, setLoading]     = useState(false)
  const genRef = useRef(false)
  const name = profile?.name?.split(' ')[0] ?? ''

  useEffect(() => {
    const apiKey = apiKeys.anthropic
    if (!apiKey || genRef.current) return
    genRef.current = true
    setLoading(true)
    generateDailyBriefingText(
      name, yesterdayScore, yesterdayProtein, yesterdayCalories, calTarget,
      yesterdaySleepH, yesterdayHasTraining,
      todayRecovery, todayHrv, todaySleepH, todayStrain,
      apiKey,
    )
      .then((t) => { setBriefText(t); setLoading(false) })
      .catch(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const recoveryColor = todayRecovery >= 67 ? C.primary : todayRecovery >= 34 ? '#8aaa6a' : C.secondary
  const recoveryLabel = todayRecovery >= 67 ? 'Hohe Recovery' : todayRecovery >= 34 ? 'Moderate Recovery' : 'Niedrige Recovery'

  const statCell = (val: string, label: string) => (
    <div style={{ flex: 1, textAlign: 'center', background: C.bg, borderRadius: 12, padding: '10px 4px' }}>
      <p style={{ color: C.text, fontSize: 16, fontWeight: 600 }}>{val}</p>
      <p style={{ color: C.tertiary, fontSize: 10, marginTop: 1 }}>{label}</p>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: C.bg }}>
      <div style={{ maxWidth: 430, margin: '0 auto', padding: '0 14px' }}>

        {/* Header */}
        <div style={{ paddingTop: 'max(env(safe-area-inset-top), 48px)', paddingBottom: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🌅</div>
          <h1 style={{ color: C.text, fontSize: 26, fontWeight: 600, letterSpacing: '-0.5px', margin: 0 }}>
            Guten Morgen{name ? `, ${name}` : ''}
          </h1>
          <p style={{ color: C.secondary, fontSize: 13, marginTop: 4 }}>Daily Briefing</p>
        </div>

        {/* Score ring */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <MiniScoreRing score={yesterdayScore} />
        </div>

        {/* GESTERN */}
        <BriefCard icon="📊" label="Gestern">
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {statCell(`${yesterdayProtein}g`, 'Protein')}
            {statCell(`${yesterdayCalories}`, 'kcal')}
            {statCell(yesterdayHasTraining ? '✅' : '—', 'Training')}
          </div>
          {yesterdaySleepH > 0 && (
            <p style={{ color: C.secondary, fontSize: 12, marginBottom: 8 }}>😴 {yesterdaySleepH}h Schlaf</p>
          )}
          {loading ? (
            <p style={{ color: C.tertiary, fontSize: 12, fontStyle: 'italic' }}>Kalo analysiert…</p>
          ) : briefText ? (
            <p style={{ color: C.secondary, fontSize: 13, lineHeight: 1.6, fontStyle: 'italic' }}>{briefText.gestern}</p>
          ) : null}
        </BriefCard>

        {/* HEUTE */}
        <BriefCard icon="⚡" label="Heute">
          {todayRecovery > 0 ? (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {statCell(`${todayRecovery}%`, 'Recovery')}
                {statCell(todayHrv > 0 ? `${todayHrv}ms` : '—', 'HRV')}
                {statCell(todaySleepH > 0 ? `${todaySleepH}h` : '—', 'Schlaf')}
              </div>
              <p style={{ color: recoveryColor, fontSize: 13, fontWeight: 500, marginBottom: 8 }}>⌚ {recoveryLabel}</p>
            </>
          ) : (
            <p style={{ color: C.tertiary, fontSize: 12, marginBottom: 8 }}>Kein Whoop verbunden</p>
          )}
          {loading ? (
            <p style={{ color: C.tertiary, fontSize: 12, fontStyle: 'italic' }}>…</p>
          ) : briefText ? (
            <p style={{ color: C.secondary, fontSize: 13, lineHeight: 1.6, fontStyle: 'italic' }}>{briefText.heute}</p>
          ) : null}
        </BriefCard>

        {/* PROGNOSE */}
        <BriefCard icon="🔮" label="Prognose Morgen">
          {loading ? (
            <p style={{ color: C.tertiary, fontSize: 12, fontStyle: 'italic' }}>…</p>
          ) : briefText ? (
            <p style={{ color: C.secondary, fontSize: 13, lineHeight: 1.6, fontStyle: 'italic' }}>{briefText.morgen}</p>
          ) : (
            <p style={{ color: C.tertiary, fontSize: 12, fontStyle: 'italic' }}>Sammle Daten für Prognosen…</p>
          )}
        </BriefCard>

        {/* Dismiss */}
        <div style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 32px)', paddingTop: 8 }}>
          <button
            onClick={onDismiss}
            style={{
              width: '100%', padding: '15px', borderRadius: 16, border: 'none',
              background: C.primary, color: '#fff',
              fontSize: 15, fontWeight: 500, cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(90,138,106,0.25)',
            }}
          >
            Los geht's →
          </button>
        </div>
      </div>
    </div>
  )
}
