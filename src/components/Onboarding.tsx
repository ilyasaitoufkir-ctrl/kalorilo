import { useState } from 'react'
import { ChevronRight, ChevronLeft, Loader, Check, Sparkles } from 'lucide-react'
import { useStore } from '../store/useStore'
import { generatePersonalizationSummary } from '../utils/api'
import type { Gender, ActivityLevel, Goal, UserProfile, CoachingProfile } from '../types'

// ── Selection configs ─────────────────────────────────────────────────────
const MAIN_GOALS = [
  { id:'muscle',      emoji:'💪', label:'Muskeln aufbauen'   },
  { id:'fat_loss',    emoji:'🔥', label:'Fett verlieren'     },
  { id:'performance', emoji:'⚡', label:'Performance'        },
  { id:'sleep',       emoji:'😴', label:'Schlaf optimieren'  },
  { id:'health',      emoji:'🧬', label:'Gesünder leben'     },
  { id:'endurance',   emoji:'🏃', label:'Ausdauer verbessern'},
]
const DIET_TYPES = [
  { id:'normal',      emoji:'🍽️', label:'Normal (alles)'  },
  { id:'vegetarian',  emoji:'🥗', label:'Vegetarisch'     },
  { id:'vegan',       emoji:'🌱', label:'Vegan'           },
  { id:'lowcarb',     emoji:'🥩', label:'Low Carb / Keto' },
  { id:'halal',       emoji:'☪️', label:'Halal'           },
  { id:'lactosefree', emoji:'🥛', label:'Laktosefrei'     },
  { id:'glutenfree',  emoji:'🌾', label:'Glutenfrei'      },
]
const SPORT_TYPES = [
  { id:'strength', emoji:'🏋️', label:'Krafttraining'    },
  { id:'running',  emoji:'🏃', label:'Laufen'           },
  { id:'cycling',  emoji:'🚴', label:'Radfahren'        },
  { id:'swimming', emoji:'🏊', label:'Schwimmen'        },
  { id:'team',     emoji:'⚽', label:'Mannschaftssport'  },
  { id:'yoga',     emoji:'🧘', label:'Yoga/Pilates'     },
  { id:'martial',  emoji:'🥊', label:'Kampfsport'       },
  { id:'other',    emoji:'🎯', label:'Anderes'          },
]
const TRAINING_TIMES = [
  { id:'morning', emoji:'🌅', label:'Morgens' },
  { id:'noon',    emoji:'☀️', label:'Mittags' },
  { id:'evening', emoji:'🌙', label:'Abends'  },
]
const SLEEP_QUALITY = [
  { id:'great',  emoji:'⭐', label:'Sehr gut' },
  { id:'good',   emoji:'😊', label:'Gut'      },
  { id:'medium', emoji:'😐', label:'Mittel'   },
  { id:'poor',   emoji:'😴', label:'Schlecht' },
]
const STRESS_LEVELS = [
  { id:'low',      emoji:'😌', label:'Niedrig'   },
  { id:'medium',   emoji:'😐', label:'Mittel'    },
  { id:'high',     emoji:'😤', label:'Hoch'      },
  { id:'very_high',emoji:'🔥', label:'Sehr hoch' },
]
const DISCIPLINE_LEVELS = [
  { id:'very',    emoji:'💎', label:'Sehr diszipliniert'        },
  { id:'mostly',  emoji:'👍', label:'Meistens diszipliniert'    },
  { id:'need',    emoji:'🤝', label:'Brauche Motivation'        },
  { id:'restart', emoji:'🔄', label:'Fange immer wieder neu an' },
]
const ALCOHOL = [
  { id:'never',     label:'Nie'      },
  { id:'rarely',    label:'Selten'   },
  { id:'sometimes', label:'Manchmal' },
  { id:'often',     label:'Oft'      },
]
const CAFFEINE = [
  { id:'none',   label:'Kein Koffein' },
  { id:'low',    label:'1 Kaffee'     },
  { id:'medium', label:'2-3 Kaffee'  },
  { id:'high',   label:'4+ Kaffee'   },
]
const WORK_TYPES = [
  { id:'office',   emoji:'💻', label:'Büro / Sitzend'   },
  { id:'physical', emoji:'🏗️', label:'Körperlich aktiv' },
  { id:'mixed',    emoji:'⚖️', label:'Gemischt'          },
]

