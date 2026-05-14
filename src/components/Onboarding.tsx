import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { Gender, ActivityLevel, Goal, UserProfile } from '../types'

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; desc: string; emoji: string }[] = [
  { value: 'sedentary', label: 'Sitzend', desc: 'Bürojob, kaum Bewegung', emoji: '🛋️' },
  { value: 'light', label: 'Leicht aktiv', desc: '1–3x Sport pro Woche', emoji: '🚶' },
  { value: 'moderate', label: 'Moderat', desc: '3–5x Sport pro Woche', emoji: '🏃' },
  { value: 'active', label: 'Sehr aktiv', desc: '6–7x Sport pro Woche', emoji: '⚡' },
  { value: 'very_active', label: 'Sportler', desc: 'Intensives Training täglich', emoji: '🏋️' },
]

export default function Onboarding() {
  const setProfile = useStore((s) => s.setProfile)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    name: '',
    age: '',
    weight: '',
    height: '',
    gender: 'male' as Gender,
    activityLevel: 'moderate' as ActivityLevel,
    goal: 'lose' as Goal,
    targetWeight: '',
    targetWeeks: '12',
  })

  const steps = [
    { title: 'Willkommen bei Kalorilo! 👋', subtitle: 'Lass uns dein Profil einrichten' },
    { title: 'Körperdaten', subtitle: 'Für eine genaue Berechnung' },
    { title: 'Aktivitätslevel', subtitle: 'Wie aktiv bist du im Alltag?' },
    { title: 'Dein Ziel', subtitle: 'Was möchtest du erreichen?' },
  ]

  const isValid = () => {
    if (step === 0) return form.name.trim().length > 0
    if (step === 1) return form.age && form.weight && form.height
    if (step === 2) return true
    if (step === 3) return form.targetWeight && form.targetWeeks
    return true
  }

  const handleFinish = () => {
    const profile: UserProfile = {
      name: form.name,
      age: parseInt(form.age),
      weight: parseFloat(form.weight),
      height: parseInt(form.height),
      gender: form.gender,
      activityLevel: form.activityLevel,
      goal: form.goal,
      targetWeight: parseFloat(form.targetWeight) || parseFloat(form.weight),
      targetWeeks: parseInt(form.targetWeeks),
    }
    setProfile(profile)
  }

  return (
    <div className="min-h-screen gradient-blue flex flex-col justify-between p-6 safe-top safe-bottom">
      {/* Logo */}
      <div className="text-center pt-8">
        <div className="text-5xl mb-3">🥗</div>
        <h1 className="text-white text-3xl font-bold">Kalorilo</h1>
        <p className="text-blue-100 text-sm mt-1">Dein smarter Ernährungsbegleiter</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-3xl p-6 shadow-2xl">
        <div className="flex gap-1.5 mb-5">
          {steps.map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${i <= step ? 'bg-blue-500' : 'bg-gray-100'}`} />
          ))}
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-1">{steps[step].title}</h2>
        <p className="text-sm text-gray-400 mb-6">{steps[step].subtitle}</p>

        {step === 0 && (
          <div className="space-y-3">
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-4 bg-gray-50 rounded-2xl text-base outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Dein Name"
            />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <div className="flex gap-2">
              {(['male', 'female'] as Gender[]).map((g) => (
                <button key={g} onClick={() => setForm({ ...form, gender: g })}
                  className={`flex-1 py-3 rounded-2xl font-medium transition ${form.gender === g ? 'gradient-blue text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {g === 'male' ? '♂ Mann' : '♀ Frau'}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Alter</label>
                <input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })}
                  className="w-full px-3 py-3 bg-gray-50 rounded-2xl text-sm outline-none text-center" placeholder="25" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Gewicht (kg)</label>
                <input type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })}
                  className="w-full px-3 py-3 bg-gray-50 rounded-2xl text-sm outline-none text-center" placeholder="75" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Größe (cm)</label>
                <input type="number" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })}
                  className="w-full px-3 py-3 bg-gray-50 rounded-2xl text-sm outline-none text-center" placeholder="175" />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            {ACTIVITY_OPTIONS.map((a) => (
              <button key={a.value} onClick={() => setForm({ ...form, activityLevel: a.value })}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl transition ${form.activityLevel === a.value ? 'gradient-blue text-white' : 'bg-gray-50'}`}>
                <span className="text-xl">{a.emoji}</span>
                <div className="text-left">
                  <div className={`text-sm font-semibold ${form.activityLevel === a.value ? 'text-white' : 'text-gray-800'}`}>{a.label}</div>
                  <div className={`text-xs ${form.activityLevel === a.value ? 'text-blue-100' : 'text-gray-400'}`}>{a.desc}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {([['lose', '📉', 'Abnehmen'], ['maintain', '➡️', 'Halten'], ['gain', '📈', 'Zunehmen']] as [Goal, string, string][]).map(([g, emoji, label]) => (
                <button key={g} onClick={() => setForm({ ...form, goal: g })}
                  className={`py-4 rounded-2xl text-center transition ${form.goal === g ? 'gradient-blue text-white' : 'bg-gray-50'}`}>
                  <div className="text-2xl mb-1">{emoji}</div>
                  <div className={`text-xs font-medium ${form.goal === g ? 'text-white' : 'text-gray-600'}`}>{label}</div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Zielgewicht (kg)</label>
                <input type="number" step="0.1" value={form.targetWeight} onChange={(e) => setForm({ ...form, targetWeight: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none" placeholder="70" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">In Wochen</label>
                <input type="number" value={form.targetWeeks} onChange={(e) => setForm({ ...form, targetWeeks: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none" placeholder="12" />
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => {
            if (!isValid()) return
            if (step < steps.length - 1) setStep(step + 1)
            else handleFinish()
          }}
          disabled={!isValid()}
          className="w-full mt-6 py-4 gradient-blue rounded-2xl text-white font-bold text-base disabled:opacity-40 flex items-center justify-center gap-2 transition"
        >
          {step < steps.length - 1 ? (
            <><span>Weiter</span><ChevronRight size={18} /></>
          ) : (
            <span>Los geht's! 🚀</span>
          )}
        </button>
      </div>

      <div className="text-center">
        <p className="text-blue-200 text-xs">Daten werden nur lokal gespeichert</p>
      </div>
    </div>
  )
}
