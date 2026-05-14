import { useState, useMemo } from 'react'
import { Trash2, PlusCircle, Flame, X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { SPORTS_DATABASE, calculateCaloriesBurned, SPORT_CATEGORIES } from '../data/sportsDatabase'
import { formatDate, uid } from '../utils/calculations'
import type { ActivityLog, Intensity, SportActivity } from '../types'
import toast from 'react-hot-toast'

const today = formatDate()

const INTENSITY_LABELS: Record<Intensity, string> = {
  light: '🟢 Leicht',
  medium: '🟡 Mittel',
  intense: '🔴 Intensiv',
}

function AddActivityModal({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<SportActivity | null>(null)
  const [duration, setDuration] = useState('30')
  const [intensity, setIntensity] = useState<Intensity>('medium')
  const [steps, setSteps] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const addActivityLog = useStore((s) => s.addActivityLog)
  const profile = useStore((s) => s.profile)

  const weight = profile?.weight ?? 75

  const getMET = (sport: SportActivity, int: Intensity) =>
    int === 'light' ? sport.metLight : int === 'medium' ? sport.metMedium : sport.metIntense

  const caloriesPreview = selected
    ? calculateCaloriesBurned(weight, parseInt(duration) || 0, getMET(selected, intensity))
    : 0

  const handleAdd = () => {
    if (!selected || !duration) return
    const dur = parseInt(duration)
    const met = getMET(selected, intensity)
    const cal = calculateCaloriesBurned(weight, dur, met)
    const log: ActivityLog = {
      id: uid(), date: today, sport: selected, duration: dur,
      intensity, caloriesBurned: cal,
      steps: steps ? parseInt(steps) : undefined,
      timestamp: Date.now(),
    }
    addActivityLog(log)
    toast.success(`${selected.icon} ${selected.name} – ${cal} kcal verbrannt!`)
    onClose()
  }

  const sports = activeCategory
    ? SPORTS_DATABASE.filter((s) => s.category === activeCategory)
    : SPORTS_DATABASE

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={onClose}>
      <div className="bg-white w-full rounded-t-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white pt-4 px-4 pb-3 z-10 border-b border-gray-50">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Aktivität hinzufügen</h2>
            <button onClick={onClose}><X size={22} className="text-gray-400" /></button>
          </div>
        </div>
        <div className="p-4">
          {!selected ? (
            <>
              <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${!activeCategory ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  Alle
                </button>
                {SPORT_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${activeCategory === cat ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {sports.map((sport) => (
                  <button
                    key={sport.id}
                    onClick={() => setSelected(sport)}
                    className="card p-3 text-center card-pressed"
                  >
                    <div className="text-2xl mb-1">{sport.icon}</div>
                    <div className="text-xs font-medium text-gray-700 leading-tight">{sport.name}</div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div>
              <div className="flex items-center gap-3 bg-blue-50 rounded-2xl p-4 mb-4">
                <span className="text-3xl">{selected.icon}</span>
                <div>
                  <div className="font-semibold text-gray-800">{selected.name}</div>
                  <div className="text-xs text-gray-500">{selected.category}</div>
                </div>
                <button onClick={() => setSelected(null)} className="ml-auto text-gray-400">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Dauer (Minuten)</label>
                  <div className="flex gap-2">
                    {[15, 30, 45, 60, 90].map((min) => (
                      <button
                        key={min}
                        onClick={() => setDuration(String(min))}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${duration === String(min) ? 'gradient-blue text-white' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {min}
                      </button>
                    ))}
                    <input
                      type="number" value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="flex-1 text-center bg-gray-100 rounded-xl text-sm outline-none py-2"
                      placeholder="?"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Intensität</label>
                  <div className="flex gap-2">
                    {(Object.keys(INTENSITY_LABELS) as Intensity[]).map((int) => (
                      <button
                        key={int}
                        onClick={() => setIntensity(int)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition ${intensity === int ? 'gradient-blue text-white' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {INTENSITY_LABELS[int]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Schritte (optional)</label>
                  <input
                    type="number" value={steps}
                    onChange={(e) => setSteps(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none"
                    placeholder="z.B. 8000"
                  />
                </div>

                <div className="bg-orange-50 rounded-2xl p-4 text-center">
                  <Flame size={20} className="text-orange-500 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-orange-500">{caloriesPreview} kcal</div>
                  <div className="text-xs text-gray-500">geschätzte Verbrennung</div>
                </div>

                <button onClick={handleAdd} className="w-full py-3.5 gradient-blue rounded-2xl text-white font-semibold">
                  Aktivität speichern
                </button>
              </div>
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
  const totalBurned = useMemo(() => activityLogs.reduce((s, a) => s + a.caloriesBurned, 0), [activityLogs])
  const totalDuration = useMemo(() => activityLogs.reduce((s, a) => s + a.duration, 0), [activityLogs])
  const totalSteps = useMemo(() => activityLogs.reduce((s, a) => s + (a.steps ?? 0), 0), [activityLogs])

  return (
    <div className="pb-24 animate-fade-in">
      <div className="gradient-green px-4 pt-12 pb-6 safe-top">
        <h1 className="text-white text-2xl font-bold mb-1">Sport & Aktivität</h1>
        <p className="text-green-100 text-sm">Heute verbrannt</p>
        <div className="flex items-end gap-2 mt-1">
          <span className="text-4xl font-bold text-white">{totalBurned}</span>
          <span className="text-green-200 text-lg pb-1">kcal</span>
        </div>
        <div className="flex gap-6 mt-3 text-green-100 text-sm">
          <span>⏱ {totalDuration} Min</span>
          {totalSteps > 0 && <span>👟 {totalSteps.toLocaleString()} Schritte</span>}
        </div>
      </div>

      <div className="px-4 py-4">
        {/* Log */}
        {activityLogs.length > 0 ? (
          <div className="card divide-y divide-gray-50 mb-4">
            {activityLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 p-4">
                <span className="text-2xl">{log.sport.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-800">{log.sport.name}</div>
                  <div className="text-xs text-gray-400">
                    {log.duration} Min · {INTENSITY_LABELS[log.intensity]}
                    {log.steps ? ` · ${log.steps} Schritte` : ''}
                  </div>
                </div>
                <div className="text-right mr-2">
                  <div className="text-sm font-bold text-orange-500">{log.caloriesBurned} kcal</div>
                </div>
                <button onClick={() => removeActivityLog(log.id)} className="text-gray-300 active:text-red-400 p-1">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">🏃</div>
            <div className="text-sm">Noch keine Aktivitäten heute</div>
          </div>
        )}

        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-4 gradient-green rounded-2xl text-white font-semibold flex items-center justify-center gap-2"
        >
          <PlusCircle size={20} />
          Aktivität hinzufügen
        </button>
      </div>

      {showAdd && <AddActivityModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
