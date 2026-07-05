import { useEffect, useState, useRef } from 'react'
import { useStore } from '../store/useStore'
import { generateDailyBriefingText } from '../utils/api'

function MiniScoreRing({ score }: { score: number }) {
  const size   = 96
  const stroke = 8
  const r      = (size - stroke) / 2
  const circ   = 2 * Math.PI * r
  const dash   = circ * Math.min(1, score / 100)
  const color  = score >= 85 ? '#10b981' : score >= 70 ? '#22c55e' : score >= 55 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444'
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ position: 'absolute' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            transform={`rotate(-90 ${size/2} ${size/2})`}
            style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.16,1,0.3,1)', filter: `drop-shadow(0 0 8px ${color}88)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-black" style={{ fontSize: 26, color }}>{score}</span>
        </div>
      </div>
      <p className="text-xs font-semibold mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Gestern Score</p>
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

  const todayRecovery = whoopData?.recovery     ?? 0
  const todayHrv      = whoopData?.hrv          ?? 0
  const todaySleepH   = whoopData?.sleepDuration ?? 0
  const todayStrain   = whoopData?.strain        ?? 0

  const wt = Number(profile?.weight) || 75
  const ht = Number(profile?.height) || 175
  const ag = Number(profile?.age)    || 25
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

  const recoveryColor = todayRecovery >= 67 ? '#10b981' : todayRecovery >= 34 ? '#f59e0b' : '#ef4444'
  const recoveryLabel = todayRecovery >= 67 ? 'Top Recovery 🔥' : todayRecovery >= 34 ? 'Moderat 🟡' : 'Ruhetag 🔴'

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto"
      style={{ background: 'linear-gradient(160deg, #061a10 0%, #0a2e1a 40%, #071810 100%)' }}
    >
      <div className="w-full max-w-sm px-4 pt-safe pb-8 flex flex-col items-center">

        {/* Header */}
        <div className="text-center mt-8 mb-6">
          <div style={{ fontSize: 52 }}>🌅</div>
          <h1 className="text-2xl font-black text-white mt-3">
            Guten Morgen{name ? `, ${name}` : ''}!
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(125,184,138,0.6)' }}>Daily Briefing</p>
        </div>

        {/* Mini score ring */}
        <div className="mb-6">
          <MiniScoreRing score={yesterdayScore} />
        </div>

        {/* GESTERN */}
        <div className="w-full rounded-3xl p-4 mb-3"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(125,184,138,0.15)', backdropFilter: 'blur(16px)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span style={{ fontSize: 16 }}>📊</span>
            <span className="text-xs font-black tracking-widest" style={{ color: '#7db88a' }}>GESTERN</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center rounded-2xl py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="text-base font-black text-white">{yesterdayProtein}g</div>
              <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Protein</div>
            </div>
            <div className="text-center rounded-2xl py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="text-base font-black text-white">{yesterdayCalories}</div>
              <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>kcal</div>
            </div>
            <div className="text-center rounded-2xl py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="text-base font-black text-white">{yesterdayHasTraining ? '✅' : '—'}</div>
              <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Training</div>
            </div>
          </div>
          {yesterdaySleepH > 0 && (
            <div className="flex items-center gap-1.5 mb-2">
              <span style={{ fontSize: 13 }}>😴</span>
              <span className="text-xs font-semibold" style={{ color: '#a78bfa' }}>{yesterdaySleepH}h Schlaf</span>
            </div>
          )}
          {loading ? (
            <p className="text-xs italic" style={{ color: 'rgba(255,255,255,0.3)' }}>Kalo analysiert…</p>
          ) : briefText ? (
            <p className="text-sm leading-relaxed italic" style={{ color: 'rgba(255,255,255,0.75)' }}>{briefText.gestern}</p>
          ) : null}
        </div>

        {/* HEUTE */}
        <div className="w-full rounded-3xl p-4 mb-3"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(125,184,138,0.15)', backdropFilter: 'blur(16px)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span style={{ fontSize: 16 }}>⚡</span>
            <span className="text-xs font-black tracking-widest" style={{ color: '#7db88a' }}>HEUTE</span>
          </div>
          {todayRecovery > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center rounded-2xl py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="text-base font-black" style={{ color: recoveryColor }}>{todayRecovery}%</div>
                  <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Recovery</div>
                </div>
                <div className="text-center rounded-2xl py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="text-base font-black" style={{ color: '#60a5fa' }}>{todayHrv}ms</div>
                  <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>HRV</div>
                </div>
                <div className="text-center rounded-2xl py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="text-base font-black text-white">{todaySleepH > 0 ? `${todaySleepH}h` : '—'}</div>
                  <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Schlaf</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mb-2">
                <span style={{ fontSize: 13 }}>⌚</span>
                <span className="text-xs font-bold" style={{ color: recoveryColor }}>{recoveryLabel}</span>
              </div>
            </>
          ) : (
            <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Kein Whoop verbunden</p>
          )}
          {loading ? (
            <p className="text-xs italic" style={{ color: 'rgba(255,255,255,0.3)' }}>…</p>
          ) : briefText ? (
            <p className="text-sm leading-relaxed italic" style={{ color: 'rgba(255,255,255,0.75)' }}>{briefText.heute}</p>
          ) : null}
        </div>

        {/* PROGNOSE */}
        <div className="w-full rounded-3xl p-4 mb-8"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(125,184,138,0.15)', backdropFilter: 'blur(16px)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span style={{ fontSize: 16 }}>🔮</span>
            <span className="text-xs font-black tracking-widest" style={{ color: '#7db88a' }}>PROGNOSE MORGEN</span>
          </div>
          {loading ? (
            <p className="text-xs italic" style={{ color: 'rgba(255,255,255,0.3)' }}>…</p>
          ) : briefText ? (
            <p className="text-sm leading-relaxed italic" style={{ color: 'rgba(255,255,255,0.75)' }}>{briefText.morgen}</p>
          ) : (
            <p className="text-xs italic" style={{ color: 'rgba(255,255,255,0.3)' }}>Sammle Daten für Prognosen…</p>
          )}
        </div>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="px-10 py-4 rounded-full font-black text-white text-lg"
          style={{
            background: 'linear-gradient(135deg, #4a8c5c 0%, #10b981 100%)',
            boxShadow: '0 8px 32px rgba(16,185,129,0.4)',
            letterSpacing: '0.02em',
          }}
        >
          Los geht's! 🚀
        </button>
      </div>
    </div>
  )
}
