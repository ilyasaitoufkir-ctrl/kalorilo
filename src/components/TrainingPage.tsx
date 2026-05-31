import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Play, Check, Plus, Loader, ChevronRight, RotateCcw, Dumbbell, Sparkles, Flame, ArrowLeft } from 'lucide-react'
import { useStore } from '../store/useStore'
import { generateTrainingPlan } from '../utils/api'
import { formatDate, uid } from '../utils/calculations'
import toast from 'react-hot-toast'
import type { WorkoutExercise } from '../types'

const today = formatDate()

// ── wger API types ─────────────────────────────────────────────────────────
interface WgerExercise {
  id: number
  name: string
  description: string
  muscles: string[]
  equipment: string[]
  imageUrl: string | null
  categoryId: number
}

// ── Muscle group config ────────────────────────────────────────────────────
const MUSCLE_GROUPS = [
  { id: 11, label: 'Brust',     emoji: '💪', color: '#ef4444' },
  { id: 12, label: 'Rücken',    emoji: '🔙', color: '#3b82f6' },
  { id: 9,  label: 'Beine',     emoji: '🦵', color: '#10b981' },
  { id: 13, label: 'Schultern', emoji: '🔝', color: '#8b5cf6' },
  { id: 8,  label: 'Arme',      emoji: '💪', color: '#f59e0b' },
  { id: 10, label: 'Bauch',     emoji: '🎯', color: '#ec4899' },
  { id: 14, label: 'Waden',     emoji: '🦿', color: '#06b6d4' },
]

const EQUIPMENT_MAP: Record<string, string> = {
  'Barbell': 'Langhantel', 'Dumbbell': 'Kurzhantel', 'Kettlebell': 'Kettlebell',
  'Bench': 'Bank', 'Pull Up Bar': 'Klimmzugstange', 'none': 'Körpergewicht',
  'SZ-Bar': 'SZ-Stange', 'Swiss Ball': 'Pezziball', 'Gym mat': 'Matte',
  'Incline Bench': 'Schrägbank', 'Cable': 'Kabel',
}

const MUSCLE_MAP: Record<string, string> = {
  'Biceps brachii': 'Bizeps', 'Triceps brachii': 'Trizeps',
  'Pectoralis major': 'Brustmuskel', 'Latissimus dorsi': 'Latissimus',
  'Anterior deltoid': 'Vordere Schulter', 'Deltoid': 'Schulter',
  'Quadriceps femoris': 'Quadrizeps', 'Hamstrings': 'Beinbeuger',
  'Gluteus maximus': 'Gesäß', 'Gastrocnemius': 'Wade',
  'Rectus abdominis': 'Bauch', 'Obliquus externus abdominis': 'Seitenbauch',
  'Trapezius': 'Trapezmuskel', 'Erector spinae': 'Rückenstrecker',
}

// ── Fetch exercises from wger ──────────────────────────────────────────────
const exerciseCache: Record<number, WgerExercise[]> = {}

async function fetchExercises(categoryId: number): Promise<WgerExercise[]> {
  if (exerciseCache[categoryId]) return exerciseCache[categoryId]
  const res = await fetch(
    `https://wger.de/api/v2/exerciseinfo/?format=json&language=2&limit=24&category=${categoryId}&ordering=id`
  )
  if (!res.ok) throw new Error('API nicht erreichbar')
  const data = await res.json()
  const result: WgerExercise[] = data.results
    .map((ex: any) => {
      const t = ex.translations?.find((t: any) => t.language === 2)
      const mainImg = ex.images?.find((i: any) => i.is_main) || ex.images?.[0]
      return {
        id: ex.id,
        name: t?.name || '',
        description: (t?.description || '').replace(/<[^>]*>/g, '').trim().slice(0, 400),
        muscles: (ex.muscles || []).map((m: any) => MUSCLE_MAP[m.name_en] || m.name_en),
        equipment: (ex.equipment || []).map((e: any) => EQUIPMENT_MAP[e.name] || e.name),
        imageUrl: mainImg?.image ?? null,
        categoryId,
      }
    })
    .filter((e: WgerExercise) => e.name.length > 2)
  exerciseCache[categoryId] = result
  return result
}

