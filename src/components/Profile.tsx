import { useState } from 'react'
import { Save, Key, ExternalLink, Bell } from 'lucide-react'
import { useStore } from '../store/useStore'
import { getBMI, getBMICategory } from '../utils/calculations'
import type { UserProfile, Gender, ActivityLevel, Goal } from '../types'
import toast from 'react-hot-toast'

const ACTIVITY_OPTIONS: { value: ActivityLevel; emoji: string; label: string; desc: string }[] = [
  { value: 'sedentary',  emoji: '🛋️', label: 'Sitzend',      desc: 'Bürojob, kaum Bewegung' },
  { value: 'light',      emoji: '🚶', label: 'Leicht aktiv', desc: '1–3x Sport/Woche' },
  { value: 'moderate',   emoji: '🏃', label: 'Moderat',      desc: '3–5x Sport/Woche' },
  { value: 'active',     emoji: '⚡', label: 'Sehr aktiv',   desc: '6–7x Sport/Woche' },
  { value: 'very_active',emoji: '🏋️', label: 'Sportler',     desc: 'Intensiv täglich' },
]

export default function Profile() {
  const storeProfile = useStore((s) => s.profile)
  const setProfile   = useStore((s) => s.setProfile)
  const apiKeys      = useStore((s) => s.apiKeys)
  const setApiKeys   = useStore((s) => s.setApiKeys)
  const reminders    = useStore((s) => s.reminders)
  const setReminders = useStore((s) => s.setReminders)
  const getDailyCalorieTarget = useStore((s) => s.getDailyCalorieTarget)
  const whoopData    = useStore((s) => s.whoopData)
  const setWhoopData = useStore((s) => s.setWhoopData)

  const [section, setSection] = useState<'profile'|'goals'|'apikeys'|'whoop'|'reminders'>('profile')
  const [form, setForm] = useState<Partial<UserProfile>>(storeProfile ?? { name:'', age:25, weight:75, height:175, gender:'male', activityLevel:'moderate', goal:'lose', targetWeight:70, targetWeeks:12 })
  const [keys, setKeys] = useState(apiKeys)
  const [whoopForm, setWhoopForm] = useState({ recovery: '', hrv: '', restingHR: '', sleepQuality: '', strain: '' })

  const target = getDailyCalorieTarget()
  const bmi = form.weight && form.height ? getBMI(Number(form.weight), Number(form.height)) : null

  const saveProfile = () => {
    if (!form.name || !form.age || !form.weight || !form.height) { toast.error('Pflichtfelder ausfüllen'); return }
    setProfile(form as UserProfile); toast.success('Gespeichert! ✅')
  }

  const saveKeys = () => { setApiKeys(keys); toast.success('API Keys gespeichert!') }

  const saveWhoop = () => {
    setWhoopData({ recovery: parseFloat(whoopForm.recovery)||0, hrv: parseFloat(whoopForm.hrv)||0, restingHR: parseFloat(whoopForm.restingHR)||0, sleepQuality: parseFloat(whoopForm.sleepQuality)||0, strain: parseFloat(whoopForm.strain)||0, date: new Date().toISOString().split('T')[0] })
    toast.success('Whoop-Daten gespeichert!')
  }

  const SECTIONS = [
    { id: 'profile' as const,   label: '👤 Profil' },
    { id: 'goals' as const,     label: '🎯 Ziele' },
    { id: 'apikeys' as const,   label: '🔑 API Keys' },
    { id: 'whoop' as const,     label: '⌚ Whoop' },
    { id: 'reminders' as const, label: '🔔 Erinnerungen' },
  ]

  return (
    <div className="pb-nav anim-fade">
      {/* Header */}
      <div className="grad-blue px-5 pt-safe pb-6 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/5" />
        <h1 className="text-white text-2xl font-black">{storeProfile?.name ? `Hallo, ${storeProfile.name.split(' ')[0]}!` : 'Profil & Einstellungen'}</h1>
        {storeProfile && (
          <div className="flex gap-2 mt-2">
            <div className="bg-white/20 rounded-xl px-3 py-1 text-white text-sm font-bold">{target} kcal/Tag</div>
            {bmi && <div className="bg-white/20 rounded-xl px-3 py-1 text-white text-sm font-bold">BMI {bmi} · {getBMICategory(bmi)}</div>}
          </div>
        )}
      </div>

      <div className="px-4 py-4">
        {/* Section tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-sm font-bold transition whitespace-nowrap ${section === s.id ? 'bg-blue-500 text-white' : 'bg-white text-slate-600'}`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* ── Profil ── */}
        {section === 'profile' && (
          <div className="card p-5 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Name</label>
              <input value={form.name??''} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-slate-50 rounded-2xl px-4 py-3.5 text-sm font-medium outline-none" placeholder="Dein Name" />
            </div>
            <div className="flex gap-2">
              {(['male','female'] as Gender[]).map((g) => (
                <button key={g} onClick={() => setForm({ ...form, gender: g })}
                  className={`flex-1 py-3 rounded-2xl font-bold text-sm transition ${form.gender === g ? 'bg-blue-500 text-white' : 'bg-slate-50 text-slate-600'}`}>
                  {g === 'male' ? '♂ Mann' : '♀ Frau'}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[{ label: 'Alter', key: 'age', placeholder: '25' }, { label: 'Gewicht (kg)', key: 'weight', placeholder: '75' }, { label: 'Größe (cm)', key: 'height', placeholder: '175' }].map((f) => (
                <div key={f.key}>
                  <label className="text-xs font-bold text-slate-500 mb-1.5 block">{f.label}</label>
                  <input type="number" value={(form as any)[f.key]??''} onChange={(e) => setForm({ ...form, [f.key]: parseFloat(e.target.value) })}
                    className="w-full bg-slate-50 rounded-2xl px-3 py-3 text-sm font-medium text-center outline-none" placeholder={f.placeholder} />
                </div>
              ))}
            </div>
            {bmi && (
              <div className="bg-blue-50 rounded-2xl px-4 py-3 flex justify-between items-center">
                <span className="text-sm font-bold text-blue-800">BMI: {bmi}</span>
                <span className="text-sm text-blue-600">{getBMICategory(bmi)}</span>
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Aktivitätslevel</label>
              <div className="space-y-2">
                {ACTIVITY_OPTIONS.map((a) => (
                  <button key={a.value} onClick={() => setForm({ ...form, activityLevel: a.value })}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition text-left ${form.activityLevel === a.value ? 'bg-blue-500' : 'bg-slate-50'}`}>
                    <span className="text-xl">{a.emoji}</span>
                    <div>
                      <p className={`text-sm font-bold ${form.activityLevel === a.value ? 'text-white' : 'text-slate-800'}`}>{a.label}</p>
                      <p className={`text-xs ${form.activityLevel === a.value ? 'text-blue-100' : 'text-slate-400'}`}>{a.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <button onClick={saveProfile} className="w-full py-4 bg-blue-500 rounded-3xl text-white font-black flex items-center justify-center gap-2">
              <Save size={16} />Profil speichern
            </button>
          </div>
        )}

        {/* ── Ziele ── */}
        {section === 'goals' && (
          <div className="card p-5 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Mein Ziel</label>
              <div className="grid grid-cols-3 gap-2">
                {([['lose','📉','Abnehmen'],['maintain','➡️','Halten'],['gain','📈','Zunehmen']] as [Goal,string,string][]).map(([g,emoji,label]) => (
                  <button key={g} onClick={() => setForm({ ...form, goal: g })}
                    className={`py-4 rounded-2xl text-center transition ${form.goal === g ? 'bg-blue-500' : 'bg-slate-50'}`}>
                    <p className="text-2xl mb-0.5">{emoji}</p>
                    <p className={`text-xs font-bold ${form.goal === g ? 'text-white' : 'text-slate-600'}`}>{label}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">Zielgewicht (kg)</label>
                <input type="number" step="0.1" value={form.targetWeight??''} onChange={(e) => setForm({ ...form, targetWeight: parseFloat(e.target.value) })}
                  className="w-full bg-slate-50 rounded-2xl px-4 py-3.5 text-sm font-medium outline-none" placeholder="70" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">In Wochen</label>
                <input type="number" value={form.targetWeeks??12} onChange={(e) => setForm({ ...form, targetWeeks: parseInt(e.target.value) })}
                  className="w-full bg-slate-50 rounded-2xl px-4 py-3.5 text-sm font-medium outline-none" placeholder="12" />
              </div>
            </div>
            {form.targetWeeks && (
              <div className="bg-green-50 rounded-2xl px-4 py-3 text-center">
                <p className="text-sm font-bold text-green-700">⏳ Noch {(form.targetWeeks||12) * 7} Tage bis zum Ziel</p>
              </div>
            )}
            <div className="bg-blue-50 rounded-2xl px-4 py-4 text-center">
              <p className="text-3xl font-black text-blue-600">{target}</p>
              <p className="text-sm text-blue-500">kcal Tagesziel</p>
            </div>
            <button onClick={saveProfile} className="w-full py-4 bg-blue-500 rounded-3xl text-white font-black flex items-center justify-center gap-2">
              <Save size={16} />Ziele speichern
            </button>
          </div>
        )}

        {/* ── API Keys ── */}
        {section === 'apikeys' && (
          <div className="space-y-3">
            <div className="bg-amber-50 rounded-2xl p-4">
              <p className="text-xs font-bold text-amber-700">🔒 Keys werden nur lokal auf deinem Gerät gespeichert – niemals auf Servern.</p>
            </div>
            {[
              { key: 'anthropic' as const, label: '🤖 Anthropic (Claude)', hint: 'Teller-Foto & Kühlschrank-Scan', link: 'https://console.anthropic.com' },
              { key: 'openai'    as const, label: '🧠 OpenAI (GPT-4o)',    hint: 'Backup KI für Chat & Rezepte',  link: 'https://platform.openai.com' },
              { key: 'spoonacular' as const, label: '🍴 Spoonacular',      hint: 'Rezeptdatenbank (optional)',    link: 'https://spoonacular.com/food-api' },
            ].map((item) => (
              <div key={item.key} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-slate-700">{item.label}</p>
                  <a href={item.link} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-500 font-bold flex items-center gap-1">API Key <ExternalLink size={10} /></a>
                </div>
                <input type="password" value={keys[item.key]} onChange={(e) => setKeys({ ...keys, [item.key]: e.target.value })}
                  className="w-full bg-slate-50 rounded-2xl px-4 py-3 text-sm font-mono outline-none" placeholder="sk-…" />
                <p className="text-xs text-slate-400 mt-1">{item.hint}</p>
              </div>
            ))}
            <button onClick={saveKeys} className="w-full py-4 bg-blue-500 rounded-3xl text-white font-black flex items-center justify-center gap-2">
              <Key size={16} />API Keys speichern
            </button>
          </div>
        )}

        {/* ── Whoop ── */}
        {section === 'whoop' && (
          <div className="space-y-3">
            <div className="rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)' }}>
              <div className="p-4">
                <p className="text-white font-black text-base mb-1">⌚ Whoop Daten</p>
                <p className="text-slate-400 text-sm">Öffne die Whoop App und trage deine heutigen Werte ein.</p>
              </div>
            </div>
            <div className="card p-4 grid grid-cols-2 gap-3">
              {[
                { key: 'recovery',     label: 'Recovery (%)',      placeholder: '0–100' },
                { key: 'hrv',          label: 'HRV (ms)',          placeholder: 'z.B. 65' },
                { key: 'restingHR',    label: 'Ruhepuls (bpm)',    placeholder: 'z.B. 52' },
                { key: 'sleepQuality', label: 'Schlafqualität (%)',placeholder: '0–100' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-xs font-bold text-slate-500 mb-1.5 block">{f.label}</label>
                  <input type="number" value={whoopForm[f.key as keyof typeof whoopForm]}
                    onChange={(e) => setWhoopForm({ ...whoopForm, [f.key]: e.target.value })}
                    className="w-full bg-slate-50 rounded-2xl px-3 py-3 text-sm font-medium outline-none" placeholder={f.placeholder} />
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">Strain (0–21)</label>
                <input type="number" step="0.1" value={whoopForm.strain}
                  onChange={(e) => setWhoopForm({ ...whoopForm, strain: e.target.value })}
                  className="w-full bg-slate-50 rounded-2xl px-4 py-3 text-sm font-medium outline-none" placeholder="z.B. 8.5" />
              </div>
            </div>
            {whoopData && (
              <div className="card p-4 grid grid-cols-4 gap-2">
                {[{ l:'Recovery',v:`${whoopData.recovery}%`},{l:'HRV',v:`${whoopData.hrv}ms`},{l:'Schlaf',v:`${whoopData.sleepQuality}%`},{l:'Strain',v:`${whoopData.strain?.toFixed(1)}`}].map((item) => (
                  <div key={item.l} className="bg-slate-50 rounded-2xl py-2.5 text-center">
                    <p className="text-sm font-black text-slate-800">{item.v}</p>
                    <p className="text-[10px] text-slate-400">{item.l}</p>
                  </div>
                ))}
              </div>
            )}
            <button onClick={saveWhoop}
              className="w-full py-4 rounded-3xl text-white font-black flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#0f172a,#334155)' }}>
              ⌚ Whoop-Daten speichern
            </button>
          </div>
        )}

        {/* ── Reminders ── */}
        {section === 'reminders' && (
          <div className="space-y-3">
            <div className="bg-blue-50 rounded-2xl p-4">
              <p className="text-xs font-bold text-blue-700">💡 Erlaube Benachrichtigungen in den iPhone-Einstellungen damit Erinnerungen funktionieren.</p>
            </div>
            <div className="card divide-y divide-slate-50">
              {reminders.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3.5">
                  <span className="text-xl">{i === 0 ? '🌅' : i === 1 ? '☀️' : '🌙'}</span>
                  <div className="flex-1">
                    <input type="time" value={r.time}
                      onChange={(e) => { const u=[...reminders]; u[i]={...r,time:e.target.value}; setReminders(u) }}
                      className="text-sm font-black text-slate-800 bg-transparent outline-none" />
                    <p className="text-xs text-slate-400">{r.label}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={r.enabled}
                      onChange={(e) => { const u=[...reminders]; u[i]={...r,enabled:e.target.checked}; setReminders(u) }}
                      className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-blue-500 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
                  </label>
                </div>
              ))}
            </div>
            <button onClick={() => toast.success('Erinnerungen gespeichert!')}
              className="w-full py-4 bg-blue-500 rounded-3xl text-white font-black flex items-center justify-center gap-2">
              <Bell size={16} />Speichern
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
