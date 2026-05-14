import { useState, useMemo, useEffect, useRef } from 'react'
import { Trash2, X, Play, Square, Plus } from 'lucide-react'
import { useStore } from '../store/useStore'
import { SPORTS_DATABASE, calculateCaloriesBurned, SPORT_CATEGORIES } from '../data/sportsDatabase'
import { formatDate, uid } from '../utils/calculations'
import type { ActivityLog, Intensity, SportActivity } from '../types'
import toast from 'react-hot-toast'

const today = formatDate()
const INTENSITY: { id: Intensity; label: string; color: string }[] = [
  { id: 'light',  label: '🟢 Leicht',  color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  { id: 'medium', label: '🟡 Mittel',  color: 'bg-amber-50 text-amber-600 border-amber-200' },
  { id: 'intense',label: '🔴 Intensiv',color: 'bg-red-50 text-red-600 border-red-200' },
]

function Timer({ onStop }: { onStop: (seconds: number) => void }) {
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(true)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) ref.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    else if (ref.current) clearInterval(ref.current)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [running])

  const fmt = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

  return (
    <div className="bg-slate-800 rounded-3xl p-5 text-center">
      <p className="text-slate-400 text-sm mb-2">Aktive Zeit</p>
      <p className="text-white text-6xl font-black tracking-tight font-mono">{fmt(seconds)}</p>
      <div className="flex gap-3 mt-4 justify-center">
        <button onClick={() => setRunning(!running)}
          className={`px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 ${running ? 'bg-amber-500 text-white' : 'bg-green-500 text-white'}`}>
          {running ? <><Square size={16} />Pause</> : <><Play size={16} />Weiter</>}
        </button>
        <button onClick={() => { setRunning(false); onStop(seconds) }}
          className="px-6 py-3 bg-blue-500 text-white rounded-2xl font-bold text-sm">
          Fertig ✓
        </button>
      </div>
    </div>
  )
}

