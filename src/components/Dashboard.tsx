import { useMemo } from 'react'
import { Flame, Droplets, Target, Plus, ChevronRight, Zap } from 'lucide-react'
import { useStore } from '../store/useStore'
import { formatDate, getProgressPercent, getMacroTargets, getTodayQuote, waterGoal, getBMI } from '../utils/calculations'

const today = formatDate()

function RingProgress({ value, max, color, size = 80 }: { value: number; max: number; color: string; size?: number }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const dash = circ * pct
  return (
    <svg width={size} height={size} className="progress-ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ffffff30" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  )
}

function MacroBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex-1">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className="font-semibold text-gray-700">{Math.round(value)}g</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="text-xs text-gray-400 mt-0.5">{max}g Ziel</div>
    </div>
  )
}

export default function Dashboard() {
  // Raw state – no computed functions in selectors
  const profile = useStore((s) => s.profile)
  const foodLogs = useStore((s) => s.foodLogs)
  const activityLogs = useStore((s) => s.activityLogs)
  const waterLogs = useStore((s) => s.waterLogs)
  const cheatDays = useStore((s) => s.cheatDays)
  const whoopData = useStore((s) => s.whoopData)
  const setActiveTab = useStore((s) => s.setActiveTab)
  const addWater = useStore((s) => s.addWater)
  const addCheatDay = useStore((s) => s.addCheatDay)
  const removeCheatDay = useStore((s) => s.removeCheatDay)

  // Compute everything locally with useMemo
  const todayFoods = useMemo(() => foodLogs.filter((l) => l.date === today), [foodLogs])
  const todayActivities = useMemo(() => activityLogs.filter((l) => l.date === today), [activityLogs])
  const water = useMemo(() => waterLogs.find((w) => w.date === today)?.amount ?? 0, [waterLogs])

  const totalCalories = useMemo(() => todayFoods.reduce((s, f) => s + (f.macros?.calories ?? 0), 0), [todayFoods])
  const totalProtein = useMemo(() => todayFoods.reduce((s, f) => s + (f.macros?.protein ?? 0), 0), [todayFoods])
  const totalFat = useMemo(() => todayFoods.reduce((s, f) => s + (f.macros?.fat ?? 0), 0), [todayFoods])
  const totalCarbs = useMemo(() => todayFoods.reduce((s, f) => s + (f.macros?.carbs ?? 0), 0), [todayFoods])
  const caloriesBurned = useMemo(() => todayActivities.reduce((s, a) => s + a.caloriesBurned, 0), [todayActivities])

  const target = useMemo(() => {
    if (!profile) return 2000
    const { age, weight, height, gender, activityLevel, goal, targetWeight, targetWeeks } = profile
    const safeAge = Number(age) || 25
    const safeWeight = Number(weight) || 75
    const safeHeight = Number(height) || 175
    const bmr = gender === 'male'
      ? 10 * safeWeight + 6.25 * safeHeight - 5 * safeAge + 5
      : 10 * safeWeight + 6.25 * safeHeight - 5 * safeAge - 161
    const multipliers: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }
    const tdee = bmr * (multipliers[activityLevel] ?? 1.55)
    const weeks = Number(targetWeeks) || 12
    const weeklyDelta = (safeWeight - (Number(targetWeight) || safeWeight)) * 7700 / weeks
    if (goal === 'lose') return Math.max(1200, Math.round(tdee - weeklyDelta / 7))
    if (goal === 'gain') return Math.round(tdee + Math.abs(weeklyDelta) / 7)
    return Math.round(tdee)
  }, [profile])

  const macroTargets = useMemo(() => getMacroTargets(target), [target])
  const netCalories = totalCalories - caloriesBurned
  const remaining = target - netCalories
  const isCheatDay = cheatDays.some((c) => c.date === today)

  const streak = useMemo(() => {
    let count = 0
    const d = new Date()
    for (let i = 0; i < 365; i++) {
      const dateStr = d.toISOString().split('T')[0]
      const foods = foodLogs.filter((l) => l.date === dateStr)
      const cals = foods.reduce((s, f) => s + (f.macros?.calories ?? 0), 0)
      const burned = activityLogs.filter((l) => l.date === dateStr).reduce((s, a) => s + a.caloriesBurned, 0)
      const goalMet = foods.length > 0 && Math.abs((cals - burned) - target) <= 200
      if (goalMet) count++
      else if (i > 0) break
      d.setDate(d.getDate() - 1)
    }
    return count
  }, [foodLogs, activityLogs, target])

  const bmi = useMemo(() => profile ? getBMI(Number(profile.weight) || 0, Number(profile.height) || 1) : null, [profile])

  return (
    <div className="pb-24 animate-fade-in">
      {/* Header */}
      <div className="gradient-blue px-4 pt-12 pb-6 safe-top">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-blue-100 text-sm">Guten Tag</p>
            <h1 className="text-white text-2xl font-bold">{profile?.name ?? 'Kalorilo'} 👋</h1>
          </div>
          {streak > 0 && (
            <div className="bg-white/20 rounded-full px-3 py-1 flex items-center gap-1">
              <Flame size={14} className="text-orange-300" />
              <span className="text-white text-sm font-bold">{streak}</span>
            </div>
          )}
        </div>

        {/* Quote */}
        <div className="bg-white/10 rounded-2xl p-3 mb-4">
          <p className="text-white/90 text-sm italic">{getTodayQuote()}</p>
        </div>

        {/* Main calorie ring */}
        <div className="flex items-center justify-center gap-6">
          <div className="relative flex items-center justify-center">
            <RingProgress value={netCalories} max={target} color="#fff" size={140} />
            <div className="absolute text-center">
              <div className="text-white text-3xl font-bold">{Math.round(netCalories)}</div>
              <div className="text-blue-200 text-xs">von {target} kcal</div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="text-white">
              <div className="text-xs text-blue-200">Gegessen</div>
              <div className="text-lg font-bold">{Math.round(totalCalories)} kcal</div>
            </div>
            <div className="text-white">
              <div className="text-xs text-blue-200">Verbrannt</div>
              <div className="text-lg font-bold text-green-300">{Math.round(caloriesBurned)} kcal</div>
            </div>
            <div className="text-white">
              <div className="text-xs text-blue-200">{remaining >= 0 ? 'Noch verfügbar' : 'Überschuss'}</div>
              <div className={`text-lg font-bold ${remaining < 0 ? 'text-red-300' : 'text-yellow-300'}`}>
                {Math.abs(Math.round(remaining))} kcal
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-2 space-y-4">
        {/* Makros */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Makronährstoffe</h3>
          <div className="flex gap-4">
            <MacroBar label="Eiweiß" value={totalProtein} max={macroTargets.protein} color="#3b82f6" />
            <MacroBar label="Kohlenhydrate" value={totalCarbs} max={macroTargets.carbs} color="#f59e0b" />
            <MacroBar label="Fett" value={totalFat} max={macroTargets.fat} color="#ef4444" />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setActiveTab('food')} className="card p-4 text-left card-pressed flex items-center gap-3">
            <div className="w-10 h-10 gradient-blue rounded-xl flex items-center justify-center">
              <Plus size={20} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800">Essen</div>
              <div className="text-xs text-gray-400">Eintragen</div>
            </div>
          </button>
          <button onClick={() => setActiveTab('sport')} className="card p-4 text-left card-pressed flex items-center gap-3">
            <div className="w-10 h-10 gradient-green rounded-xl flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800">Sport</div>
              <div className="text-xs text-gray-400">Aktivität</div>
            </div>
          </button>
        </div>

        {/* Water Tracker */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Droplets size={18} className="text-blue-500" />
              <span className="text-sm font-semibold text-gray-700">Wasseraufnahme</span>
            </div>
            <span className="text-sm text-gray-500">{water} / {waterGoal()} ml</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-blue-400 rounded-full transition-all duration-500"
              style={{ width: `${getProgressPercent(water, waterGoal())}%` }}
            />
          </div>
          <div className="flex gap-2">
            {[150, 250, 500].map((ml) => (
              <button
                key={ml}
                onClick={() => addWater(today, ml)}
                className="flex-1 bg-blue-50 text-blue-600 text-xs font-semibold py-2 rounded-xl active:bg-blue-100 transition"
              >
                +{ml}ml
              </button>
            ))}
          </div>
        </div>

        {/* Goal Progress */}
        {profile && (
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target size={18} className="text-purple-500" />
              <span className="text-sm font-semibold text-gray-700">Zielfortschritt</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{profile.weight} kg</span>
                  <span>{profile.targetWeight} kg</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full gradient-purple rounded-full" style={{ width: `${Math.max(5, getProgressPercent(Math.abs(profile.weight - profile.targetWeight), Math.abs(Number(profile.weight) - Number(profile.targetWeight)) || 1))}%` }} />
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-gray-800">Noch {(profile.targetWeeks ?? 12) * 7} Tage</div>
                <div className="text-xs text-gray-400">bis zum Ziel</div>
              </div>
            </div>
          </div>
        )}

        {/* Whoop Widget */}
        {whoopData && (
          <div className="card p-4 bg-gradient-to-r from-gray-800 to-gray-900">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-white text-sm font-bold">⌚ Whoop</span>
              <span className="text-gray-400 text-xs">{whoopData.date}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Recovery', value: `${whoopData.recovery}%`, color: whoopData.recovery > 66 ? '#10b981' : whoopData.recovery > 33 ? '#f59e0b' : '#ef4444' },
                { label: 'HRV', value: `${whoopData.hrv}ms`, color: '#60a5fa' },
                { label: 'Schlaf', value: `${whoopData.sleepQuality}%`, color: '#a78bfa' },
                { label: 'Strain', value: String(whoopData.strain?.toFixed(1) ?? 0), color: '#fb923c' },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <div className="text-xs text-gray-400 mb-1">{item.label}</div>
                  <div className="text-sm font-bold" style={{ color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
            {whoopData.recovery < 34 && (
              <div className="mt-2 bg-red-900/30 rounded-xl p-2 text-xs text-red-300">
                ⚠️ Niedrige Recovery – leichteres Training empfohlen
              </div>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-orange-500">{streak}</div>
            <div className="text-xs text-gray-500 mt-0.5">🔥 Streak</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-blue-500">{bmi ?? '–'}</div>
            <div className="text-xs text-gray-500 mt-0.5">BMI</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-green-500">{Math.round(caloriesBurned)}</div>
            <div className="text-xs text-gray-500 mt-0.5">kcal Sport</div>
          </div>
        </div>

        {/* Cheat Day */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🍕</span>
              <div>
                <div className="text-sm font-semibold text-gray-800">Cheat Day</div>
                <div className="text-xs text-gray-400">{isCheatDay ? 'Heute ist Cheat Day!' : 'Kein Cheat Day heute'}</div>
              </div>
            </div>
            <button
              onClick={() => isCheatDay ? removeCheatDay(today) : addCheatDay({ date: today })}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${isCheatDay ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}
            >
              {isCheatDay ? 'Rückgängig' : 'Aktivieren'}
            </button>
          </div>
        </div>

        {/* AI shortcut */}
        <button
          onClick={() => setActiveTab('ai')}
          className="card p-4 w-full text-left card-pressed flex items-center gap-3"
        >
          <div className="w-10 h-10 gradient-purple rounded-xl flex items-center justify-center text-xl">🤖</div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-800">KI-Ernährungsberater</div>
            <div className="text-xs text-gray-400">Frag mich alles rund ums Essen</div>
          </div>
          <ChevronRight size={18} className="text-gray-300" />
        </button>
      </div>
    </div>
  )
}