const TOTAL_STEPS = 8

// ── Shared UI helpers ─────────────────────────────────────────────────────
const inp = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 14,
  color: 'var(--text-1)',
  padding: '14px 16px',
  width: '100%',
  fontSize: 16,
  fontWeight: 600,
  outline: 'none',
} as const

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="glass-press transition-all duration-150"
      style={{
        background: selected ? 'rgba(74,140,92,0.18)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${selected ? 'rgba(74,140,92,0.45)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 14, padding: '10px 14px',
        color: selected ? '#7db88a' : 'var(--text-2)',
        fontWeight: 700, fontSize: 14, cursor: 'pointer',
      }}>
      {children}
    </button>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-black mb-2.5" style={{ color: 'var(--text-2)' }}>{children}</p>
}

// ── Main component ────────────────────────────────────────────────────────
export default function Onboarding() {
  const setProfile         = useStore((s) => s.setProfile)
  const setCoachingProfile = useStore((s) => s.setCoachingProfile)
  const apiKeys            = useStore((s) => s.apiKeys)

  const [step, setStep] = useState(0)

  // Step 1 – Basics
  const [name, setName]         = useState('')
  const [age, setAge]           = useState('')
  const [gender, setGender]     = useState<Gender>('male')
  const [height, setHeight]     = useState('')
  const [weight, setWeight]     = useState('')
  const [targetW, setTargetW]   = useState('')
  const [targetWks, setTargetWks] = useState('12')

  // Step 2 – Goals
  const [mainGoals, setMainGoals] = useState<string[]>([])
  const [actLevel, setActLevel]   = useState<ActivityLevel>('moderate')
  const [goal, setGoal]           = useState<Goal>('lose')

  // Step 3 – Nutrition
  const [dietType, setDietType]           = useState('normal')
  const [mealsPerDay, setMealsPerDay]     = useState(3)
  const [eatsBreakfast, setEatsBreakfast] = useState(true)
  const [mealTimes, setMealTimes]         = useState('')
  const [favFoods, setFavFoods]           = useState('')
  const [dislikedFoods, setDisliked]      = useState('')
  const [allergies, setAllergies]         = useState('')
  const [alcohol, setAlcohol]             = useState('rarely')
  const [caffeine, setCaffeine]           = useState('medium')

  // Step 4 – Training
  const [trainDays, setTrainDays]             = useState(3)
  const [sports, setSports]                   = useState<string[]>([])
  const [trainDuration, setTrainDuration]     = useState(60)
  const [trainTime, setTrainTime]             = useState('evening')
  const [trainIntensity, setTrainIntensity]   = useState('medium')

  // Step 5 – Sleep
  const [sleepTime, setSleepTime]             = useState('23:00')
  const [wakeTime, setWakeTime]               = useState('07:00')
  const [sleepQuality, setSleepQuality]       = useState('good')
  const [naps, setNaps]                       = useState(false)
  const [sleepDisruptors, setSleepDisruptors] = useState('')

  // Step 6 – Health
  const [healthLimits, setHealthLimits]   = useState('')
  const [supplements, setSupplements]     = useState('')
  const [stressLevel, setStressLevel]     = useState('medium')
  const [sittingHours, setSittingHours]   = useState('6-8h')
  const [workType, setWorkType]           = useState('office')

  // Step 7 – Whoop
  const [whoopDuration, setWhoopDuration] = useState('')
  const [avgRecovery, setAvgRecovery]     = useState('')
  const [avgHrv, setAvgHrv]               = useState('')
  const [whoopGoals, setWhoopGoals]       = useState('')

  // Step 8 – Motivation
  const [whyHealthy, setWhyHealthy]       = useState('')
  const [pastFails, setPastFails]         = useState('')
  const [motivStyle, setMotivStyle]       = useState('')
  const [discipline, setDiscipline]       = useState('mostly')
  const [bigChallenge, setBigChallenge]   = useState('')

  const [generating, setGenerating] = useState(false)

  const toggleMulti = (arr: string[], setArr: (v: string[]) => void, id: string) =>
    setArr(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])

  const isStepValid = () => {
    if (step === 1) return name.trim().length > 0 && age && weight && height
    if (step === 2) return mainGoals.length > 0
    return true
  }

  const handleFinish = async () => {
    setGenerating(true)
    const profile: UserProfile = {
      name: name.trim(),
      age: parseInt(age) || 25,
      weight: parseFloat(weight) || 75,
      height: parseInt(height) || 175,
      gender,
      activityLevel: actLevel,
      goal,
      targetWeight: parseFloat(targetW) || parseFloat(weight) || 75,
      targetWeeks: parseInt(targetWks) || 12,
    }
    const cp: CoachingProfile = {
      mainGoals, dietType, mealsPerDay, eatsBreakfast, mealTimes,
      favoriteFoods: favFoods, dislikedFoods, allergies,
      alcoholConsumption: alcohol, caffeineLevel: caffeine,
      trainingDaysPerWeek: trainDays, sportTypes: sports,
      trainingDurationMin: trainDuration, trainingTime: trainTime, trainingIntensity: trainIntensity,
      sleepTime, wakeTime, sleepQualityRating: sleepQuality, naps, sleepDisruptors,
      healthLimitations: healthLimits, currentSupplements: supplements,
      stressLevel, dailySittingHours: sittingHours, workType,
      whoopUsageDuration: whoopDuration, avgRecovery, avgHrv, whoopGoals,
      healthMotivation: whyHealthy, pastFailures: pastFails,
      motivationStyle: motivStyle, disciplineLevel: discipline, biggestChallenge: bigChallenge,
      completedAt: Date.now(),
    }
    const apiKey = apiKeys.anthropic || apiKeys.openai
    if (apiKey) {
      try { cp.aiPersonalizationSummary = await generatePersonalizationSummary(profile, cp, apiKey) } catch { /* skip */ }
    }
    setProfile(profile)
    setCoachingProfile(cp)
  }

  // ── Welcome screen ────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 pt-safe pb-10"
        style={{ background: 'var(--bg)' }}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>🥗</div>
        <h1 className="text-3xl font-black text-center mb-3" style={{ color: 'var(--text-1)' }}>
          Willkommen bei Kalorilo!
        </h1>
        <p className="text-center mb-2 leading-relaxed" style={{ color: 'var(--text-2)', maxWidth: 320 }}>
          Beantworte 8 kurze Fragen – dein KI-Coach erstellt dann ein komplett personalisiertes Profil.
        </p>
        <p className="text-center text-xs mb-12" style={{ color: 'var(--text-3)' }}>
          ca. 3 Minuten · einmalig
        </p>
        <button onClick={() => setStep(1)}
          className="btn-gold w-full max-w-xs py-5 flex items-center justify-center gap-3 text-lg font-black rounded-2xl">
          Loslegen <ChevronRight size={20} />
        </button>
      </div>
    )
  }

  // ── Generating screen ─────────────────────────────────────────────────
  if (generating) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 pt-safe"
        style={{ background: 'var(--bg)' }}>
        <div style={{ fontSize: 52, marginBottom: 20 }}>🤖</div>
        <Loader size={36} className="animate-spin mb-5" style={{ color: '#4a8c5c' }} />
        <h2 className="text-xl font-black mb-2 text-center" style={{ color: 'var(--text-1)' }}>
          KI analysiert dein Profil…
        </h2>
        <p className="text-sm text-center mb-8" style={{ color: 'var(--text-3)', maxWidth: 280 }}>
          Dein persönlicher Coach wird gerade konfiguriert
        </p>
        <div className="space-y-2 w-full max-w-sm">
          {['Kalorienziel berechnen','Makros optimieren','Trainingsplan anpassen','Coaching-Stil kalibrieren'].map((t, i) => (
            <div key={i} className="flex items-center gap-3 glass px-4 py-3 rounded-2xl"
              style={{ opacity: 0.55 + i * 0.12 }}>
              <Sparkles size={14} style={{ color: '#4a8c5c', flexShrink: 0 }} />
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>{t}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Progress bar ──────────────────────────────────────────────────────
  const pct = (step / TOTAL_STEPS) * 100

  return (
    <div className="min-h-dvh overflow-y-auto" style={{ background: 'var(--bg)' }}>
      {/* Sticky progress */}
      <div className="sticky top-0 z-10 px-5 pt-safe pb-3"
        style={{ background: 'var(--bg)', borderBottom: '1px solid rgba(74,140,92,0.08)' }}>
        <div className="flex items-center justify-between mb-2 pt-3">
          <p className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>Schritt {step} / {TOTAL_STEPS}</p>
          <p className="text-xs font-black" style={{ color: '#4a8c5c' }}>{Math.round(pct)}%</p>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(74,140,92,0.1)' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#7db88a,#4a8c5c)' }} />
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pt-4 pb-40">

        {/* ── Step 1: Basics ── */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-black mb-1" style={{ color: 'var(--text-1)' }}>Deine Basics</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-3)' }}>Für genaue Berechnungen</p>
            <div className="space-y-4">
              <div>
                <Label>Wie heißt du?</Label>
                <input style={inp} placeholder="Dein Name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Alter</Label>
                  <input style={inp} type="number" inputMode="numeric" placeholder="25" value={age} onChange={(e) => setAge(e.target.value)} />
                </div>
                <div>
                  <Label>Geschlecht</Label>
                  <div className="flex gap-2">
                    <Chip selected={gender==='male'}   onClick={() => setGender('male')}>♂ Männlich</Chip>
                    <Chip selected={gender==='female'} onClick={() => setGender('female')}>♀ Weiblich</Chip>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Größe (cm)</Label>
                  <input style={inp} type="number" inputMode="numeric" placeholder="175" value={height} onChange={(e) => setHeight(e.target.value)} />
                </div>
                <div>
                  <Label>Gewicht (kg)</Label>
                  <input style={inp} type="number" inputMode="decimal" placeholder="75" value={weight} onChange={(e) => setWeight(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Zielgewicht (kg)</Label>
                  <input style={inp} type="number" inputMode="decimal" placeholder="70" value={targetW} onChange={(e) => setTargetW(e.target.value)} />
                </div>
                <div>
                  <Label>In wie vielen Wochen?</Label>
                  <input style={inp} type="number" inputMode="numeric" placeholder="12" value={targetWks} onChange={(e) => setTargetWks(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Goals ── */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-black mb-1" style={{ color: 'var(--text-1)' }}>Deine Ziele</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-3)' }}>Mehrfachauswahl möglich</p>
            <Label>Was ist dein Hauptziel?</Label>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {MAIN_GOALS.map((g) => (
                <Chip key={g.id} selected={mainGoals.includes(g.id)} onClick={() => toggleMulti(mainGoals, setMainGoals, g.id)}>
                  {g.emoji} {g.label}
                </Chip>
              ))}
            </div>
            <Label>Gewichtsziel?</Label>
            <div className="flex gap-2 flex-wrap mb-6">
              {[{v:'lose',l:'🔥 Abnehmen'},{v:'maintain',l:'⚖️ Halten'},{v:'gain',l:'💪 Zunehmen'}].map((g) => (
                <Chip key={g.v} selected={goal===g.v} onClick={() => setGoal(g.v as Goal)}>{g.l}</Chip>
              ))}
            </div>
            <Label>Aktivitätslevel?</Label>
            <div className="space-y-2">
              {[
                {v:'sedentary',   l:'🛋️ Sitzend',      d:'Bürojob, kaum Bewegung'},
                {v:'light',       l:'🚶 Leicht aktiv', d:'1–3× Sport/Woche'},
                {v:'moderate',    l:'🏃 Moderat',      d:'3–5× Sport/Woche'},
                {v:'active',      l:'⚡ Sehr aktiv',   d:'6–7× Sport/Woche'},
                {v:'very_active', l:'🏋️ Sportler',     d:'Täglich intensiv'},
              ].map((a) => (
                <button key={a.v} onClick={() => setActLevel(a.v as ActivityLevel)}
                  className="w-full glass glass-press p-3 flex items-center gap-3 text-left"
                  style={{ borderColor: actLevel===a.v ? 'rgba(74,140,92,0.4)' : undefined, background: actLevel===a.v ? 'rgba(74,140,92,0.08)' : undefined }}>
                  <span className="text-lg flex-shrink-0">{a.l.split(' ')[0]}</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold" style={{ color: actLevel===a.v ? '#7db88a' : 'var(--text-1)' }}>{a.l.split(' ').slice(1).join(' ')}</p>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>{a.d}</p>
                  </div>
                  {actLevel===a.v && <Check size={16} style={{ color:'#7db88a', flexShrink:0 }}/>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3: Nutrition ── */}
        {step === 3 && (
          <div>
            <h2 className="text-2xl font-black mb-1" style={{ color: 'var(--text-1)' }}>Deine Ernährung</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-3)' }}>Für perfekte Mahlzeitenempfehlungen</p>
            <div className="space-y-5">
              <div>
                <Label>Wie isst du aktuell?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {DIET_TYPES.map((d) => (
                    <Chip key={d.id} selected={dietType===d.id} onClick={() => setDietType(d.id)}>{d.emoji} {d.label}</Chip>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Mahlzeiten / Tag</Label>
                  <div className="flex gap-2 flex-wrap">
                    {[2,3,4,5].map((n) => <Chip key={n} selected={mealsPerDay===n} onClick={() => setMealsPerDay(n)}>{n}</Chip>)}
                  </div>
                </div>
                <div>
                  <Label>Frühstück?</Label>
                  <div className="flex gap-2">
                    <Chip selected={eatsBreakfast}  onClick={() => setEatsBreakfast(true)}>Ja ✅</Chip>
                    <Chip selected={!eatsBreakfast} onClick={() => setEatsBreakfast(false)}>Nein ❌</Chip>
                  </div>
                </div>
              </div>
              <div>
                <Label>Essenszeiten (ungefähr)</Label>
                <input style={inp} placeholder="z.B. 08:00, 13:00, 19:30" value={mealTimes} onChange={(e) => setMealTimes(e.target.value)} />
              </div>
              <div>
                <Label>Lieblingsspeisen</Label>
                <input style={inp} placeholder="z.B. Pasta, Hähnchen, Salat…" value={favFoods} onChange={(e) => setFavFoods(e.target.value)} />
              </div>
              <div>
                <Label>Was magst du nicht?</Label>
                <input style={inp} placeholder="z.B. Leber, Spinat…" value={dislikedFoods} onChange={(e) => setDisliked(e.target.value)} />
              </div>
              <div>
                <Label>Allergien / Unverträglichkeiten</Label>
                <input style={inp} placeholder="z.B. Nüsse, Gluten… (oder keine)" value={allergies} onChange={(e) => setAllergies(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Alkohol?</Label>
                  <div className="flex flex-wrap gap-2">
                    {ALCOHOL.map((a) => <Chip key={a.id} selected={alcohol===a.id} onClick={() => setAlcohol(a.id)}>{a.label}</Chip>)}
                  </div>
                </div>
                <div>
                  <Label>Koffein / Tag</Label>
                  <div className="flex flex-wrap gap-2">
                    {CAFFEINE.map((c) => <Chip key={c.id} selected={caffeine===c.id} onClick={() => setCaffeine(c.id)}>{c.label}</Chip>)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Training ── */}
        {step === 4 && (
          <div>
            <h2 className="text-2xl font-black mb-1" style={{ color: 'var(--text-1)' }}>Dein Training</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-3)' }}>Für optimale Kalorienberechnung</p>
            <div className="space-y-5">
              <div>
                <Label>Wie oft pro Woche?</Label>
                <div className="flex gap-2 flex-wrap">
                  {[0,1,2,3,4,5,6,7].map((n) => <Chip key={n} selected={trainDays===n} onClick={() => setTrainDays(n)}>{n}×</Chip>)}
                </div>
              </div>
              <div>
                <Label>Welche Sportarten? (Mehrfach)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {SPORT_TYPES.map((s) => (
                    <Chip key={s.id} selected={sports.includes(s.id)} onClick={() => toggleMulti(sports, setSports, s.id)}>
                      {s.emoji} {s.label}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <Label>Wie lange pro Einheit?</Label>
                <div className="flex gap-2 flex-wrap">
                  {[20,30,45,60,75,90,120].map((n) => <Chip key={n} selected={trainDuration===n} onClick={() => setTrainDuration(n)}>{n} Min.</Chip>)}
                </div>
              </div>
              <div>
                <Label>Wann trainierst du meistens?</Label>
                <div className="flex gap-3">
                  {TRAINING_TIMES.map((t) => (
                    <Chip key={t.id} selected={trainTime===t.id} onClick={() => setTrainTime(t.id)}>{t.emoji} {t.label}</Chip>
                  ))}
                </div>
              </div>
              <div>
                <Label>Wie intensiv?</Label>
                <div className="flex gap-2">
                  {[{v:'light',l:'🚶 Leicht'},{v:'medium',l:'🏃 Mittel'},{v:'intense',l:'🔥 Intensiv'}].map((t) => (
                    <Chip key={t.v} selected={trainIntensity===t.v} onClick={() => setTrainIntensity(t.v)}>{t.l}</Chip>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 5: Sleep ── */}
        {step === 5 && (
          <div>
            <h2 className="text-2xl font-black mb-1" style={{ color: 'var(--text-1)' }}>Dein Schlaf</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-3)' }}>Schlaf beeinflusst Ernährung & Recovery enorm</p>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Schlafen um</Label>
                  <input style={inp} type="time" value={sleepTime} onChange={(e) => setSleepTime(e.target.value)} />
                </div>
                <div>
                  <Label>Aufstehen um</Label>
                  <input style={inp} type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Schlafqualität?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {SLEEP_QUALITY.map((q) => <Chip key={q.id} selected={sleepQuality===q.id} onClick={() => setSleepQuality(q.id)}>{q.emoji} {q.label}</Chip>)}
                </div>
              </div>
              <div>
                <Label>Schläfst du tagsüber?</Label>
                <div className="flex gap-2">
                  <Chip selected={naps}  onClick={() => setNaps(true)}>Ja, oft 😴</Chip>
                  <Chip selected={!naps} onClick={() => setNaps(false)}>Selten / nie</Chip>
                </div>
              </div>
              <div>
                <Label>Was stört deinen Schlaf?</Label>
                <input style={inp} placeholder="z.B. Stress, Handy, Lärm, keins…" value={sleepDisruptors} onChange={(e) => setSleepDisruptors(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 6: Health ── */}
        {step === 6 && (
          <div>
            <h2 className="text-2xl font-black mb-1" style={{ color: 'var(--text-1)' }}>Gesundheit & Alltag</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-3)' }}>Für sichere & passende Empfehlungen</p>
            <div className="space-y-5">
              <div>
                <Label>Gesundheitliche Einschränkungen?</Label>
                <input style={inp} placeholder="z.B. Knieschmerzen, Rücken, keine…" value={healthLimits} onChange={(e) => setHealthLimits(e.target.value)} />
              </div>
              <div>
                <Label>Nimmst du Supplements?</Label>
                <input style={inp} placeholder="z.B. Vitamin D, Protein, Kreatin, keine…" value={supplements} onChange={(e) => setSupplements(e.target.value)} />
              </div>
              <div>
                <Label>Stresslevel?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {STRESS_LEVELS.map((s) => <Chip key={s.id} selected={stressLevel===s.id} onClick={() => setStressLevel(s.id)}>{s.emoji} {s.label}</Chip>)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Stunden sitzen / Tag</Label>
                  <div className="flex flex-wrap gap-2">
                    {['<4h','4-6h','6-8h','8-10h','10h+'].map((h) => <Chip key={h} selected={sittingHours===h} onClick={() => setSittingHours(h)}>{h}</Chip>)}
                  </div>
                </div>
                <div>
                  <Label>Art der Arbeit</Label>
                  <div className="space-y-2">
                    {WORK_TYPES.map((w) => <Chip key={w.id} selected={workType===w.id} onClick={() => setWorkType(w.id)}>{w.emoji} {w.label}</Chip>)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 7: Whoop ── */}
        {step === 7 && (
          <div>
            <h2 className="text-2xl font-black mb-1" style={{ color: 'var(--text-1)' }}>⌚ Whoop & Biometrie</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-3)' }}>Optional – einfach überspringen falls du kein Whoop nutzt</p>
            <div className="space-y-4">
              <div>
                <Label>Wie lange nutzt du Whoop schon?</Label>
                <div className="flex flex-wrap gap-2">
                  {['Neu','1-3 Monate','3-6 Monate','6+ Monate','Nutze kein Whoop'].map((d) => (
                    <Chip key={d} selected={whoopDuration===d} onClick={() => setWhoopDuration(d)}>{d}</Chip>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ø Recovery</Label>
                  <input style={inp} placeholder="z.B. 65%" value={avgRecovery} onChange={(e) => setAvgRecovery(e.target.value)} />
                </div>
                <div>
                  <Label>Ø HRV</Label>
                  <input style={inp} placeholder="z.B. 55ms" value={avgHrv} onChange={(e) => setAvgHrv(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Was möchtest du mit Whoop verbessern?</Label>
                <input style={inp} placeholder="z.B. Recovery steigern, Schlaf verbessern…" value={whoopGoals} onChange={(e) => setWhoopGoals(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 8: Motivation ── */}
        {step === 8 && (
          <div>
            <h2 className="text-2xl font-black mb-1" style={{ color: 'var(--text-1)' }}>Deine Motivation</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-3)' }}>Damit ich dich wirklich verstehe</p>
            <div className="space-y-5">
              <div>
                <Label>Warum möchtest du gesünder leben?</Label>
                <textarea style={{ ...inp, minHeight: 80, resize: 'none' } as React.CSSProperties}
                  placeholder="Dein persönlicher Grund…" value={whyHealthy} onChange={(e) => setWhyHealthy(e.target.value)} />
              </div>
              <div>
                <Label>Was hat bisher nicht funktioniert?</Label>
                <input style={inp} placeholder="z.B. Jo-Jo-Effekt, keine Zeit…" value={pastFails} onChange={(e) => setPastFails(e.target.value)} />
              </div>
              <div>
                <Label>Was motiviert dich am meisten?</Label>
                <input style={inp} placeholder="z.B. Fotos, Challenges, Fortschritt sehen…" value={motivStyle} onChange={(e) => setMotivStyle(e.target.value)} />
              </div>
              <div>
                <Label>Wie diszipliniert bist du?</Label>
                <div className="space-y-2">
                  {DISCIPLINE_LEVELS.map((d) => (
                    <button key={d.id} onClick={() => setDiscipline(d.id)}
                      className="w-full glass glass-press p-3 flex items-center gap-3 text-left"
                      style={{ borderColor: discipline===d.id ? 'rgba(74,140,92,0.4)' : undefined, background: discipline===d.id ? 'rgba(74,140,92,0.08)' : undefined }}>
                      <span>{d.emoji}</span>
                      <p className="text-sm font-bold flex-1" style={{ color: discipline===d.id ? '#7db88a' : 'var(--text-1)' }}>{d.label}</p>
                      {discipline===d.id && <Check size={16} style={{ color:'#7db88a', flexShrink:0 }}/>}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Deine größte Herausforderung?</Label>
                <input style={inp} placeholder="z.B. Abends Heißhunger, kein Plan…" value={bigChallenge} onChange={(e) => setBigChallenge(e.target.value)} />
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Fixed bottom nav ── */}
      <div className="fixed bottom-0 left-0 right-0 px-5 pb-safe pt-3"
        style={{ background: 'var(--bg)', borderTop: '1px solid rgba(74,140,92,0.1)', paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
        <div className="flex gap-3 py-2">
          {step > 1 && (
            <button onClick={() => setStep(step - 1)}
              className="glass glass-press flex items-center gap-1 px-4 py-4 rounded-2xl font-bold text-sm"
              style={{ color: 'var(--text-2)', flexShrink: 0 }}>
              <ChevronLeft size={16} /> Zurück
            </button>
          )}
          {step < TOTAL_STEPS ? (
            <button onClick={() => { if (isStepValid()) setStep(step + 1) }}
              disabled={!isStepValid()}
              className="btn-gold flex-1 py-4 flex items-center justify-center gap-2 font-black text-base"
              style={{ opacity: isStepValid() ? 1 : 0.4 }}>
              Weiter <ChevronRight size={18} />
            </button>
          ) : (
            <button onClick={handleFinish}
              className="btn-gold flex-1 py-4 flex items-center justify-center gap-2 font-black text-base">
              <Sparkles size={18} /> Profil erstellen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
