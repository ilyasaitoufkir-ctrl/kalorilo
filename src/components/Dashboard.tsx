import { useMemo, useState, useRef, useCallback } from 'react'
import { Settings, Droplets, Zap, Plus, ChevronRight, Footprints } from 'lucide-react'
import { useStore } from '../store/useStore'
import { formatDate, getMacroTargets, getTodayQuote, waterGoal, getBMI } from '../utils/calculations'

const today = formatDate()

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Guten Morgen'
  if (h < 18) return 'Guten Tag'
  return 'Guten Abend'
}

// ── Premium gradient ring ─────────────────────────────────────────────────
function CalorieRing({ consumed, target, size = 220 }: { consumed: number; target: number; size?: number }) {
  const pct = target > 0 ? Math.min(1, consumed / target) : 0
  const stroke = 18
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = circ * pct
  const id = 'ringGrad'

  return (
    <svg width={size} height={size} className="ring-base" style={{ filter: 'drop-shadow(0 0 24px rgba(245,158,11,0.35))' }}>
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#fbbf24" />
          <stop offset="50%"  stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      {/* Track */}
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="rgba(255,255,255,0.04)" strokeWidth={stroke} />
      {/* Progress */}
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={`url(#${id})`} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
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
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs" style={{ color: 'var(--text-3)' }}>/{max}{unit}</span>
    </div>
  )
}

export default function Dashboard() {
  const profile        = useStore((s) => s.profile)
  const foodLogs       = useStore((s) => s.foodLogs)
  const activityLogs   = useStore((s) => s.activityLogs)
  const waterLogs      = useStore((s) => s.waterLogs)
  const whoopData      = useStore((s) => s.whoopData)
  const cheatDays      = useStore((s) => s.cheatDays)
  const stepsToday     = useStore((s) => s.stepsToday)
  const setStepsToday  = useStore((s) => s.setStepsToday)
  const addWater       = useStore((s) => s.addWater)
  const addCheatDay    = useStore((s) => s.addCheatDay)
  const removeCheatDay = useStore((s) => s.removeCheatDay)
  const setActiveTab   = useStore((s) => s.setActiveTab)

  // Pull-to-refresh
  const [pullY, setPullY]       = useState(0)
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
    const wks = Number(profile.targetWeeks)||12
    const delta = (w-(Number(profile.targetWeight)||w))*7700/wks
    if (profile.goal==='lose') return Math.max(1200, Math.round(tdee-delta/7))
    if (profile.goal==='gain') return Math.round(tdee+Math.abs(delta)/7)
    return Math.round(tdee)
  }, [profile])

  const macroT   = useMemo(() => getMacroTargets(target), [target])
  const net      = calories - burned
  const remain   = target - net
  const waterPct = Math.min(1, water / waterGoal())

  const streak = useMemo(() => {
    let count = 0
    const d = new Date()
    for (let i = 0; i < 365; i++) {
      const ds = d.toISOString().split('T')[0]
      const c = foodLogs.filter((l) => l.date===ds).reduce((s,f)=>s+(f.macros?.calories??0),0)
      const b = activityLogs.filter((l) => l.date===ds).reduce((s,a)=>s+a.caloriesBurned,0)
      if (c>0 && Math.abs((c-b)-target)<=200) count++
      else if (i>0) break
      d.setDate(d.getDate()-1)
    }
    return count
  }, [foodLogs, activityLogs, target])

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
        style={{ background: 'linear-gradient(160deg, #0a0a0a 0%, #000000 100%)' }}>

        {/* Gold glow orb */}
        <div className="absolute" style={{
          top: -60, right: -60, width: 280, height: 280,
          background: 'radial-gradient(circle, rgba(245,158,11,0.1) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* Top row */}
        <div className="flex items-start justify-between mb-6 relative">
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
        <div className="glass-sm px-4 py-3 mb-6" style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.12)' }}>
          <p className="text-sm italic" style={{ color: 'var(--text-2)' }}>{getTodayQuote()}</p>
        </div>

        {/* Calorie Ring */}
        <div className="flex items-center justify-center gap-6">
          <div className="relative flex items-center justify-center flex-shrink-0">
            <CalorieRing consumed={net} target={target} size={180} />
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
              { label: 'Ziel',      val: target,              unit: 'kcal', color: 'var(--text-2)' },
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
      </div>

      {/* ── Content ──────────────────────────────────────────────── */}
      <div className="px-4 space-y-3" style={{ paddingBottom: 4 }}>

        {/* Makros */}
        <div>
          <p className="label mb-2 px-1">Makros heute</p>
          <div className="flex gap-2">
            <MacroCard label="Eiweiß"  value={protein} max={macroT.protein} color="#3b82f6" />
            <MacroCard label="Kohlenhydrate" value={carbs}   max={macroT.carbs}   color="#f59e0b" />
            <MacroCard label="Fett"    value={fat}     max={macroT.fat}     color="#ef4444" />
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setActiveTab('food')}
            className="glass glass-press p-4 flex items-center gap-3 text-left">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--gold-dim)', border: '1px solid rgba(245,158,11,0.2)' }}>
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
          {/* Progress bar */}
          <div className="h-2 rounded-full mb-3 overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${waterPct * 100}%`, background: 'linear-gradient(90deg, #38bdf8, #0ea5e9)' }} />
          </div>
          <div className="flex gap-2">
            {[150, 250, 500].map((ml) => (
              <button key={ml} onClick={() => addWater(today, ml)}
                className="flex-1 py-2.5 rounded-2xl text-xs font-bold glass-press transition-all"
                style={{
                  background: 'rgba(56,189,248,0.08)',
                  border: '1px solid rgba(56,189,248,0.15)',
                  color: '#38bdf8',
                }}>
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

        {/* Whoop */}
        {whoopData && (
          <div className="glass p-4" style={{ background: 'rgba(17,24,39,0.8)' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">⌚</span>
              <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Whoop</p>
              <span className="text-xs ml-auto" style={{ color: 'var(--text-3)' }}>{whoopData.date}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { l:'Recovery', v:`${whoopData.recovery}%`,  c: whoopData.recovery>66?'#10b981':whoopData.recovery>33?'#f59e0b':'#ef4444' },
                { l:'HRV',      v:`${whoopData.hrv}ms`,      c:'#60a5fa' },
                { l:'Schlaf',   v:`${whoopData.sleepQuality}%`, c:'#a78bfa' },
                { l:'Strain',   v:`${Number(whoopData.strain).toFixed(1)}`, c:'#fb923c' },
              ].map((item) => (
                <div key={item.l} className="rounded-2xl p-2.5 text-center"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] mb-0.5" style={{ color: 'var(--text-3)' }}>{item.l}</p>
                  <p className="text-sm font-black" style={{ color: item.c }}>{item.v}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Streak',  value: streak, unit: 'Tage', icon: '🔥', color: '#f59e0b' },
            { label: 'BMI',     value: bmi ?? '–', unit: '',     icon: '📊', color: '#60a5fa' },
            { label: 'Verbrannt', value: Math.round(burned), unit: 'kcal', icon: '💪', color: '#10b981' },
          ].map((s) => (
            <div key={s.label} className="glass p-3 text-center">
              <p className="text-xl mb-1">{s.icon}</p>
              <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>{s.unit || s.label}</p>
            </div>
          ))}
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
              : { background:'var(--gold-dim)', border:'1px solid rgba(245,158,11,0.2)', color:'var(--gold)' }
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
                  <p className="text-sm font-black flex-shrink-0 ml-2" style={{ color: 'var(--gold)' }}>{log.macros.calories} kcal</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
