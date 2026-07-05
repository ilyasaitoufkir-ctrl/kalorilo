import { useState } from 'react'
import { Save, Key, ExternalLink, Bell, ChevronRight, Unlink, RefreshCw, Loader } from 'lucide-react'
import { useStore } from '../store/useStore'
import { getBMI, getBMICategory } from '../utils/calculations'
import { buildAuthUrl, syncWhoopData, refreshAccessToken } from '../lib/whoop'
import type { UserProfile, Gender, ActivityLevel, Goal } from '../types'
import toast from 'react-hot-toast'
import SupplementChecklist from './SupplementChecklist'

const ACTIVITY_OPTIONS: { value: ActivityLevel; emoji: string; label: string; desc: string }[] = [
  { value:'sedentary',   emoji:'🛋️', label:'Sitzend',      desc:'Bürojob, kaum Bewegung'  },
  { value:'light',       emoji:'🚶', label:'Leicht aktiv', desc:'1–3x Sport/Woche'         },
  { value:'moderate',    emoji:'🏃', label:'Moderat',      desc:'3–5x Sport/Woche'         },
  { value:'active',      emoji:'⚡', label:'Sehr aktiv',   desc:'6–7x Sport/Woche'         },
  { value:'very_active', emoji:'🏋️', label:'Sportler',     desc:'Intensiv täglich'         },
]

const inputStyle = {
  background:'rgba(255,255,255,0.05)',
  border:'1px solid rgba(74,140,92,0.1)',
  borderRadius: 16,
  color:'var(--text-1)',
  padding:'13px 16px',
  width:'100%',
  fontSize:14,
  fontWeight:600,
} as const

