import { useState } from 'react'
import { Save, Key, Bell, ExternalLink } from 'lucide-react'
import { useStore } from '../store/useStore'
import { getBMI, getBMICategory } from '../utils/calculations'
import type { UserProfile, Gender, ActivityLevel, Goal } from '../types'
import toast from 'react-hot-toast'

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 'sedentary', label: 'Sitzend', desc: 'Kaum Bewegung' },
  { value: 'light', label: 'Leicht aktiv', desc: '1–3x Sport/Woche' },
  { value: 'moderate', label: 'Moderat', desc: '3–5x Sport/Woche' },
  { value: 'active', label: 'Aktiv', desc: '6–7x Sport/Woche' },
  { value: 'very_active', label: 'Sehr aktiv', desc: 'Sportler/Bauarbeiter' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4 mb-3">
      <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  )
}

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="mb-3">
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <input {...props} className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-200" />
    </div>
  )
}

export default function Profile() {
  const storeProfile = useStore((s) => s.profile)
  const setProfile = useStore((s) => s.setProfile)
  const apiKeys = useStore((s) => s.apiKeys)
  const setApiKeys = useStore((s) => s.setApiKeys)
  const reminders = useStore((s) => s.reminders)
  const setReminders = useStore((s) => s.setReminders)
  const getDailyCalorieTarget = useStore((s) => s.getDailyCalorieTarget)
  const whoopData = useStore((s) => s.whoopData)
  const setWhoopData = useStore((s) => s.setWhoopData)

  const [activeSection, setActiveSection] = useState<'profile' | 'goals' | 'apikeys' | 'whoop' | 'reminders'>('profile')

  const [form, setForm] = useState<Partial<UserProfile>>(storeProfile ?? {
    name: '', age: 25, weight: 75, height: 175, gender: 'male',
    activityLevel: 'moderate', goal: 'lose', targetWeight: 70, targetWeeks: 12,
  })

  const [keys, setKeys] = useState(apiKeys)
  const [whoopInput, setWhoopInput] = useState({ recovery: '', hrv: '', restingHR: '', sleepQuality: '', strain: '' })

  const saveProfile = () => {
    if (!form.name || !form.age || !form.weight || !form.height) { toast.error('Bitte alle Pflichtfelder ausfüllen'); return }
    setProfile(form as UserProfile)
    toast.success('Profil gespeichert! ✅')
  }

  const saveApiKeys = () => {
    setApiKeys(keys)
    toast.success('API Keys gespeichert!')
  }

  const saveWhoop = () => {
    setWhoopData({
      recovery: parseFloat(whoopInput.recovery) || 0,
      hrv: parseFloat(whoopInput.hrv) || 0,
      restingHR: parseFloat(whoopInput.restingHR) || 0,
      sleepQuality: parseFloat(whoopInput.sleepQuality) || 0,
      strain: parseFloat(whoopInput.strain) || 0,
      date: new Date().toISOString().split('T')[0],
    })
    toast.success('Whoop-Daten gespeichert!')
  }

  const target = getDailyCalorieTarget()
  const bmi = form.weight && form.height ? getBMI(form.weight, form.height) : null

  const TABS = [
    { id: 'profile' as const, label: '👤 Profil' },
    { id: 'goals' as const, label: '🎯 Ziele' },
    { id: 'apikeys' as const, label: '🔑 API Keys' },
    { id: 'whoop' as const, label: '⌚ Whoop' },
    { id: 'reminders' as const, label: '🔔 Erinnerungen' },
  ]

  return (
    <div className="pb-24 animate-fade-in">
      <div className="gradient-blue px-4 pt-12 pb-6 safe-top">
        <h1 className="text-white text-2xl font-bold">{storeProfile?.name ? `Hallo, ${storeProfile.name}!` : 'Profil & Einstellungen'}</h1>
        {storeProfile && (
          <div className="flex gap-3 mt-2">
            <div className="bg-white/20 rounded-xl px-3 py-1 text-white text-sm">{target} kcal/Tag</div>
            {bmi && <div className="bg-white/20 rounded-xl px-3 py-1 text-white text-sm">BMI {bmi}</div>}
          </div>
        )}
      </div>

      <div className="px-4 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveSection(t.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-2xl text-sm font-medium transition ${activeSection === t.id ? 'gradient-blue text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Profile */}
        {activeSection === 'profile' && (
          <Section title="Persönliche Daten">
            <Input label="Name *" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dein Name" />
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Alter *</label>
                <input type="number" value={form.age ?? ''} onChange={(e) => setForm({ ...form, age: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none" placeholder="Jahre" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Geschlecht</label>
                <div className="flex gap-2">
                  {(['male', 'female'] as Gender[]).map((g) => (
                    <button key={g} onClick={() => setForm({ ...form, gender: g })}
                      className={`flex-1 py-3 rounded-2xl text-sm font-medium transition ${form.gender === g ? 'gradient-blue text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {g === 'male' ? '♂ Mann' : '♀ Frau'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Gewicht (kg) *</label>
                <input type="number" step="0.1" value={form.weight ?? ''} onChange={(e) => setForm({ ...form, weight: parseFloat(e.target.value) })}
                  className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none" placeholder="kg" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Größe (cm) *</label>
                <input type="number" value={form.height ?? ''} onChange={(e) => setForm({ ...form, height: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none" placeholder="cm" />
              </div>
            </div>
            {bmi && (
              <div className="bg-blue-50 rounded-2xl p-3 mb-3 flex items-center justify-between">
                <span className="text-sm text-blue-700">BMI: <strong>{bmi}</strong></span>
                <span className="text-sm text-blue-500">{getBMICategory(bmi)}</span>
              </div>
            )}
            <div className="mb-3">
              <label className="text-xs text-gray-500 mb-2 block">Aktivitätslevel</label>
              <div className="space-y-1">
                {ACTIVITY_OPTIONS.map((a) => (
                  <button key={a.value} onClick={() => setForm({ ...form, activityLevel: a.value })}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-sm flex justify-between items-center transition ${form.activityLevel === a.value ? 'gradient-blue text-white' : 'bg-gray-50 text-gray-700'}`}>
                    <span className="font-medium">{a.label}</span>
                    <span className={`text-xs ${form.activityLevel === a.value ? 'text-blue-100' : 'text-gray-400'}`}>{a.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <button onClick={saveProfile} className="w-full py-3.5 gradient-blue rounded-2xl text-white font-semibold flex items-center justify-center gap-2">
              <Save size={16} /> Profil speichern
            </button>
          </Section>
        )}

        {/* Goals */}
        {activeSection === 'goals' && (
          <Section title="Ziele & Kalorienbedarf">
            <div className="mb-3">
              <label className="text-xs text-gray-500 mb-2 block">Ziel</label>
              <div className="grid grid-cols-3 gap-2">
                {([['lose', '📉 Abnehmen'], ['maintain', '➡️ Halten'], ['gain', '📈 Zunehmen']] as [Goal, string][]).map(([g, label]) => (
                  <button key={g} onClick={() => setForm({ ...form, goal: g })}
                    className={`py-3 rounded-2xl text-sm font-medium transition ${form.goal === g ? 'gradient-blue text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Zielgewicht (kg)</label>
                <input type="number" step="0.1" value={form.targetWeight ?? ''} onChange={(e) => setForm({ ...form, targetWeight: parseFloat(e.target.value) })}
                  className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none" placeholder="kg" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">In wie vielen Wochen?</label>
                <input type="number" value={form.targetWeeks ?? 12} onChange={(e) => setForm({ ...form, targetWeeks: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none" placeholder="Wochen" />
              </div>
            </div>
            {form.targetWeeks && (
              <div className="bg-green-50 rounded-2xl p-3 mb-3 text-sm text-green-700">
                ⏳ Noch <strong>{form.targetWeeks * 7}</strong> Tage bis zum Ziel
              </div>
            )}
            <div className="bg-blue-50 rounded-2xl p-3 mb-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{target} kcal</div>
              <div className="text-sm text-blue-500">dein tägliches Kalorienziel</div>
            </div>
            <button onClick={saveProfile} className="w-full py-3.5 gradient-blue rounded-2xl text-white font-semibold flex items-center justify-center gap-2">
              <Save size={16} /> Ziele speichern
            </button>
          </Section>
        )}

        {/* API Keys */}
        {activeSection === 'apikeys' && (
          <Section title="API Schlüssel">
            <div className="bg-yellow-50 rounded-2xl p-3 mb-4 text-xs text-yellow-700">
              ⚠️ API Keys werden nur lokal auf deinem Gerät gespeichert (LocalStorage). Sie werden niemals an Server übertragen.
            </div>
            {[
              { key: 'anthropic' as const, label: '🤖 Anthropic (Claude)', hint: 'Für Teller-Foto & Kühlschrank-Scan', link: 'https://console.anthropic.com' },
              { key: 'openai' as const, label: '🧠 OpenAI (GPT-4o)', hint: 'Für Rezepte & Alternative KI', link: 'https://platform.openai.com' },
              { key: 'spoonacular' as const, label: '🍴 Spoonacular', hint: 'Für Rezeptdatenbank (optional)', link: 'https://spoonacular.com/food-api' },
            ].map((item) => (
              <div key={item.key} className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-600 font-medium">{item.label}</label>
                  <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 flex items-center gap-0.5">
                    Key holen <ExternalLink size={10} />
                  </a>
                </div>
                <input
                  type="password"
                  value={keys[item.key]}
                  onChange={(e) => setKeys({ ...keys, [item.key]: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none font-mono"
                  placeholder={`sk-...`}
                />
                <div className="text-xs text-gray-400 mt-0.5">{item.hint}</div>
              </div>
            ))}
            <button onClick={saveApiKeys} className="w-full py-3.5 gradient-blue rounded-2xl text-white font-semibold flex items-center justify-center gap-2">
              <Key size={16} /> API Keys speichern
            </button>
          </Section>
        )}

        {/* Whoop */}
        {activeSection === 'whoop' && (
          <Section title="Whoop Integration">
            <div className="bg-gray-800 rounded-2xl p-4 mb-4">
              <p className="text-white text-sm mb-2 font-semibold">⌚ Whoop Daten manuell eingeben</p>
              <p className="text-gray-400 text-xs">Öffne die Whoop App und trage deine heutigen Werte ein. Die Daten fließen in deine Kalorienberechnung ein.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { key: 'recovery', label: 'Recovery Score (%)', placeholder: '0–100' },
                { key: 'hrv', label: 'HRV (ms)', placeholder: 'z.B. 65' },
                { key: 'restingHR', label: 'Ruhepuls (bpm)', placeholder: 'z.B. 52' },
                { key: 'sleepQuality', label: 'Schlafqualität (%)', placeholder: '0–100' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-gray-500 mb-1 block">{f.label}</label>
                  <input type="number" value={whoopInput[f.key as keyof typeof whoopInput]}
                    onChange={(e) => setWhoopInput({ ...whoopInput, [f.key]: e.target.value })}
                    className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none"
                    placeholder={f.placeholder} />
                </div>
              ))}
            </div>
            <div className="mb-3">
              <label className="text-xs text-gray-500 mb-1 block">Strain (0–21)</label>
              <input type="number" step="0.1" value={whoopInput.strain}
                onChange={(e) => setWhoopInput({ ...whoopInput, strain: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none"
                placeholder="z.B. 8.5" />
            </div>
            {whoopData && (
              <div className="bg-gray-800 rounded-2xl p-3 mb-3 grid grid-cols-4 gap-2 text-center">
                {[
                  { l: 'Recovery', v: `${whoopData.recovery}%` },
                  { l: 'HRV', v: `${whoopData.hrv}ms` },
                  { l: 'Schlaf', v: `${whoopData.sleepQuality}%` },
                  { l: 'Strain', v: whoopData.strain.toFixed(1) },
                ].map((item) => (
                  <div key={item.l}>
                    <div className="text-xs text-gray-400">{item.l}</div>
                    <div className="text-sm font-bold text-white">{item.v}</div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={saveWhoop} className="w-full py-3.5 bg-gray-800 rounded-2xl text-white font-semibold">
              ⌚ Whoop-Daten speichern
            </button>
          </Section>
        )}

        {/* Reminders */}
        {activeSection === 'reminders' && (
          <Section title="Erinnerungen">
            <div className="bg-blue-50 rounded-2xl p-3 mb-3 text-xs text-blue-700">
              💡 Push-Benachrichtigungen werden vom Betriebssystem verwaltet. Stelle sicher, dass Benachrichtigungen für die App erlaubt sind.
            </div>
            <div className="space-y-2">
              {reminders.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                  <div className="flex-1">
                    <input
                      type="time" value={r.time}
                      onChange={(e) => {
                        const updated = [...reminders]
                        updated[i] = { ...r, time: e.target.value }
                        setReminders(updated)
                      }}
                      className="text-sm font-semibold text-gray-800 bg-transparent outline-none"
                    />
                    <div className="text-xs text-gray-400">{r.label}</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={r.enabled}
                      onChange={(e) => {
                        const updated = [...reminders]
                        updated[i] = { ...r, enabled: e.target.checked }
                        setReminders(updated)
                      }}
                      className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                  </label>
                </div>
              ))}
            </div>
            <button
              onClick={() => toast.success('Erinnerungen gespeichert!')}
              className="w-full mt-3 py-3 gradient-blue rounded-2xl text-white font-semibold flex items-center justify-center gap-2">
              <Bell size={16} /> Speichern
            </button>
          </Section>
        )}
      </div>
    </div>
  )
}
