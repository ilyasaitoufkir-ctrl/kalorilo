import { useState, useRef, useEffect, useMemo } from 'react'
import { Send, Loader, RefreshCw, Refrigerator, Sparkles } from 'lucide-react'
import { useStore } from '../store/useStore'
import { askNutritionAdvisor, generateWeeklyPlan, analyzeFridge, getRecipesFromIngredients, getShoppingList } from '../utils/api'
import { formatDate, imageToBase64 } from '../utils/calculations'
import type { AIMessage } from '../types'
import toast from 'react-hot-toast'

const today = formatDate()

const QUICK_PROMPTS = [
  { label: '💡 300 Kalorien übrig', text: 'Ich habe noch 300 Kalorien – was kann ich essen?' },
  { label: '🥗 Snack-Ideen', text: 'Was sind gute, kalorienarme Snacks für Abnehmen?' },
  { label: '💪 Protein-Bedarf', text: 'Wie viel Protein brauche ich täglich für Muskelaufbau?' },
  { label: '🏃 Nach dem Sport', text: 'Was sollte ich nach dem Training essen?' },
  { label: '🌙 Abendessen-Idee', text: 'Schlage mir ein gesundes, schnelles Abendessen vor.' },
  { label: '🔥 Heißhunger stoppen', text: 'Ich habe Heißhunger auf Süßes – was hilft dagegen?' },
]