export default function Profile() {
  const storeProfile   = useStore((s) => s.profile)
  const setProfile     = useStore((s) => s.setProfile)
  const apiKeys        = useStore((s) => s.apiKeys)
  const setApiKeys     = useStore((s) => s.setApiKeys)
  const reminders      = useStore((s) => s.reminders)
  const setReminders   = useStore((s) => s.setReminders)
  const getDailyCalorieTarget = useStore((s) => s.getDailyCalorieTarget)
  const whoopData      = useStore((s) => s.whoopData)
  const setWhoopData   = useStore((s) => s.setWhoopData)
  const whoopTokens    = useStore((s) => s.whoopTokens)
  const clearWhoopTokens = useStore((s) => s.clearWhoopTokens)
  const setWhoopTokens = useStore((s) => s.setWhoopTokens)
  const darkMode       = useStore((s) => s.darkMode)
  const setDarkMode    = useStore((s) => s.setDarkMode)
  const setActiveTab   = useStore((s) => s.setActiveTab)

  const [section, setSection] = useState<'profile'|'goals'|'supplements'|'apikeys'|'appearance'|'whoop'|'reminders'>('profile')
  const [form, setForm] = useState<Partial<UserProfile>>(storeProfile ?? { name:'',age:25,weight:75,height:175,gender:'male',activityLevel:'moderate',goal:'lose',targetWeight:70,targetWeeks:12 })
  const [keys, setKeys] = useState(apiKeys)
  const [whoopForm, setWhoopForm] = useState({ recovery:'',hrv:'',restingHR:'',sleepQuality:'',strain:'' })
  const [whoopSyncing, setWhoopSyncing] = useState(false)

  const target = getDailyCalorieTarget()
  const bmi    = form.weight && form.height ? getBMI(Number(form.weight), Number(form.height)) : null

  const saveProfile = () => {
    if (!form.name||!form.age||!form.weight||!form.height) { toast.error('Pflichtfelder ausfüllen'); return }
    setProfile(form as UserProfile); toast.success('Gespeichert! ✅')
  }
  const saveKeys = () => { setApiKeys(keys); toast.success('API Keys gespeichert!') }
  const saveWhoopManual = () => {
    setWhoopData({ recovery:parseFloat(whoopForm.recovery)||0, hrv:parseFloat(whoopForm.hrv)||0, restingHR:parseFloat(whoopForm.restingHR)||0, sleepQuality:parseFloat(whoopForm.sleepQuality)||0, strain:parseFloat(whoopForm.strain)||0, date:new Date().toISOString().split('T')[0] })
    toast.success('Whoop-Daten gespeichert!')
  }

  const SECTIONS = [
    { id:'profile' as const,     label:'👤 Profil'       },
    { id:'goals' as const,       label:'🎯 Ziele'        },
    { id:'supplements' as const, label:'💊 Supplements'  },
    { id:'apikeys' as const,     label:'🔑 API Keys'     },
    { id:'appearance' as const,  label:'🌙 Design'       },
    { id:'whoop' as const,       label:'⌚ Whoop'        },
    { id:'reminders' as const,   label:'🔔 Erinnerungen' },
  ]

  return (
    <div className="h-dvh overflow-y-auto overflow-x-hidden pb-nav anim-fade" style={{ background:'var(--bg)' }}>
      {/* Header */}
      <div className="pt-safe px-5 pb-5 relative overflow-hidden" style={{ background:'var(--bg)', borderBottom:'1px solid rgba(125,184,138,0.15)' }}>
        <div className="absolute" style={{ top:-40,right:-40,width:200,height:200,background:'radial-gradient(circle,rgba(74,140,92,0.05),transparent 70%)',pointerEvents:'none' }}/>
        <h1 className="text-2xl font-black relative" style={{ color:'var(--text-1)' }}>
          {storeProfile?.name ? `Hallo, ${storeProfile.name.split(' ')[0]}!` : 'Profil & Einstellungen'}
        </h1>
        {storeProfile && (
          <div className="flex gap-2 mt-2 flex-wrap">
            <span className="glass-sm px-3 py-1 text-sm font-bold" style={{ color:'var(--gold)' }}>{target} kcal/Tag</span>
            {bmi && <span className="glass-sm px-3 py-1 text-sm font-bold" style={{ color:'var(--text-2)' }}>BMI {bmi} · {getBMICategory(bmi)}</span>}
          </div>
        )}
      </div>

      <div className="px-4 pt-4">
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1" style={{ scrollbarWidth:'none' }}>
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={()=>setSection(s.id)}
              className="flex-shrink-0 glass-press rounded-2xl px-4 py-2.5 text-sm font-bold whitespace-nowrap transition-all"
              style={section===s.id
                ? { background:'var(--gold-dim)', border:'1px solid rgba(74,140,92,0.25)', color:'var(--gold)' }
                : { background:'var(--glass)', border:'1px solid var(--glass-border)', color:'var(--text-3)' }
              }>{s.label}</button>
          ))}
        </div>

        {/* Profile */}
        {section==='profile' && (
          <div className="glass p-5 space-y-4">
            <div>
              <p className="label mb-2">Name</p>
              <input value={form.name??''} onChange={(e)=>setForm({...form,name:e.target.value})}
                style={inputStyle} placeholder="Dein Name"/>
            </div>
            <div className="flex gap-3">
              {(['male','female'] as Gender[]).map((g)=>(
                <button key={g} onClick={()=>setForm({...form,gender:g})}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm glass-press transition-all"
                  style={form.gender===g ? { background:'var(--grad-gold)',color:'#fff' } : { background:'var(--glass)',border:'1px solid var(--glass-border)',color:'var(--text-2)' }}>
                  {g==='male'?'♂ Mann':'♀ Frau'}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[{label:'Alter',key:'age'},{label:'Gewicht (kg)',key:'weight'},{label:'Größe (cm)',key:'height'}].map((f)=>(
                <div key={f.key}>
                  <p className="label mb-1.5">{f.label}</p>
                  <input type="number" inputMode="decimal"
                    value={(form as any)[f.key]??''}
                    onChange={(e)=>setForm({...form,[f.key]:parseFloat(e.target.value)})}
                    style={{ ...inputStyle, textAlign:'center' }}/>
                </div>
              ))}
            </div>
            {bmi && (
              <div className="rounded-2xl px-4 py-3 flex justify-between items-center"
                style={{ background:'rgba(74,140,92,0.05)', border:'1px solid rgba(74,140,92,0.1)' }}>
                <span className="font-bold text-sm" style={{ color:'var(--gold)' }}>BMI: {bmi}</span>
                <span className="text-sm" style={{ color:'var(--text-2)' }}>{getBMICategory(bmi)}</span>
              </div>
            )}
            <div>
              <p className="label mb-2">Aktivitätslevel</p>
              <div className="space-y-2">
                {ACTIVITY_OPTIONS.map((a)=>(
                  <button key={a.value} onClick={()=>setForm({...form,activityLevel:a.value})}
                    className="w-full flex items-center gap-3 p-3.5 rounded-2xl glass-press transition-all text-left"
                    style={form.activityLevel===a.value
                      ? { background:'var(--gold-dim)', border:'1px solid rgba(74,140,92,0.25)' }
                      : { background:'var(--glass)', border:'1px solid var(--glass-border)' }
                    }>
                    <span className="text-xl">{a.emoji}</span>
                    <div>
                      <p className="text-sm font-bold" style={{ color:'var(--text-1)' }}>{a.label}</p>
                      <p className="text-xs" style={{ color:'var(--text-3)' }}>{a.desc}</p>
                    </div>
                    {form.activityLevel===a.value && <span className="ml-auto" style={{ color:'var(--gold)' }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={saveProfile} className="btn-gold w-full py-4 flex items-center justify-center gap-2" style={{ minHeight:52 }}>
              <Save size={16}/>Profil speichern
            </button>
          </div>
        )}

        {/* Goals */}
        {section==='goals' && (
          <div className="glass p-5 space-y-4">
            <div>
              <p className="label mb-2">Mein Ziel</p>
              <div className="grid grid-cols-3 gap-2">
                {([['lose','📉','Abnehmen'],['maintain','➡️','Halten'],['gain','📈','Zunehmen']] as [Goal,string,string][]).map(([g,emoji,label])=>(
                  <button key={g} onClick={()=>setForm({...form,goal:g})}
                    className="py-4 rounded-2xl text-center glass-press transition-all"
                    style={form.goal===g
                      ? { background:'var(--gold-dim)', border:'1px solid rgba(74,140,92,0.25)' }
                      : { background:'var(--glass)', border:'1px solid var(--glass-border)' }
                    }>
                    <p className="text-2xl mb-1">{emoji}</p>
                    <p className="text-xs font-bold" style={{ color:'var(--text-1)' }}>{label}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="label mb-1.5">Zielgewicht (kg)</p>
                <input type="number" inputMode="decimal" value={form.targetWeight??''} onChange={(e)=>setForm({...form,targetWeight:parseFloat(e.target.value)})}
                  style={inputStyle} placeholder="70"/>
              </div>
              <div>
                <p className="label mb-1.5">In Wochen</p>
                <input type="number" inputMode="numeric" value={form.targetWeeks??12} onChange={(e)=>setForm({...form,targetWeeks:parseInt(e.target.value)})}
                  style={inputStyle} placeholder="12"/>
              </div>
            </div>
            <div className="rounded-2xl p-4 text-center"
              style={{ background:'var(--gold-dim)', border:'1px solid rgba(74,140,92,0.18)' }}>
              <p className="text-4xl font-black" style={{ color:'var(--gold)' }}>{target}</p>
              <p className="text-sm" style={{ color:'var(--text-2)' }}>kcal Tagesziel</p>
            </div>
            <button onClick={saveProfile} className="btn-gold w-full py-4 flex items-center justify-center gap-2" style={{ minHeight:52 }}>
              <Save size={16}/>Ziele speichern
            </button>
          </div>
        )}

        {/* Supplements */}
        {section==='supplements' && <SupplementChecklist />}

        {/* API Keys */}
        {section==='apikeys' && (
          <div className="space-y-3">
            <div className="glass p-4" style={{ background:'rgba(245,158,11,0.05)', borderColor:'rgba(74,140,92,0.15)' }}>
              <p className="text-xs font-bold" style={{ color:'var(--text-2)' }}>🔒 Keys werden nur lokal auf deinem Gerät gespeichert.</p>
            </div>
            {[
              { key:'anthropic' as const, label:'🤖 Anthropic (Claude)', hint:'Teller-Foto, Kühlschrank, Chat', link:'https://console.anthropic.com' },
              { key:'openai' as const,    label:'🧠 OpenAI (GPT-4o)',    hint:'Backup KI für Chat & Rezepte',  link:'https://platform.openai.com' },
            ].map((item)=>(
              <div key={item.key} className="glass p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black" style={{ color:'var(--text-1)' }}>{item.label}</p>
                  <a href={item.link} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-bold flex items-center gap-1" style={{ color:'var(--gold)' }}>
                    API Key <ExternalLink size={10}/>
                  </a>
                </div>
                <input type="password" value={keys[item.key]} onChange={(e)=>setKeys({...keys,[item.key]:e.target.value})}
                  style={{ ...inputStyle, fontFamily:'monospace' }} placeholder="sk-…"/>
                <p className="text-xs" style={{ color:'var(--text-3)' }}>{item.hint}</p>
              </div>
            ))}
            <button onClick={saveKeys} className="btn-gold w-full py-4 flex items-center justify-center gap-2" style={{ minHeight:52 }}>
              <Key size={16}/>API Keys speichern
            </button>
          </div>
        )}

        {/* Appearance */}
        {section==='appearance' && (
          <div className="glass p-5 space-y-4">
            <p className="label">Dark Mode</p>
            <div className="space-y-2">
              {([
                { id:'dark'  as const, emoji:'🌙', label:'Dunkel',       desc:'Immer dunkler Modus (Standard)' },
                { id:'light' as const, emoji:'☀️', label:'Hell',         desc:'Immer heller Modus'             },
                { id:'auto'  as const, emoji:'⚙️', label:'Automatisch',  desc:'Folgt der iPhone-Einstellung'   },
              ]).map((opt)=>(
                <button key={opt.id} onClick={()=>setDarkMode(opt.id)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl glass-press transition-all text-left"
                  style={darkMode===opt.id
                    ? { background:'var(--gold-dim)', border:'1px solid rgba(74,140,92,0.25)' }
                    : { background:'var(--glass)', border:'1px solid var(--glass-border)' }
                  }>
                  <span className="text-2xl">{opt.emoji}</span>
                  <div>
                    <p className="text-sm font-black" style={{ color:'var(--text-1)' }}>{opt.label}</p>
                    <p className="text-xs" style={{ color:'var(--text-3)' }}>{opt.desc}</p>
                  </div>
                  {darkMode===opt.id && <span className="ml-auto" style={{ color:'var(--gold)' }}>✓</span>}
                </button>
              ))}
            </div>
            {/* Stats & Friends links */}
            <div className="space-y-2 pt-2">
              <p className="label">Weitere Seiten</p>
              {[
                { label:'📊 Statistiken', sub:'Gewicht, Charts, Fotos', action:()=>setActiveTab('stats') },
                { label:'👥 Gruppen & Challenges', sub:'Mit Freunden trainieren', action:()=>setActiveTab('friends') },
              ].map((item)=>(
                <button key={item.label} onClick={item.action}
                  className="w-full glass glass-press p-4 flex items-center gap-3 text-left">
                  <div className="flex-1" style={{ minWidth:0 }}>
                    <p className="text-sm font-black" style={{ color:'var(--text-1)' }}>{item.label}</p>
                    <p className="text-xs" style={{ color:'var(--text-3)' }}>{item.sub}</p>
                  </div>
                  <ChevronRight size={15} style={{ color:'var(--text-3)' }}/>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Whoop */}
        {section==='whoop' && (
          <div className="space-y-3">
            {/* ── OAuth2 Connect ── */}
            <div className="glass p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background:'rgba(74,140,92,0.08)', border:'1px solid #333' }}>⌚</div>
                <div>
                  <p className="font-black" style={{ color:'var(--text-1)' }}>Whoop API Verbindung</p>
                  <p className="text-xs mt-0.5" style={{ color: whoopTokens ? '#10b981' : 'var(--text-3)' }}>
                    {whoopTokens ? '✅ Verbunden – Daten werden automatisch synchronisiert' : 'Nicht verbunden'}
                  </p>
                </div>
              </div>

              {whoopTokens ? (
                <div className="space-y-2">
                  {/* Sync now button */}
                  <button
                    onClick={async () => {
                      if (!keys.whoopClientId || !keys.whoopClientSecret) { toast.error('Client ID/Secret fehlt'); return }
                      setWhoopSyncing(true)
                      try {
                        let tokens = whoopTokens
                        if (tokens.expiresAt - Date.now() < 5 * 60 * 1000) {
                          tokens = await refreshAccessToken(tokens, keys.whoopClientId, keys.whoopClientSecret)
                          setWhoopTokens(tokens)
                        }
                        const data = await syncWhoopData(tokens.accessToken)
                        setWhoopData({ recovery: data.recovery, hrv: data.hrv, restingHR: data.restingHR, sleepQuality: data.sleepQuality, strain: data.strain, date: data.date })
                        toast.success(`Whoop synchronisiert! Recovery: ${data.recovery}%`)
                      } catch (e) { toast.error(e instanceof Error ? e.message : 'Sync-Fehler', { duration: 5000 }) }
                      setWhoopSyncing(false)
                    }}
                    disabled={whoopSyncing}
                    className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 glass-press disabled:opacity-50"
                    style={{ background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.25)', color:'#10b981', minHeight:48 }}>
                    {whoopSyncing ? <><Loader size={15} className="animate-spin"/>Synchronisiert…</> : <><RefreshCw size={15}/>Jetzt synchronisieren</>}
                  </button>

                  {/* Disconnect */}
                  <button onClick={() => { clearWhoopTokens(); toast.success('Whoop getrennt') }}
                    className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 glass-press"
                    style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444', minHeight:48 }}>
                    <Unlink size={15}/>Whoop trennen
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Require Client ID + Secret first */}
                  <div className="rounded-2xl p-3" style={{ background:'rgba(74,140,92,0.06)', border:'1px solid rgba(74,140,92,0.15)' }}>
                    <p className="text-xs font-semibold" style={{ color:'var(--gold)' }}>
                      💡 Trage zuerst Client ID und Secret ein (unten), dann verbinden.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const id = keys.whoopClientId || apiKeys.whoopClientId
                      if (!id) { toast.error('Whoop Client ID fehlt – bitte unten eintragen'); return }
                      const url = buildAuthUrl(id, Math.random().toString(36).slice(2))
                      window.location.href = url
                    }}
                    className="btn-gold w-full py-4 flex items-center justify-center gap-2 text-sm" style={{ minHeight:52 }}>
                    ⌚ Mit Whoop verbinden
                  </button>
                </div>
              )}
            </div>

            {/* ── Whoop Developer Credentials ── */}
            <div className="glass p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="label">Whoop Developer Zugangsdaten</p>
                <a href="https://developer.whoop.com" target="_blank" rel="noopener noreferrer"
                  className="text-xs font-bold flex items-center gap-1" style={{ color:'var(--gold)' }}>
                  Developer Console <ExternalLink size={10}/>
                </a>
              </div>
              {[
                { k:'whoopClientId' as const,     label:'Client ID' },
                { k:'whoopClientSecret' as const, label:'Client Secret' },
              ].map((f) => (
                <div key={f.k}>
                  <p className="label mb-1.5">{f.label}</p>
                  <input
                    type={f.k === 'whoopClientSecret' ? 'password' : 'text'}
                    value={keys[f.k]}
                    onChange={(e) => setKeys({ ...keys, [f.k]: e.target.value })}
                    style={inputStyle} placeholder={f.k === 'whoopClientId' ? 'abc123...' : '••••••••'}
                  />
                </div>
              ))}
              <div className="rounded-2xl p-3" style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(125,184,138,0.15)' }}>
                <p className="text-xs" style={{ color:'var(--text-3)' }}>
                  Redirect URI für Whoop Developer Console:
                </p>
                <p className="text-xs font-mono mt-1" style={{ color:'var(--gold)' }}>
                  https://kalorilo.vercel.app/whoop-callback
                </p>
              </div>
              <button onClick={() => { setApiKeys(keys); toast.success('Gespeichert!') }}
                className="btn-gold w-full py-3 text-sm flex items-center justify-center gap-2" style={{ minHeight:48 }}>
                <Key size={14}/>Zugangsdaten speichern
              </button>
            </div>

            {/* ── Current Whoop Data ── */}
            {whoopData && (
              <div className="glass p-4">
                <p className="label mb-3">Letzte Sync-Daten · {whoopData.date}</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { l:'Recovery', v:`${whoopData.recovery}%`,  c: whoopData.recovery>66?'#10b981':whoopData.recovery>33?'#4a8c5c':'#ef4444' },
                    { l:'HRV',      v:`${whoopData.hrv}ms`,      c:'#60a5fa' },
                    { l:'Schlaf',   v:`${whoopData.sleepQuality}%`, c:'#a78bfa' },
                    { l:'Strain',   v:`${Number(whoopData.strain).toFixed(1)}`, c:'#fb923c' },
                  ].map((item) => (
                    <div key={item.l} className="rounded-2xl py-3 text-center" style={{ background:'#0a0a0a', border:'1px solid rgba(125,184,138,0.15)' }}>
                      <p className="text-sm font-black" style={{ color:item.c }}>{item.v}</p>
                      <p className="text-[10px]" style={{ color:'var(--text-3)' }}>{item.l}</p>
                    </div>
                  ))}
                </div>
                {whoopData.recovery < 34 && (
                  <div className="mt-3 rounded-2xl px-3 py-2" style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)' }}>
                    <p className="text-xs font-bold" style={{ color:'#ef4444' }}>
                      ⚠️ Niedrige Recovery – Kalorienziel automatisch um 200 kcal reduziert
                    </p>
                  </div>
                )}
                {whoopData.recovery > 66 && (
                  <div className="mt-3 rounded-2xl px-3 py-2" style={{ background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.2)' }}>
                    <p className="text-xs font-bold" style={{ color:'#10b981' }}>
                      💪 Hohe Recovery – Kalorienziel um 150 kcal erhöht
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Fallback: Manual Entry ── */}
            <details className="glass p-4">
              <summary className="text-sm font-bold cursor-pointer" style={{ color:'var(--text-2)' }}>
                ✏️ Manuell eingeben (ohne API)
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {[
                  { key:'recovery',     label:'Recovery (%)',    placeholder:'0–100' },
                  { key:'hrv',          label:'HRV (ms)',        placeholder:'65' },
                  { key:'restingHR',    label:'Ruhepuls (bpm)',  placeholder:'52' },
                  { key:'sleepQuality', label:'Schlaf (%)',      placeholder:'0–100' },
                ].map((f) => (
                  <div key={f.key}>
                    <p className="label mb-1.5">{f.label}</p>
                    <input type="number" inputMode="decimal"
                      value={whoopForm[f.key as keyof typeof whoopForm]}
                      onChange={(e) => setWhoopForm({ ...whoopForm, [f.key]: e.target.value })}
                      style={inputStyle} placeholder={f.placeholder}/>
                  </div>
                ))}
                <div className="col-span-2">
                  <p className="label mb-1.5">Strain (0–21)</p>
                  <input type="number" inputMode="decimal" step="0.1" value={whoopForm.strain}
                    onChange={(e) => setWhoopForm({ ...whoopForm, strain: e.target.value })}
                    style={inputStyle} placeholder="8.5"/>
                </div>
              </div>
              <button onClick={saveWhoopManual}
                className="btn-gold w-full mt-3 py-3 text-sm" style={{ minHeight:48 }}>
                Speichern
              </button>
            </details>
          </div>
        )}

        {/* Reminders */}
        {section==='reminders' && (
          <div className="space-y-3">
            <div className="glass p-4" style={{ background:'rgba(59,130,246,0.06)', borderColor:'rgba(59,130,246,0.15)' }}>
              <p className="text-xs font-bold" style={{ color:'var(--text-2)' }}>💡 Benachrichtigungen in Safari erlauben für funktionierende Erinnerungen.</p>
            </div>
            <div className="glass divide-y" style={{ borderColor:'transparent' }}>
              {reminders.map((r,i)=>(
                <div key={r.id} className="flex items-center gap-3 px-4 py-4" style={{ borderTop: i>0?'1px solid var(--glass-border)':'none' }}>
                  <span className="text-xl flex-shrink-0">{i===0?'🌅':i===1?'☀️':'🌙'}</span>
                  <div className="flex-1" style={{ minWidth:0 }}>
                    <input type="time" value={r.time}
                      onChange={(e)=>{ const u=[...reminders]; u[i]={...r,time:e.target.value}; setReminders(u) }}
                      className="text-sm font-black bg-transparent outline-none border-none w-full" style={{ color:'var(--text-1)' }}/>
                    <p className="text-xs" style={{ color:'var(--text-3)' }}>{r.label}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input type="checkbox" checked={r.enabled}
                      onChange={(e)=>{ const u=[...reminders]; u[i]={...r,enabled:e.target.checked}; setReminders(u) }}
                      className="sr-only peer"/>
                    <div className="w-11 h-6 rounded-full peer transition-all"
                      style={{ background:r.enabled?'var(--grad-gold)':'rgba(74,140,92,0.1)', position:'relative' }}>
                      <div style={{ position:'absolute', top:2, left: r.enabled ? 22 : 2, width:20, height:20, background:'#fff', borderRadius:'50%', transition:'left 0.2s ease' }}/>
                    </div>
                  </label>
                </div>
              ))}
            </div>
            <button onClick={()=>toast.success('Erinnerungen gespeichert!')}
              className="btn-gold w-full py-4 flex items-center justify-center gap-2" style={{ minHeight:52 }}>
              <Bell size={16}/>Speichern
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
