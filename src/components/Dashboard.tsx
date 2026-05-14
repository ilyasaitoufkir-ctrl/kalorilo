import { useMemo } from 'react'
import { Settings, Droplets, Plus, Zap, ChevronRight } from 'lucide-react'
import { useStore } from '../store/useStore'
import { formatDate, getMacroTargets, getTodayQuote, waterGoal, getBMI } from '../utils/calculations'

const today = formatDate()

function Ring({ pct, size = 180, stroke = 14, color = '#fff' }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = circ * Math.min(1, Math.max(0, pct))
  return (
    <svg width={size} height={size} className="ring-base" style={{ filter: 'drop-shadow(0 0 12px rgba(255,255,255,.25))' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray .8s cubic-bezier(.16,1,.3,1)' }} />
    </svg>
  )
}

function MacroChip({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0)
  return (
    <div className="flex-1">
      <div className="flex justify-between text-xs mb-1.5">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="text-slate-500">{Math.round(value)}g</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="text-[10px] text-slate-400 mt-0.5">von {max}g</div>
    </div>
  )
}

export default function Dashboard() {
  const profile       = useStore((s) => s.profile)
  const foodLogs      = useStore((s) => s.foodLogs)
  const activityLogs  = useStore((s) => s.activityLogs)
  const waterLogs     = useStore((s) => s.waterLogs)
  const whoopData     = useStore((s) => s.whoopData)
  const cheatDays     = useStore((s) => s.cheatDays)
  const addWater      = useStore((s) => s.addWater)
  const addCheatDay   = useStore((s) => s.addCheatDay)
  const removeCheatDay= useStore((s) => s.removeCheatDay)
  const setActiveTab  = useStore((s) => s.setActiveTab)

  const todayFoods  = useMemo(() => foodLogs.filter((l) => l.date === today), [foodLogs])
  const todayActs   = useMemo(() => activityLogs.filter((l) => l.date === today), [activityLogs])
  const water       = useMemo(() => waterLogs.find((w) => w.date === today)?.amount ?? 0, [waterLogs])

  const calories  = useMemo(() => todayFoods.reduce((s, f) => s + (f.macros?.calories ?? 0), 0), [todayFoods])
  const protein   = useMemo(() => todayFoods.reduce((s, f) => s + (f.macros?.protein ?? 0), 0), [todayFoods])
  const fat       = useMemo(() => todayFoods.reduce((s, f) => s + (f.macros?.fat ?? 0), 0), [todayFoods])
  const carbs     = useMemo(() => todayFoods.reduce((s, f) => s + (f.macros?.carbs ?? 0), 0), [todayFoods])
  const burned    = useMemo(() => todayActs.reduce((s, a) => s + a.caloriesBurned, 0), [todayActs])

  const target = useMemo(() => {
    if (!profile) return 2000
    const w = Number(profile.weight) || 75, h = Number(profile.height) || 175, a = Number(profile.age) || 25
    const bmr = profile.gender === 'male' ? 10*w+6.25*h-5*a+5 : 10*w+6.25*h-5*a-161
    const m: Record<string,number> = { sedentary:1.2, light:1.375, moderate:1.55, active:1.725, very_active:1.9 }
    const tdee = bmr * (m[profile.activityLevel] ?? 1.55)
    const wks = Number(profile.targetWeeks) || 12
    const delta = (w - (Number(profile.targetWeight) || w)) * 7700 / wks
    if (profile.goal === 'lose') return Math.max(1200, Math.round(tdee - delta/7))
    if (profile.goal === 'gain') return Math.round(tdee + Math.abs(delta)/7)
    return Math.round(tdee)
  }, [profile])

  const macroT  = useMemo(() => getMacroTargets(target), [target])
  const net     = calories - burned
  const remain  = target - net
  const ringPct = net / target
  const streak = useMemo(() => {
    let count = 0
    const d = new Date()
    for (let i = 0; i < 365; i++) {
      const ds = d.toISOString().split('T')[0]
      const cals = foodLogs.filter((l) => l.date === ds).reduce((s, f) => s + (f.macros?.calories ?? 0), 0)
      const brnd = activityLogs.filter((l) => l.date === ds).reduce((s, a) => s + a.caloriesBurned, 0)
      if (cals > 0 && Math.abs((cals - brnd) - target) <= 200) count++
      else if (i > 0) break
      d.setDate(d.getDate() - 1)
    }
    return count
  }, [foodLogs, activityLogs, target])

  const isCheatDay = cheatDays.some((c) => c.date === today)
  const bmi = profile ? getBMI(Number(profile.weight)||0, Number(profile.height)||1) : null

  const dateLabel = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="pb-nav anim-fade">
      {/* ── Blue Header ── */}
      <div className="grad-blue px-5 pt-safe pb-8 relative overflow-hidden">
        {/* decorative circles */}
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/5" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-white/5" />

        {/* top row */}
        <div className="flex items-center justify-between mb-6 relative">
          <div>
            <p className="text-blue-200 text-sm">{dateLabel}</p>
            <h1 className="text-white text-2xl font-bold leading-tight">
              Hey, {profile?.name?.split(' ')[0] ?? 'Kalorilo'} 👋
            </h1>
          </div>
          <button onClick={() => setActiveTab('profile')}
            className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center active:bg-white/30 transition">
            <Settings size={18} className="text-white" />
          </button>
        </div>

        {/* Quote */}
        <div className="bg-white/10 rounded-2xl px-4 py-3 mb-6 relative">
          <p className="text-white/90 text-sm italic leading-snug">{getTodayQuote()}</p>
        </div>

        {/* Ring */}
        <div className="flex items-center justify-center gap-8">
          <div className="relative flex items-center justify-center">
            <Ring pct={ringPct} size={170} stroke={14} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-white text-4xl font-bold tracking-tight">{Math.round(net)}</span>
              <span className="text-blue-200 text-xs font-medium">kcal gegessen</span>
              <span className={`text-sm font-bold mt-1 ${remain < 0 ? 'text-red-300' : 'text-green-300'}`}>
                {remain >= 0 ? `${Math.round(remain)} übrig` : `${Math.abs(Math.round(remain))} darüber`}
              </span>
            </div>
          </div>
          <div className="space-y-4">
            {[
              { label: 'Ziel', val: `${target}`, unit: 'kcal', color: 'text-blue-200' },
              { label: 'Gegessen', val: `${Math.round(calories)}`, unit: 'kcal', color: 'text-white' },
              { label: 'Verbrannt', val: `${Math.round(burned)}`, unit: 'kcal', color: 'text-green-300' },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-blue-200 text-[11px]">{item.label}</p>
                <p className={`font-bold text-lg leading-tight ${item.color}`}>{item.val} <span className="text-sm font-medium opacity-70">{item.unit}</span></p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 -mt-1 space-y-3 relative">
        {/* ── Makros ── */}
        <div className="card p-4 anim-up" style={{ animationDelay: '0.05s' }}>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Makros heute</p>
          <div className="flex gap-4">
            <MacroChip label="Eiweiß" value={protein} max={macroT.protein} color="#3b82f6" />
            <MacroChip label="Kohlenhydrate" value={carbs} max={macroT.carbs} color="#f59e0b" />
            <MacroChip label="Fett" value={fat} max={macroT.fat} color="#ef4444" />
          </div>
        </div>

        {/* ── Quick Actions ── */}
        <div className="grid grid-cols-2 gap-3 anim-up" style={{ animationDelay: '0.1s' }}>
          <button onClick={() => setActiveTab('food')}
            className="card card-press p-4 flex items-center gap-3 text-left">
            <div className="w-11 h-11 grad-blue rounded-2xl flex items-center justify-center flex-shrink-0">
              <Plus size={20} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Essen</p>
              <p className="text-xs text-slate-400">Eintragen</p>
            </div>
          </button>
          <button onClick={() => setActiveTab('sport')}
            className="card card-press p-4 flex items-center gap-3 text-left">
            <div className="w-11 h-11 grad-green rounded-2xl flex items-center justify-center flex-shrink-0">
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Sport</p>
              <p className="text-xs text-slate-400">Aktivität</p>
            </div>
          </button>
        </div>

        {/* ── Wasser ── */}
        <div className="card p-4 anim-up" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Droplets size={18} className="text-blue-500" />
              <p className="text-sm font-bold text-slate-700">Wasser</p>
            </div>
            <p className="text-sm font-bold text-blue-600">{water} <span className="text-slate-400 font-normal">/ {waterGoal()} ml</span></p>
          </div>
          <div className="flex gap-1.5 mb-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <button key={i} onClick={() => addWater(today, 250)}
                className="flex-1 h-8 rounded-xl transition-all duration-200"
                style={{ background: i < Math.floor(water / 250) ? '#3b82f6' : i === Math.floor(water / 250) && water % 250 > 0 ? '#93c5fd' : '#f1f5f9' }}
              >
                <span className="text-[16px]">💧</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {[150, 250, 500].map((ml) => (
              <button key={ml} onClick={() => addWater(today, ml)}
                className="flex-1 bg-blue-50 text-blue-600 text-xs font-bold py-2.5 rounded-2xl active:bg-blue-100 transition">
                +{ml}ml
              </button>
            ))}
          </div>
        </div>

        {/* ── Whoop ── */}
        {whoopData && (
          <div className="rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)' }}>
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">⌚</span>
                <p className="text-white font-bold text-sm">Whoop · {whoopData.date}</p>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { l: 'Recovery', v: `${whoopData.recovery}%`, c: whoopData.recovery > 66 ? '#10b981' : whoopData.recovery > 33 ? '#f59e0b' : '#ef4444' },
                  { l: 'HRV', v: `${whoopData.hrv}ms`, c: '#60a5fa' },
                  { l: 'Schlaf', v: `${whoopData.sleepQuality}%`, c: '#a78bfa' },
                  { l: 'Strain', v: `${Number(whoopData.strain).toFixed(1)}`, c: '#fb923c' },
                ].map((item) => (
                  <div key={item.l} className="bg-white/10 rounded-2xl p-2.5 text-center">
                    <p className="text-[10px] text-slate-400 mb-0.5">{item.l}</p>
                    <p className="font-bold text-sm" style={{ color: item.c }}>{item.v}</p>
                  </div>
                ))}
              </div>
              {whoopData.recovery < 34 && (
                <div className="mt-2 bg-red-500/20 rounded-2xl px-3 py-2 text-xs text-red-300">
                  ⚠️ Niedrige Recovery – leichteres Training empfohlen
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-3 gap-3 anim-up" style={{ animationDelay: '0.2s' }}>
          <div className="card p-3.5 text-center">
            <p className="text-2xl font-black text-orange-500">{streak}</p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">🔥 Streak</p>
          </div>
          <div className="card p-3.5 text-center">
            <p className="text-2xl font-black text-blue-500">{bmi ?? '–'}</p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">BMI</p>
          </div>
          <div className="card p-3.5 text-center">
            <p className="text-2xl font-black text-green-500">{Math.round(burned)}</p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">kcal Sport</p>
          </div>
        </div>

        {/* ── Cheat Day ── */}
        <div className="card p-4 flex items-center justify-between anim-up" style={{ animationDelay: '0.25s' }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍕</span>
            <div>
              <p className="text-sm font-bold text-slate-800">Cheat Day</p>
              <p className="text-xs text-slate-400">{isCheatDay ? 'Heute aktiv' : 'Noch keiner heute'}</p>
            </div>
          </div>
          <button onClick={() => isCheatDay ? removeCheatDay(today) : addCheatDay({ date: today })}
            className={`px-4 py-2 rounded-2xl text-sm font-bold transition ${isCheatDay ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-600'}`}>
            {isCheatDay ? 'Deaktivieren' : 'Aktivieren'}
          </button>
        </div>

        {/* ── KI Shortcut ── */}
        <button onClick={() => setActiveTab('ai')}
          className="card card-press p-4 w-full flex items-center gap-3 text-left anim-up" style={{ animationDelay: '0.3s' }}>
          <div className="w-11 h-11 grad-purple rounded-2xl flex items-center justify-center text-xl flex-shrink-0">🤖</div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-800">KI-Ernährungsberater</p>
            <p className="text-xs text-slate-400">Frag mich alles rund ums Essen</p>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </button>

        {/* ── Letzte Mahlzeiten ── */}
        {todayFoods.length > 0 && (
          <div className="card p-4 anim-up" style={{ animationDelay: '0.35s' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-slate-700">Heute gegessen</p>
              <button onClick={() => setActiveTab('food')} className="text-xs text-blue-500 font-semibold">Alle anzeigen</button>
            </div>
            <div className="space-y-2">
              {todayFoods.slice(-3).map((log) => (
                <div key={log.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{log.foodItem.name}</p>
                    <p className="text-xs text-slate-400">{log.amount}g · {log.mealType === 'breakfast' ? 'Frühstück' : log.mealType === 'lunch' ? 'Mittagessen' : log.mealType === 'dinner' ? 'Abendessen' : 'Snack'}</p>
                  </div>
                  <p className="text-sm font-bold text-blue-600">{log.macros.calories} kcal</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
