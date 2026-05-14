import { useState, useRef, useEffect, useMemo } from 'react'
import { Send, Loader, RefreshCw, Calendar, ShoppingBag, Refrigerator } from 'lucide-react'
import { useStore } from '../store/useStore'
import { askNutritionAdvisor, generateWeeklyPlan } from '../utils/api'
import { formatDate } from '../utils/calculations'
import type { AIMessage } from '../types'
import toast from 'react-hot-toast'

const today = formatDate()

const QUICK_PROMPTS = [
  'Ich habe noch 300 Kalorien – was kann ich essen?',
  'Was sind gute Snacks für Abnehmen?',
  'Wie viel Protein brauche ich täglich?',
  'Was essen nach dem Sport?',
  'Rezept für eine kalorienarme Mahlzeit',
  'Tipps gegen Heißhunger',
]

export default function AIAdvisor() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [weeklyPlan, setWeeklyPlan] = useState('')
  const [activeTab, setActiveTab] = useState<'chat' | 'plan' | 'fridge'>('chat')
  const [planLoading, setPlanLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messages = useStore((s) => s.aiMessages)
  const addMessage = useStore((s) => s.addAIMessage)
  const clearMessages = useStore((s) => s.clearAIMessages)
  const apiKeys = useStore((s) => s.apiKeys)
  const profile = useStore((s) => s.profile)
  const allFoodLogs = useStore((s) => s.foodLogs)

  // Compute stats locally – never call store methods inside useStore selectors
  const todayCalories = useMemo(() =>
    allFoodLogs.filter((l) => l.date === today).reduce((s, f) => s + (f.macros?.calories ?? 0), 0),
    [allFoodLogs])
  const todayProtein = useMemo(() =>
    allFoodLogs.filter((l) => l.date === today).reduce((s, f) => s + (f.macros?.protein ?? 0), 0),
    [allFoodLogs])
  const target = useMemo(() => {
    if (!profile) return 2000
    const { age, weight, height, gender, activityLevel, goal, targetWeight, targetWeeks } = profile
    const w = Number(weight) || 75; const h = Number(height) || 175; const a = Number(age) || 25
    const bmr = gender === 'male' ? 10*w + 6.25*h - 5*a + 5 : 10*w + 6.25*h - 5*a - 161
    const m: Record<string, number> = { sedentary:1.2, light:1.375, moderate:1.55, active:1.725, very_active:1.9 }
    const tdee = bmr * (m[activityLevel] ?? 1.55)
    const weeks = Number(targetWeeks) || 12
    const delta = (w - (Number(targetWeight) || w)) * 7700 / weeks
    if (goal === 'lose') return Math.max(1200, Math.round(tdee - delta / 7))
    if (goal === 'gain') return Math.round(tdee + Math.abs(delta) / 7)
    return Math.round(tdee)
  }, [profile])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const context = `Nutzer: ${profile?.name ?? 'Unbekannt'}, Ziel: ${profile?.goal === 'lose' ? 'Abnehmen' : profile?.goal === 'gain' ? 'Zunehmen' : 'Halten'}, Kalorienziel: ${target} kcal, Heute gegessen: ${Math.round(todayCalories)} kcal, Noch verfügbar: ${Math.round(target - todayCalories)} kcal, Eiweiß heute: ${Math.round(todayProtein)}g`

  const sendMessage = async (text?: string) => {
    const msg = text ?? input.trim()
    if (!msg) return
    if (!apiKeys.anthropic && !apiKeys.openai) {
      toast.error('API Key fehlt – bitte unter Profil eintragen')
      return
    }
    const userMsg: AIMessage = { role: 'user', content: msg, timestamp: Date.now() }
    addMessage(userMsg)
    setInput('')
    setLoading(true)
    try {
      const key = apiKeys.anthropic || apiKeys.openai
      const response = await askNutritionAdvisor(msg, context, key)
      addMessage({ role: 'assistant', content: response, timestamp: Date.now() })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
      console.error('[AIAdvisor]', e)
      addMessage({ role: 'assistant', content: `❌ Fehler: ${msg}`, timestamp: Date.now() })
      toast.error(msg, { duration: 5000 })
    }
    setLoading(false)
  }

  const generatePlan = async () => {
    if (!apiKeys.anthropic && !apiKeys.openai) { toast.error('API Key fehlt'); return }
    setPlanLoading(true)
    const ctx = `Erstelle einen Ernährungsplan für: ${profile?.name ?? 'Nutzer'}, Ziel: ${profile?.goal === 'lose' ? 'Abnehmen' : profile?.goal === 'gain' ? 'Muskelaufbau' : 'Gewicht halten'}, Kalorienziel: ${target} kcal/Tag, Alter: ${profile?.age ?? 25}, Gewicht: ${profile?.weight ?? 75}kg`
    try {
      const key = apiKeys.anthropic || apiKeys.openai
      const plan = await generateWeeklyPlan(ctx, key)
      setWeeklyPlan(plan)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
      console.error('[WeeklyPlan]', e)
      toast.error(msg, { duration: 5000 })
    }
    setPlanLoading(false)
  }

  return (
    <div className="flex flex-col h-screen pb-16 animate-fade-in">
      {/* Header */}
      <div className="gradient-purple px-4 pt-12 pb-4 safe-top">
        <h1 className="text-white text-2xl font-bold">🤖 KI-Berater</h1>
        <p className="text-purple-100 text-sm mt-1">Dein persönlicher Ernährungsassistent</p>
        <div className="flex gap-1 mt-3 bg-white/10 rounded-2xl p-1">
          {(['chat', 'plan', 'fridge'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition ${activeTab === t ? 'bg-white text-purple-600' : 'text-white/70'}`}
            >
              {{ chat: '💬 Chat', plan: '📅 Wochenplan', fridge: '🧊 Kühlschrank' }[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div>
                <div className="text-center py-4 text-gray-400 text-sm mb-4">
                  <div className="text-4xl mb-2">🤖</div>
                  Hallo! Ich bin dein KI-Ernährungsberater.<br />Frag mich alles rund ums Essen!
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 mb-2">Schnellauswahl:</p>
                  {QUICK_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => sendMessage(p)}
                      className="w-full text-left text-sm py-2.5 px-4 bg-blue-50 text-blue-700 rounded-2xl active:bg-blue-100 transition"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'gradient-blue text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}
                >
                  {msg.role === 'assistant' && <span className="text-base mr-1">🤖</span>}
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-2">
                  <Loader size={14} className="animate-spin text-gray-400" />
                  <span className="text-sm text-gray-400">KI denkt nach…</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 bg-white border-t border-gray-100">
            {messages.length > 0 && (
              <button onClick={clearMessages} className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                <RefreshCw size={12} /> Chat leeren
              </button>
            )}
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Frage stellen…"
                className="flex-1 px-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-purple-200"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="w-11 h-11 gradient-purple rounded-2xl flex items-center justify-center disabled:opacity-40 transition"
              >
                <Send size={18} className="text-white" />
              </button>
            </div>
            {!apiKeys.anthropic && !apiKeys.openai && (
              <p className="text-xs text-red-400 mt-1">⚠️ API Key fehlt – bitte unter Profil eintragen</p>
            )}
          </div>
        </>
      )}

      {/* Weekly Plan Tab */}
      {activeTab === 'plan' && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="bg-purple-50 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={18} className="text-purple-500" />
              <h3 className="font-semibold text-gray-800">7-Tage-Ernährungsplan</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              KI erstellt dir einen personalisierten Wochenplan basierend auf deinem Ziel ({target} kcal/Tag).
            </p>
            <button
              onClick={generatePlan}
              disabled={planLoading || (!apiKeys.anthropic && !apiKeys.openai)}
              className="w-full py-3 gradient-purple rounded-2xl text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {planLoading ? <><Loader size={16} className="animate-spin" />Erstelle Plan…</> : <><Calendar size={16} />Wochenplan generieren</>}
            </button>
            {!apiKeys.anthropic && !apiKeys.openai && (
              <p className="text-xs text-red-500 mt-2 text-center">⚠️ API Key fehlt</p>
            )}
          </div>
          {weeklyPlan && (
            <div className="card p-4 bg-gray-50">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag size={16} className="text-purple-500" />
                <span className="text-sm font-semibold text-gray-700">Dein Wochenplan</span>
              </div>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{weeklyPlan}</pre>
            </div>
          )}
        </div>
      )}

      {/* Fridge Quick Link */}
      {activeTab === 'fridge' && (
        <div className="flex-1 px-4 py-6">
          <div className="card p-6 text-center">
            <Refrigerator size={48} className="text-blue-400 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-800 mb-2">Kühlschrank-Scan</h3>
            <p className="text-sm text-gray-500 mb-4">
              Fotografiere deinen Kühlschrank und lass die KI Rezepte und Einkaufslisten erstellen.
            </p>
            <p className="text-xs text-gray-400">→ Tippe auf den Kühlschrank-Tab in der Navigation</p>
          </div>
          <div className="mt-4 space-y-2">
            {QUICK_PROMPTS.slice(0, 3).map((p) => (
              <button
                key={p}
                onClick={() => { setActiveTab('chat'); sendMessage(p) }}
                className="w-full text-left text-sm py-2.5 px-4 bg-purple-50 text-purple-700 rounded-2xl"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