export default function AIAdvisor() {
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [activeTab, setActiveTab] = useState<'chat'|'plan'|'fridge'>('chat')
  const [weeklyPlan, setWeeklyPlan] = useState('')
  const [planLoading, setPlanLoading] = useState(false)
  // Fridge
  const [fridgeStep, setFridgeStep] = useState<'scan'|'choose'|'result'>('scan')
  const [fridgeIngredients, setFridgeIngredients] = useState<string[]>([])
  const [fridgeResult, setFridgeResult] = useState('')
  const [fridgeType, setFridgeType] = useState<'recipe'|'shopping'|null>(null)
  const [fridgeLoading, setFridgeLoading] = useState(false)
  const [fridgePreview, setFridgePreview] = useState<string|null>(null)
  const fileRef    = useRef<HTMLInputElement>(null)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)
  const messages   = useStore((s) => s.aiMessages)
  const addMessage = useStore((s) => s.addAIMessage)
  const clearMsgs  = useStore((s) => s.clearAIMessages)
  const apiKeys    = useStore((s) => s.apiKeys)
  const profile    = useStore((s) => s.profile)
  const allFoodLogs= useStore((s) => s.foodLogs)

  const todayCals = useMemo(() => allFoodLogs.filter((l) => l.date === today).reduce((s, f) => s + (f.macros?.calories ?? 0), 0), [allFoodLogs])
  const target = useMemo(() => {
    if (!profile) return 2000
    const w = Number(profile.weight)||75, h = Number(profile.height)||175, a = Number(profile.age)||25
    const bmr = profile.gender === 'male' ? 10*w+6.25*h-5*a+5 : 10*w+6.25*h-5*a-161
    const m: Record<string,number> = { sedentary:1.2,light:1.375,moderate:1.55,active:1.725,very_active:1.9 }
    return Math.round(bmr * (m[profile.activityLevel]??1.55))
  }, [profile])

  const context = `Name: ${profile?.name??'?'}, Ziel: ${profile?.goal==='lose'?'Abnehmen':profile?.goal==='gain'?'Zunehmen':'Halten'}, Kalorienziel: ${target} kcal, Heute gegessen: ${Math.round(todayCals)} kcal, Noch verfügbar: ${Math.round(target-todayCals)} kcal`
  const apiKey = apiKeys.anthropic || apiKeys.openai

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg) return
    if (!apiKey) { toast.error('API Key fehlt → Profil → API Keys'); return }
    const userMsg: AIMessage = { role: 'user', content: msg, timestamp: Date.now() }
    addMessage(userMsg)
    setInput('')
    setLoading(true)
    try {
      const reply = await askNutritionAdvisor(msg, context, apiKey)
      addMessage({ role: 'assistant', content: reply, timestamp: Date.now() })
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Fehler'
      console.error('[AI]', e)
      addMessage({ role: 'assistant', content: `❌ ${err}`, timestamp: Date.now() })
      toast.error(err, { duration: 5000 })
    }
    setLoading(false)
  }

  const genPlan = async () => {
    if (!apiKey) { toast.error('API Key fehlt'); return }
    setPlanLoading(true)
    try {
      const ctx = `${profile?.name??'Nutzer'}, Ziel: ${profile?.goal==='lose'?'Abnehmen':profile?.goal==='gain'?'Muskelaufbau':'Halten'}, ${target} kcal/Tag, ${profile?.age??25} Jahre, ${profile?.weight??75} kg`
      const plan = await generateWeeklyPlan(ctx, apiKey)
      setWeeklyPlan(plan)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Fehler', { duration: 5000 }) }
    setPlanLoading(false)
  }

  const handleFridgePhoto = async (file: File) => {
    if (!apiKey) { toast.error('API Key fehlt'); return }
    setFridgeLoading(true)
    setFridgePreview(URL.createObjectURL(file))
    try {
      const b64 = await imageToBase64(file)
      const res = await analyzeFridge(b64, apiKey)
      setFridgeIngredients(res.ingredients)
      setFridgeStep('choose')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Fehler', { duration: 5000 }) }
    setFridgeLoading(false)
  }

  const handleFridgeAction = async (type: 'recipe'|'shopping') => {
    if (!apiKey) return
    setFridgeLoading(true); setFridgeType(type)
    const goal = profile?.goal==='lose'?'Abnehmen':profile?.goal==='gain'?'Muskelaufbau':'Fitness'
    try {
      const text = type === 'recipe'
        ? await getRecipesFromIngredients(fridgeIngredients, goal, apiKey)
        : await getShoppingList(fridgeIngredients, goal, apiKey)
      setFridgeResult(text); setFridgeStep('result')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Fehler', { duration: 5000 }) }
    setFridgeLoading(false)
  }

  const TABS = [{ id: 'chat' as const, icon: '💬', label: 'Chat' }, { id: 'plan' as const, icon: '📅', label: 'Wochenplan' }, { id: 'fridge' as const, icon: '🧊', label: 'Kühlschrank' }]

  return (
    <div className="flex flex-col h-dvh pb-[calc(72px+max(env(safe-area-inset-bottom),8px))] anim-fade">
      {/* Header */}
      <div className="grad-purple px-5 pt-safe pb-4 flex-shrink-0">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
        <h1 className="text-white text-2xl font-black mb-3">🤖 KI-Berater</h1>
        <div className="flex gap-1 bg-white/10 rounded-2xl p-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${activeTab === t.id ? 'bg-white text-purple-600' : 'text-white/70'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chat ── */}
      {activeTab === 'chat' && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div>
                <div className="text-center py-4 mb-4">
                  <p className="text-4xl mb-2">🤖</p>
                  <p className="text-sm font-bold text-slate-700">Hallo {profile?.name?.split(' ')[0] ?? ''}!</p>
                  <p className="text-xs text-slate-400 mt-0.5">Ich bin dein persönlicher Ernährungsberater</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((p) => (
                    <button key={p.text} onClick={() => send(p.text)}
                      className="bg-white rounded-2xl px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm active:bg-slate-50 transition">
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && <div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center text-sm mr-2 mt-1 flex-shrink-0">🤖</div>}
                <div className={`max-w-[82%] px-4 py-3 text-sm leading-relaxed ${msg.role === 'user' ? 'bubble-user' : 'bubble-ai'}`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start items-center gap-2">
                <div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center text-sm flex-shrink-0">🤖</div>
                <div className="bubble-ai px-4 py-3 flex items-center gap-2">
                  <Loader size={14} className="animate-spin text-slate-400" />
                  <span className="text-sm text-slate-400">Denkt nach…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          {/* Input */}
          <div className="flex-shrink-0 px-4 py-3 bg-white border-t border-slate-100">
            {messages.length > 0 && (
              <button onClick={clearMsgs} className="text-xs text-slate-400 flex items-center gap-1 mb-2">
                <RefreshCw size={11} />Chat leeren
              </button>
            )}
            <div className="flex items-center gap-2">
              <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Frage stellen…"
                className="flex-1 bg-slate-100 rounded-2xl px-4 py-3 text-sm font-medium outline-none" />
              <button onClick={() => send()} disabled={!input.trim() || loading}
                className="w-11 h-11 bg-purple-500 rounded-2xl flex items-center justify-center disabled:opacity-40 transition active:bg-purple-600">
                <Send size={16} className="text-white" />
              </button>
            </div>
            {!apiKey && <p className="text-xs text-red-400 mt-1.5">⚠️ Kein API Key → Profil → API Keys</p>}
          </div>
        </>
      )}

      {/* ── Wochenplan ── */}
      {activeTab === 'plan' && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-2xl">📅</div>
              <div>
                <p className="font-black text-slate-900">7-Tage-Ernährungsplan</p>
                <p className="text-xs text-slate-400">{target} kcal/Tag · {profile?.goal==='lose'?'Abnehmen':profile?.goal==='gain'?'Muskelaufbau':'Halten'}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4">KI erstellt dir einen personalisierten Wochenplan mit Frühstück, Mittagessen, Abendessen, Snacks und Einkaufsliste.</p>
            <button onClick={genPlan} disabled={planLoading || !apiKey}
              className="w-full py-4 bg-purple-500 rounded-2xl text-white font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {planLoading ? <><Loader size={16} className="animate-spin" />Erstelle Plan…</> : <><Sparkles size={16} />Wochenplan generieren</>}
            </button>
            {!apiKey && <p className="text-xs text-red-400 mt-2 text-center">⚠️ API Key fehlt</p>}
          </div>
          {weeklyPlan && (
            <div className="card p-4">
              <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{weeklyPlan}</pre>
            </div>
          )}
        </div>
      )}

      {/* ── Kühlschrank ── */}
      {activeTab === 'fridge' && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {fridgeStep === 'scan' && (
            <>
              <div className="card p-4 bg-blue-50">
                <p className="text-sm font-bold text-blue-800 mb-2">🧊 So funktioniert's:</p>
                <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                  <li>Foto vom geöffneten Kühlschrank</li>
                  <li>KI erkennt alle Produkte automatisch</li>
                  <li>Rezept oder Einkaufsliste generieren</li>
                </ol>
              </div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFridgePhoto(e.target.files[0])} />
              <button onClick={() => fileRef.current?.click()} disabled={fridgeLoading}
                className="w-full py-8 border-2 border-dashed border-blue-200 rounded-3xl flex flex-col items-center gap-3 text-blue-500 font-bold disabled:opacity-50 bg-blue-50/50">
                {fridgeLoading
                  ? <><Loader size={32} className="animate-spin" /><span>KI analysiert…</span></>
                  : <><Refrigerator size={40} /><span className="text-base">Kühlschrank fotografieren</span><span className="text-xs font-normal text-slate-400">Tippe hier</span></>}
              </button>
              {!apiKey && <p className="text-xs text-red-400 text-center">⚠️ API Key fehlt → Profil → API Keys</p>}
            </>
          )}

          {fridgeStep === 'choose' && (
            <>
              {fridgePreview && <img src={fridgePreview} alt="" className="w-full h-40 object-cover rounded-2xl" />}
              <div className="card p-4">
                <p className="text-sm font-bold text-slate-700 mb-2">🔍 Erkannte Zutaten ({fridgeIngredients.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {fridgeIngredients.map((ing, i) => (
                    <span key={i} className="bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-full font-medium">{ing}</span>
                  ))}
                </div>
              </div>
              <p className="text-sm font-bold text-slate-600 text-center">Was möchtest du tun?</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleFridgeAction('recipe')} disabled={fridgeLoading}
                  className="card card-press p-5 text-center disabled:opacity-50">
                  <p className="text-3xl mb-2">🍳</p>
                  <p className="font-bold text-slate-800 text-sm">Rezept vorschlagen</p>
                  <p className="text-xs text-slate-400 mt-1">Aus deinen Zutaten</p>
                </button>
                <button onClick={() => handleFridgeAction('shopping')} disabled={fridgeLoading}
                  className="card card-press p-5 text-center disabled:opacity-50">
                  <p className="text-3xl mb-2">🛒</p>
                  <p className="font-bold text-slate-800 text-sm">Einkaufsliste</p>
                  <p className="text-xs text-slate-400 mt-1">Was fehlt noch?</p>
                </button>
              </div>
              {fridgeLoading && <p className="text-center text-sm text-slate-400 flex items-center justify-center gap-2"><Loader size={14} className="animate-spin" />KI denkt nach…</p>}
              <button onClick={() => { setFridgeStep('scan'); setFridgePreview(null); setFridgeIngredients([]) }}
                className="w-full text-sm text-slate-400 py-2">Neu starten</button>
            </>
          )}

          {fridgeStep === 'result' && (
            <>
              <div className="card p-4">
                <p className="text-sm font-bold text-slate-700 mb-3">
                  {fridgeType === 'recipe' ? '🍳 Rezeptvorschläge' : '🛒 Einkaufsliste'}
                </p>
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{fridgeResult}</pre>
              </div>
              <button onClick={() => { setFridgeStep('scan'); setFridgePreview(null); setFridgeIngredients([]); setFridgeResult('') }}
                className="w-full py-4 bg-blue-500 rounded-3xl text-white font-black text-sm">Neuer Scan</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