function AddActivitySheet({ onClose }: { onClose: () => void }) {
  const [sport, setSport]       = useState<SportActivity | null>(null)
  const [duration, setDuration] = useState('30')
  const [intensity, setIntensity] = useState<Intensity>('medium')
  const [steps, setSteps]       = useState('')
  const [timerMode, setTimerMode] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const addActivityLog = useStore((s) => s.addActivityLog)
  const profile        = useStore((s) => s.profile)
  const weight = Number(profile?.weight) || 75

  const getMET = (sp: SportActivity, i: Intensity) =>
    i === 'light' ? sp.metLight : i === 'medium' ? sp.metMedium : sp.metIntense

  const calories = sport ? calculateCaloriesBurned(weight, parseInt(duration)||0, getMET(sport, intensity)) : 0

  const save = () => {
    if (!sport) return
    const dur = parseInt(duration)||0
    const log: ActivityLog = { id: uid(), date: today, sport, duration: dur, intensity, caloriesBurned: calculateCaloriesBurned(weight, dur, getMET(sport, intensity)), steps: steps ? parseInt(steps) : undefined, timestamp: Date.now() }
    addActivityLog(log)
    toast.success(`${sport.icon} ${sport.name} – ${log.caloriesBurned} kcal verbrannt!`)
    onClose()
  }

  const handleTimerStop = (secs: number) => {
    setTimerMode(false)
    setDuration(String(Math.round(secs / 60)))
  }

  const filtered = activeCategory ? SPORTS_DATABASE.filter((s) => s.category === activeCategory) : SPORTS_DATABASE

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="sheet-overlay absolute inset-0" />
      <div className="relative bg-slate-50 w-full max-w-[430px] mx-auto rounded-t-[32px] max-h-[92dvh] overflow-hidden flex flex-col anim-up"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1"><div className="sheet-handle" /></div>
        <div className="flex items-center justify-between px-5 pb-4 pt-1 flex-shrink-0">
          <h2 className="text-lg font-black text-slate-900">{sport ? sport.name : 'Sportart wählen'}</h2>
          <button onClick={onClose} className="w-9 h-9 bg-white rounded-2xl flex items-center justify-center shadow-sm"><X size={18} className="text-slate-600" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8">
          {!sport ? (
            <>
              {/* Category filter */}
              <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
                <button onClick={() => setActiveCategory(null)}
                  className={`flex-shrink-0 px-3.5 py-2 rounded-2xl text-xs font-bold transition ${!activeCategory ? 'bg-blue-500 text-white' : 'bg-white text-slate-600'}`}>Alle</button>
                {SPORT_CATEGORIES.map((cat) => (
                  <button key={cat} onClick={() => setActiveCategory(cat)}
                    className={`flex-shrink-0 px-3.5 py-2 rounded-2xl text-xs font-bold transition whitespace-nowrap ${activeCategory === cat ? 'bg-blue-500 text-white' : 'bg-white text-slate-600'}`}>{cat}</button>
                ))}
              </div>
              {/* Sport grid */}
              <div className="grid grid-cols-3 gap-2">
                {filtered.map((s) => (
                  <button key={s.id} onClick={() => setSport(s)}
                    className="card card-press p-3.5 flex flex-col items-center gap-1.5">
                    <span className="text-3xl">{s.icon}</span>
                    <p className="text-xs font-bold text-slate-700 text-center leading-tight">{s.name}</p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {/* Selected sport */}
              <div className="bg-blue-50 rounded-3xl p-4 flex items-center gap-3">
                <span className="text-4xl">{sport.icon}</span>
                <div className="flex-1">
                  <p className="font-black text-slate-900">{sport.name}</p>
                  <p className="text-xs text-slate-500">{sport.category}</p>
                </div>
                <button onClick={() => setSport(null)} className="text-slate-400"><X size={18} /></button>
              </div>

              {/* Timer */}
              {timerMode ? (
                <Timer onStop={handleTimerStop} />
              ) : (
                <>
                  {/* Duration */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-slate-700">Dauer (Minuten)</p>
                      <button onClick={() => setTimerMode(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-bold">
                        <Play size={12} />Timer starten
                      </button>
                    </div>
                    <div className="flex gap-2 mb-2">
                      {[15, 30, 45, 60, 90].map((min) => (
                        <button key={min} onClick={() => setDuration(String(min))}
                          className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition ${duration === String(min) ? 'bg-blue-500 text-white' : 'bg-white text-slate-600'}`}>{min}</button>
                      ))}
                    </div>
                    <div className="flex items-center bg-white rounded-2xl px-4 py-3 gap-2">
                      <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)}
                        className="flex-1 text-base font-bold outline-none bg-transparent text-slate-800" />
                      <span className="text-slate-400">Minuten</span>
                    </div>
                  </div>

                  {/* Intensity slider */}
                  <div>
                    <p className="text-sm font-bold text-slate-700 mb-2">Intensität</p>
                    <div className="flex gap-2">
                      {INTENSITY.map((int) => (
                        <button key={int.id} onClick={() => setIntensity(int.id)}
                          className={`flex-1 py-3 rounded-2xl text-xs font-bold border transition ${intensity === int.id ? int.color + ' border-current' : 'bg-white text-slate-500 border-transparent'}`}>
                          {int.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Steps */}
              <div>
                <p className="text-sm font-bold text-slate-700 mb-2">Schritte <span className="font-normal text-slate-400">(optional)</span></p>
                <div className="flex items-center bg-white rounded-2xl px-4 py-3 gap-2">
                  <span className="text-xl">👟</span>
                  <input type="number" value={steps} onChange={(e) => setSteps(e.target.value)}
                    className="flex-1 text-sm font-medium outline-none bg-transparent text-slate-800" placeholder="z.B. 8000" />
                </div>
              </div>

              {/* Calories preview */}
              <div className="bg-orange-50 rounded-3xl p-4 text-center">
                <p className="text-orange-400 text-sm font-semibold">Geschätzte Verbrennung</p>
                <p className="text-4xl font-black text-orange-500 mt-1">{calories}</p>
                <p className="text-orange-400 text-sm">kcal</p>
              </div>

              <button onClick={save}
                className="w-full py-4 bg-green-500 rounded-3xl text-white font-black text-base">
                Aktivität speichern
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SportTracker() {
  const [showAdd, setShowAdd] = useState(false)
  const allActivityLogs = useStore((s) => s.activityLogs)
  const removeActivityLog = useStore((s) => s.removeActivityLog)
  const activityLogs = useMemo(() => allActivityLogs.filter((l) => l.date === today), [allActivityLogs])
  const totalBurned  = useMemo(() => activityLogs.reduce((s, a) => s + a.caloriesBurned, 0), [activityLogs])
  const totalDuration= useMemo(() => activityLogs.reduce((s, a) => s + a.duration, 0), [activityLogs])
  const totalSteps   = useMemo(() => activityLogs.reduce((s, a) => s + (a.steps ?? 0), 0), [activityLogs])

  const intLabel: Record<Intensity, string> = { light: '🟢', medium: '🟡', intense: '🔴' }

  return (
    <div className="pb-nav anim-fade">
      <div className="grad-green px-5 pt-safe pb-8 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/5" />
        <h1 className="text-white text-2xl font-black mb-1">Sport & Aktivität</h1>
        <p className="text-green-100 text-sm mb-3">Heute verbrannt</p>
        <p className="text-white text-5xl font-black mb-1">{totalBurned} <span className="text-2xl text-green-200 font-semibold">kcal</span></p>
        <div className="flex gap-4 text-green-100 text-sm mt-2">
          <span>⏱ {totalDuration} Min</span>
          {totalSteps > 0 && <span>👟 {totalSteps.toLocaleString()}</span>}
          <span>💪 {activityLogs.length} Aktivitäten</span>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {activityLogs.length > 0 ? (
          <div className="card divide-y divide-slate-50">
            {activityLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 p-4">
                <span className="text-2xl">{log.sport.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800">{log.sport.name}</p>
                  <p className="text-xs text-slate-400">
                    {log.duration} Min {intLabel[log.intensity]}{log.steps ? ` · ${log.steps} 👟` : ''}
                  </p>
                </div>
                <p className="text-sm font-black text-orange-500 mr-2">{log.caloriesBurned} kcal</p>
                <button onClick={() => removeActivityLog(log.id)} className="text-slate-200 active:text-red-400 p-1"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-8 text-center">
            <p className="text-4xl mb-3">🏃</p>
            <p className="text-sm font-bold text-slate-500">Noch keine Aktivitäten heute</p>
            <p className="text-xs text-slate-400 mt-1">Füge dein erstes Training hinzu</p>
          </div>
        )}

        <button onClick={() => setShowAdd(true)}
          className="w-full py-4 bg-green-500 rounded-3xl text-white font-black text-base flex items-center justify-center gap-2">
          <Plus size={20} />Aktivität hinzufügen
        </button>
      </div>

      {showAdd && <AddActivitySheet onClose={() => setShowAdd(false)} />}
    </div>
  )
}