// ── Rest Timer component ───────────────────────────────────────────────────
function RestTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    if (left <= 0) { onDone(); return }
    const t = setTimeout(() => setLeft((v) => v - 1), 1000)
    return () => clearTimeout(t)
  }, [left, onDone])
  const pct = (left / seconds) * 100
  const r = 28
  const circ = 2 * Math.PI * r
  return (
    <div className="flex flex-col items-center gap-2 py-3">
      <div className="relative w-20 h-20">
        <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(74,140,92,0.1)" strokeWidth="6" />
          <circle cx="40" cy="40" r={r} fill="none" stroke="#4a8c5c" strokeWidth="6"
            strokeDasharray={`${circ * pct / 100} ${circ}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-black" style={{ color: 'var(--text-1)' }}>{left}s</span>
        </div>
      </div>
      <p className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>Pause – nächster Satz</p>
      <button onClick={onDone} className="text-xs glass-press px-4 py-1.5 rounded-full font-bold"
        style={{ color: '#4a8c5c' }}>Überspringen</button>
    </div>
  )
}

// ── Exercise Detail Sheet ──────────────────────────────────────────────────
function ExerciseDetailSheet({
  exercise, onClose, onAddToWorkout,
}: {
  exercise: WgerExercise
  onClose: () => void
  onAddToWorkout?: (ex: WgerExercise) => void
}) {
  return (
    <div className="fixed inset-0 z-[110] flex items-end" onClick={onClose}>
      <div className="sheet-overlay absolute inset-0" />
      <div className="sheet-bg relative w-full max-w-[430px] mx-auto max-h-[90dvh] overflow-hidden flex flex-col anim-up"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0"><div className="sheet-handle" /></div>

        <div className="flex items-center gap-3 px-5 pb-3 pt-1 flex-shrink-0">
          <h2 className="flex-1 text-lg font-black" style={{ color: 'var(--text-1)' }}>{exercise.name}</h2>
          <button onClick={onClose} className="glass-sm glass-press w-10 h-10 flex items-center justify-center flex-shrink-0">
            <X size={17} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 space-y-4 pb-8">
          {/* GIF / Image */}
          {exercise.imageUrl && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(74,140,92,0.1)' }}>
              <img src={exercise.imageUrl} alt={exercise.name}
                className="w-full object-contain"
                style={{ maxHeight: 220, background: '#fff' }} />
            </div>
          )}

          {/* Muscles + Equipment */}
          <div className="grid grid-cols-2 gap-2">
            {exercise.muscles.length > 0 && (
              <div className="glass p-3 rounded-2xl">
                <p className="text-[10px] font-black uppercase tracking-wider mb-1.5" style={{ color: '#4a8c5c' }}>Muskeln</p>
                {exercise.muscles.map((m, i) => (
                  <p key={i} className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>• {m}</p>
                ))}
              </div>
            )}
            {exercise.equipment.length > 0 && (
              <div className="glass p-3 rounded-2xl">
                <p className="text-[10px] font-black uppercase tracking-wider mb-1.5" style={{ color: '#f59e0b' }}>Equipment</p>
                {exercise.equipment.map((e, i) => (
                  <p key={i} className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>• {e}</p>
                ))}
              </div>
            )}
          </div>

          {/* Empfehlung */}
          <div className="glass p-4 rounded-2xl" style={{ background: 'rgba(74,140,92,0.05)' }}>
            <p className="text-xs font-black mb-2" style={{ color: '#4a8c5c' }}>📋 Empfehlung</p>
            <p className="text-xs" style={{ color: 'var(--text-2)' }}>3–4 Sätze × 8–12 Wiederholungen · 60–90s Pause</p>
          </div>

          {/* Description */}
          {exercise.description.length > 10 && (
            <div className="glass p-4 rounded-2xl">
              <p className="text-xs font-black mb-2" style={{ color: 'var(--text-2)' }}>Ausführung</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>{exercise.description}</p>
            </div>
          )}

          {onAddToWorkout && (
            <button onClick={() => { onAddToWorkout(exercise); onClose() }}
              className="btn-gold w-full py-4 text-sm flex items-center justify-center gap-2" style={{ minHeight: 50 }}>
              <Plus size={16} />Zum Workout hinzufügen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Active Workout Screen ──────────────────────────────────────────────────
function ActiveWorkout({
  exercises: initial,
  onFinish,
  onBack,
}: {
  exercises: WorkoutExercise[]
  onFinish: (exercises: WorkoutExercise[], seconds: number) => void
  onBack: () => void
}) {
  const [exercises, setExercises] = useState<WorkoutExercise[]>(initial)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [resting, setResting] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((v) => v + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const ex = exercises[currentIdx]
  if (!ex) return null

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  const toggleSet = (setIdx: number) => {
    setExercises((prev) => prev.map((e, i) => i !== currentIdx ? e : {
      ...e,
      sets: e.sets.map((s, j) => j !== setIdx ? s : { ...s, completed: !s.completed }),
    }))
    if (!resting) setResting(true)
  }

  const updateSet = (setIdx: number, field: 'reps' | 'weight', delta: number) => {
    setExercises((prev) => prev.map((e, i) => i !== currentIdx ? e : {
      ...e,
      sets: e.sets.map((s, j) => j !== setIdx ? s : { ...s, [field]: Math.max(0, s[field] + delta) }),
    }))
  }

  const completedSets = exercises.reduce((s, e) => s + e.sets.filter((st) => st.completed).length, 0)
  const totalSets = exercises.reduce((s, e) => s + e.sets.length, 0)

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: 'var(--bg)' }}>
      {/* Header */}
      <div className="pt-safe px-5 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(74,140,92,0.12)' }}>
        <div className="flex items-center justify-between mb-2">
          <button onClick={onBack} className="glass-sm glass-press w-9 h-9 flex items-center justify-center">
            <ArrowLeft size={16} style={{ color: 'var(--text-2)' }} />
          </button>
          <div className="text-center">
            <p className="text-sm font-black" style={{ color: 'var(--text-1)' }}>💪 Workout</p>
            <p className="text-xs font-mono" style={{ color: '#4a8c5c' }}>{fmt(elapsed)}</p>
          </div>
          <button onClick={() => onFinish(exercises, elapsed)}
            className="rounded-2xl px-3 py-1.5 text-xs font-black"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
            Beenden
          </button>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(74,140,92,0.1)' }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${totalSets > 0 ? (completedSets / totalSets) * 100 : 0}%`, background: '#4a8c5c' }} />
        </div>
        <p className="text-[10px] mt-1 text-center" style={{ color: 'var(--text-3)' }}>
          {completedSets}/{totalSets} Sätze · Übung {currentIdx + 1}/{exercises.length}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Exercise nav */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {exercises.map((e, i) => {
            const done = e.sets.every((s) => s.completed)
            return (
              <button key={i} onClick={() => setCurrentIdx(i)}
                className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={i === currentIdx
                  ? { background: 'var(--grad-gold)', color: '#fff' }
                  : done
                    ? { background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981' }
                    : { background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-3)' }
                }>
                {done ? '✓ ' : ''}{e.name.split(' ').slice(0, 2).join(' ')}
              </button>
            )
          })}
        </div>

        {/* Current exercise */}
        <div className="glass p-4" style={{ background: 'rgba(74,140,92,0.04)' }}>
          <div className="flex items-start gap-3 mb-4">
            {ex.imageUrl && (
              <img src={ex.imageUrl} alt={ex.name} className="w-16 h-16 object-cover rounded-xl flex-shrink-0"
                style={{ background: '#fff' }} />
            )}
            <div>
              <p className="font-black" style={{ color: 'var(--text-1)' }}>{ex.name}</p>
              {ex.muscles.length > 0 && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{ex.muscles.slice(0, 2).join(', ')}</p>
              )}
            </div>
          </div>

          {/* Rest timer */}
          {resting && (
            <div className="glass rounded-2xl mb-3 p-2" style={{ background: 'rgba(74,140,92,0.06)' }}>
              <RestTimer seconds={60} onDone={() => setResting(false)} />
            </div>
          )}

          {/* Sets */}
          <div className="space-y-2">
            <div className="grid grid-cols-[32px_1fr_1fr_40px] gap-2 mb-1">
              <p className="text-[10px] font-black text-center" style={{ color: 'var(--text-3)' }}>Satz</p>
              <p className="text-[10px] font-black text-center" style={{ color: 'var(--text-3)' }}>Kg</p>
              <p className="text-[10px] font-black text-center" style={{ color: 'var(--text-3)' }}>Wdh</p>
              <p className="text-[10px] font-black text-center" style={{ color: 'var(--text-3)' }}>✓</p>
            </div>
            {ex.sets.map((set, si) => (
              <div key={si} className={`grid grid-cols-[32px_1fr_1fr_40px] gap-2 items-center rounded-xl p-2 transition-all ${set.completed ? 'opacity-60' : ''}`}
                style={{ background: set.completed ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${set.completed ? 'rgba(16,185,129,0.2)' : 'rgba(74,140,92,0.06)'}` }}>
                <p className="text-sm font-black text-center" style={{ color: 'var(--text-3)' }}>{si + 1}</p>
                {/* Weight */}
                <div className="flex items-center justify-center gap-1">
                  <button onClick={() => updateSet(si, 'weight', -2.5)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center glass-press text-xs font-bold"
                    style={{ color: 'var(--text-3)' }}>–</button>
                  <span className="text-sm font-black w-8 text-center" style={{ color: 'var(--text-1)' }}>
                    {set.weight === 0 ? 'BW' : `${set.weight}`}
                  </span>
                  <button onClick={() => updateSet(si, 'weight', 2.5)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center glass-press text-xs font-bold"
                    style={{ color: 'var(--text-3)' }}>+</button>
                </div>
                {/* Reps */}
                <div className="flex items-center justify-center gap-1">
                  <button onClick={() => updateSet(si, 'reps', -1)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center glass-press text-xs font-bold"
                    style={{ color: 'var(--text-3)' }}>–</button>
                  <span className="text-sm font-black w-6 text-center" style={{ color: 'var(--text-1)' }}>{set.reps}</span>
                  <button onClick={() => updateSet(si, 'reps', 1)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center glass-press text-xs font-bold"
                    style={{ color: 'var(--text-3)' }}>+</button>
                </div>
                {/* Done */}
                <button onClick={() => toggleSet(si)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                  style={{ background: set.completed ? '#4a8c5c' : 'rgba(74,140,92,0.1)', border: `1px solid ${set.completed ? '#4a8c5c' : 'rgba(74,140,92,0.2)'}` }}>
                  <Check size={15} color={set.completed ? '#fff' : '#4a8c5c'} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Next exercise */}
        {currentIdx < exercises.length - 1 ? (
          <button onClick={() => { setCurrentIdx((v) => v + 1); setResting(false) }}
            className="glass glass-press w-full p-4 flex items-center gap-3">
            <span className="text-sm font-black" style={{ color: 'var(--text-1)' }}>Nächste: {exercises[currentIdx + 1].name}</span>
            <ChevronRight size={16} style={{ color: 'var(--text-3)', marginLeft: 'auto' }} />
          </button>
        ) : (
          <button onClick={() => onFinish(exercises, elapsed)}
            className="btn-gold w-full py-4 text-sm flex items-center justify-center gap-2" style={{ minHeight: 50 }}>
            <Flame size={16} />Workout abschließen
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main TrainingPage ──────────────────────────────────────────────────────
export default function TrainingPage() {
  const [tab, setTab] = useState<'library' | 'plan' | 'workout'>('library')
  const [selectedGroup, setSelectedGroup] = useState(MUSCLE_GROUPS[0])
  const [exercises, setExercises] = useState<WgerExercise[]>([])
  const [loadingEx, setLoadingEx] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState<WgerExercise | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [plan, setPlan] = useState('')
  const [daysPerWeek, setDaysPerWeek] = useState(3)
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExercise[]>([])
  const [activeWorkout, setActiveWorkout] = useState(false)
  const [showSummary, setShowSummary] = useState<{ exercises: WorkoutExercise[]; seconds: number } | null>(null)

  const profile     = useStore((s) => s.profile)
  const apiKeys     = useStore((s) => s.apiKeys)
  const addActivity = useStore((s) => s.addActivityLog)
  const apiKey      = apiKeys.anthropic || apiKeys.openai

  // Load exercises when group changes
  useEffect(() => {
    setExercises([])
    setLoadingEx(true)
    fetchExercises(selectedGroup.id)
      .then(setExercises)
      .catch(() => toast.error('Übungen konnten nicht geladen werden'))
      .finally(() => setLoadingEx(false))
  }, [selectedGroup])

  const genPlan = async () => {
    if (!apiKey) { toast.error('API Key fehlt → Profil → API Keys'); return }
    if (!profile) { toast.error('Bitte erst Profil anlegen'); return }
    setPlanLoading(true)
    try {
      const goal = profile.goal === 'lose' ? 'Abnehmen / Fettverbrennung'
        : profile.goal === 'gain' ? 'Muskelaufbau'
        : 'Fitness / Gesundheit'
      const text = await generateTrainingPlan(profile.name, goal, profile.weight, daysPerWeek, apiKey)
      setPlan(text)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Fehler', { duration: 5000 }) }
    setPlanLoading(false)
  }

  const addToWorkout = useCallback((ex: WgerExercise) => {
    const already = workoutExercises.some((w) => w.id === String(ex.id))
    if (already) { toast('Bereits im Workout'); return }
    const newEx: WorkoutExercise = {
      id: String(ex.id),
      name: ex.name,
      imageUrl: ex.imageUrl,
      muscles: ex.muscles,
      sets: [
        { reps: 10, weight: 0, completed: false },
        { reps: 10, weight: 0, completed: false },
        { reps: 10, weight: 0, completed: false },
      ],
    }
    setWorkoutExercises((prev) => [...prev, newEx])
    toast.success(`${ex.name} hinzugefügt`)
  }, [workoutExercises])

  const finishWorkout = (exs: WorkoutExercise[], seconds: number) => {
    const completedSets = exs.reduce((s, e) => s + e.sets.filter((st) => st.completed).length, 0)
    if (completedSets === 0) { toast.error('Keine Sätze abgeschlossen'); return }
    // Calculate approx calories (MET 5 = moderate weight training)
    const weight = profile?.weight ?? 75
    const minutes = seconds / 60
    const cals = Math.round((5 * 3.5 * weight * minutes) / 200)
    // Log to activity
    addActivity({
      id: uid(), date: today,
      sport: { id: 'strength', name: 'Krafttraining', icon: '🏋️', metLight: 3.5, metMedium: 5, metIntense: 6, category: 'Kraft' },
      duration: Math.round(minutes), intensity: 'medium',
      caloriesBurned: cals, timestamp: Date.now(),
    })
    setActiveWorkout(false)
    setShowSummary({ exercises: exs, seconds })
    toast.success(`Workout gespeichert! ${cals} kcal verbrannt`)
  }

  if (activeWorkout && workoutExercises.length > 0) {
    return <ActiveWorkout exercises={workoutExercises} onFinish={finishWorkout} onBack={() => setActiveWorkout(false)} />
  }

  const TABS = [
    { id: 'library' as const, label: '📚 Bibliothek' },
    { id: 'plan'    as const, label: '📋 KI-Plan' },
    { id: 'workout' as const, label: `🏋️ Workout${workoutExercises.length > 0 ? ` (${workoutExercises.length})` : ''}` },
  ]

  return (
    <div className="flex flex-col overflow-x-hidden" style={{ height: '100dvh', background: 'var(--bg)', paddingBottom: 'calc(80px + max(env(safe-area-inset-bottom),16px))' }}>

      {/* Header */}
      <div className="pt-safe px-5 pb-4 flex-shrink-0" style={{ background: 'var(--bg)', borderBottom: '1px solid rgba(125,184,138,0.15)' }}>
        <h1 className="text-2xl font-black mb-3" style={{ color: 'var(--text-1)' }}>💪 Training</h1>
        <div className="flex gap-1.5 p-1.5 rounded-2xl" style={{ background: 'rgba(74,140,92,0.06)', border: '1px solid rgba(74,140,92,0.08)' }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
              style={tab === t.id ? { background: 'var(--grad-gold)', color: '#fff', boxShadow: 'var(--shadow-gold)' } : { color: 'var(--text-3)' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bibliothek ── */}
      {tab === 'library' && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Muscle group chips */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {MUSCLE_GROUPS.map((g) => (
                <button key={g.id} onClick={() => setSelectedGroup(g)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all"
                  style={selectedGroup.id === g.id
                    ? { background: g.color + '22', border: `1px solid ${g.color}55`, color: g.color }
                    : { background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-3)' }
                  }>
                  <span>{g.emoji}</span>{g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Exercise list */}
          <div className="px-4 pb-4 space-y-2">
            {loadingEx && (
              <div className="flex items-center justify-center py-12 gap-3">
                <Loader size={22} className="animate-spin" style={{ color: '#4a8c5c' }} />
                <span className="text-sm" style={{ color: 'var(--text-3)' }}>Übungen werden geladen…</span>
              </div>
            )}
            {!loadingEx && exercises.length === 0 && (
              <div className="text-center py-12">
                <p className="text-3xl mb-2">🏋️</p>
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>Keine Übungen gefunden</p>
              </div>
            )}
            {exercises.map((ex) => (
              <button key={ex.id} onClick={() => setSelectedExercise(ex)}
                className="glass glass-press w-full p-4 flex items-center gap-3 text-left">
                {ex.imageUrl ? (
                  <img src={ex.imageUrl} alt={ex.name}
                    className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                    style={{ background: '#fff' }} />
                ) : (
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: selectedGroup.color + '18', border: `1px solid ${selectedGroup.color}30` }}>
                    <Dumbbell size={22} style={{ color: selectedGroup.color }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black truncate" style={{ color: 'var(--text-1)' }}>{ex.name}</p>
                  {ex.muscles.length > 0 && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-3)' }}>{ex.muscles.slice(0, 2).join(' · ')}</p>
                  )}
                  {ex.equipment.length > 0 && (
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>{ex.equipment[0]}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <ChevronRight size={14} style={{ color: 'var(--text-3)' }} />
                  <button onClick={(e) => { e.stopPropagation(); addToWorkout(ex) }}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(74,140,92,0.12)', border: '1px solid rgba(74,140,92,0.2)', color: '#4a8c5c' }}>
                    + Workout
                  </button>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── KI-Plan ── */}
      {tab === 'plan' && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-4 space-y-3">
          <div className="glass p-5" style={{ background: 'rgba(74,140,92,0.05)', borderColor: 'rgba(74,140,92,0.18)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-3xl flex items-center justify-center text-3xl flex-shrink-0"
                style={{ background: 'rgba(74,140,92,0.1)', border: '1px solid rgba(74,140,92,0.18)' }}>📋</div>
              <div>
                <p className="font-black" style={{ color: 'var(--text-1)' }}>KI-Trainingsplan</p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                  {profile?.goal === 'lose' ? 'Abnehmen / Fettverbrennung' : profile?.goal === 'gain' ? 'Muskelaufbau' : 'Fitness'}
                </p>
              </div>
            </div>

            {/* Days per week */}
            <div className="mb-4">
              <p className="text-xs font-black mb-2" style={{ color: 'var(--text-2)' }}>Trainingstage pro Woche</p>
              <div className="flex gap-2">
                {[2, 3, 4, 5].map((d) => (
                  <button key={d} onClick={() => setDaysPerWeek(d)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all"
                    style={daysPerWeek === d
                      ? { background: 'var(--grad-gold)', color: '#fff' }
                      : { background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-2)' }
                    }>{d}x</button>
                ))}
              </div>
            </div>

            <button onClick={genPlan} disabled={planLoading || !apiKey}
              className="btn-gold w-full py-4 text-sm flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ minHeight: 50 }}>
              {planLoading
                ? <><Loader size={16} className="animate-spin" />Plan wird erstellt…</>
                : <><Sparkles size={16} />{plan ? 'Neu erstellen' : 'Trainingsplan erstellen'}</>}
            </button>
            {!apiKey && <p className="text-xs mt-2 text-center" style={{ color: '#ef4444' }}>⚠️ API Key fehlt → Profil → API Keys</p>}
          </div>

          {plan && (
            <div className="glass p-5">
              <p className="text-sm leading-relaxed whitespace-pre-wrap font-sans" style={{ color: 'var(--text-1)' }}>{plan}</p>
            </div>
          )}

          {!plan && !planLoading && (
            <div className="glass p-8 text-center">
              <p className="text-4xl mb-3">🏆</p>
              <p className="text-sm font-bold mb-1" style={{ color: 'var(--text-1)' }}>Noch kein Plan</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Kalo erstellt dir einen personalisierten Trainingsplan basierend auf deinem Ziel.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Workout Builder ── */}
      {tab === 'workout' && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-4 space-y-3">

          {/* Summary after workout */}
          {showSummary && (
            <div className="glass p-5" style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.2)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🎉</span>
                <p className="font-black" style={{ color: '#10b981' }}>Workout abgeschlossen!</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Dauer', value: `${Math.round(showSummary.seconds / 60)} min`, color: '#4a8c5c' },
                  { label: 'Übungen', value: String(showSummary.exercises.length), color: '#3b82f6' },
                  { label: 'Sätze', value: String(showSummary.exercises.reduce((s, e) => s + e.sets.filter((st) => st.completed).length, 0)), color: '#f59e0b' },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p className="text-base font-black" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>{s.label}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowSummary(null)} className="w-full mt-3 text-xs glass-press py-2 font-bold"
                style={{ color: 'var(--text-3)' }}>Schließen</button>
            </div>
          )}

          {workoutExercises.length === 0 ? (
            <div className="glass p-8 text-center">
              <p className="text-4xl mb-3">🏋️</p>
              <p className="text-sm font-bold mb-1" style={{ color: 'var(--text-1)' }}>Workout ist leer</p>
              <p className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>Gehe zur Bibliothek und tippe auf „+ Workout" um Übungen hinzuzufügen.</p>
              <button onClick={() => setTab('library')}
                className="btn-gold py-3 px-6 text-sm flex items-center justify-center gap-2 mx-auto"
                style={{ minHeight: 44, display: 'inline-flex' }}>
                <Plus size={15} />Übungen hinzufügen
              </button>
            </div>
          ) : (
            <>
              {/* Start button */}
              <button onClick={() => setActiveWorkout(true)}
                className="btn-gold w-full py-4 text-base flex items-center justify-center gap-2"
                style={{ minHeight: 54 }}>
                <Play size={18} />Workout starten ({workoutExercises.length} Übungen)
              </button>

              {/* Exercise list */}
              <div className="space-y-2">
                {workoutExercises.map((ex, i) => (
                  <div key={ex.id} className="glass p-4 flex items-center gap-3">
                    {ex.imageUrl ? (
                      <img src={ex.imageUrl} alt={ex.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                        style={{ background: '#fff' }} />
                    ) : (
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(74,140,92,0.1)' }}>
                        <Dumbbell size={18} style={{ color: '#4a8c5c' }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black truncate" style={{ color: 'var(--text-1)' }}>{ex.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-3)' }}>{ex.sets.length} Sätze × {ex.sets[0]?.reps} Wdh</p>
                    </div>
                    <button onClick={() => setWorkoutExercises((prev) => prev.filter((_, j) => j !== i))}
                      className="glass-press p-1.5 flex-shrink-0">
                      <X size={14} style={{ color: 'var(--text-3)' }} />
                    </button>
                  </div>
                ))}
              </div>

              <button onClick={() => setWorkoutExercises([])} className="w-full text-xs glass-press py-2 font-bold flex items-center justify-center gap-1"
                style={{ color: 'var(--text-3)' }}>
                <RotateCcw size={11} />Workout leeren
              </button>
            </>
          )}
        </div>
      )}

      {/* Exercise detail sheet */}
      {selectedExercise && (
        <ExerciseDetailSheet
          exercise={selectedExercise}
          onClose={() => setSelectedExercise(null)}
          onAddToWorkout={addToWorkout}
        />
      )}
    </div>
  )
}
