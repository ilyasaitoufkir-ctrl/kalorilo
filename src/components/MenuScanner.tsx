import { useState, useRef } from 'react'
import { X, Camera, Loader, ChevronDown, ChevronUp, Plus, Check } from 'lucide-react'
import { useStore } from '../store/useStore'
import { analyzeMenuPhoto, type MenuDish, type MenuDishRating } from '../utils/api'
import { imageToBase64, formatDate, uid } from '../utils/calculations'
import type { MealType } from '../types'
import toast from 'react-hot-toast'

const today = formatDate()

const MEALS: { id: MealType; label: string; emoji: string }[] = [
  { id: 'breakfast', label: 'Frühstück',   emoji: '🌅' },
  { id: 'lunch',     label: 'Mittagessen', emoji: '☀️' },
  { id: 'dinner',    label: 'Abendessen',  emoji: '🌙' },
  { id: 'snack',     label: 'Snack',       emoji: '🍎' },
]

const RATING_CONFIG: Record<MenuDishRating, { icon: string; color: string; bg: string; border: string; label: string }> = {
  good: { icon: '✅', color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.25)',  label: 'Empfohlen' },
  ok:   { icon: '⚠️', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)',  label: 'OK' },
  bad:  { icon: '❌', color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)',   label: 'Nicht ideal' },
}

interface EditableDish extends MenuDish {
  editCal: string
  editProt: string
  editFat: string
  editCarbs: string
  expanded: boolean
  added: boolean
}

interface Props {
  onClose: () => void
  remainingCalories: number
  remainingProtein: number
  calorieTarget: number
  defaultMealType?: MealType
}

export default function MenuScanner({ onClose, remainingCalories, remainingProtein, calorieTarget, defaultMealType = 'lunch' }: Props) {
  const [step, setStep]             = useState<'scan' | 'loading' | 'results'>('scan')
  const [dishes, setDishes]         = useState<EditableDish[]>([])
  const [summary, setSummary]       = useState('')
  const [preview, setPreview]       = useState<string | null>(null)
  const [mealType, setMealType]     = useState<MealType>(defaultMealType)
  const [errorMsg, setErrorMsg]     = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const addFoodLog = useStore((s) => s.addFoodLog)
  const apiKeys    = useStore((s) => s.apiKeys)
  const apiKey     = apiKeys.anthropic || apiKeys.openai

  const handlePhoto = async (file: File) => {
    if (!apiKey) { setErrorMsg('API Key fehlt → Profil → API Keys'); return }
    setErrorMsg('')
    setPreview(URL.createObjectURL(file))
    setStep('loading')
    try {
      const b64    = await imageToBase64(file)
      const result = await analyzeMenuPhoto(b64, remainingCalories, remainingProtein, calorieTarget, apiKey)
      if (result.dishes.length === 0) {
        setErrorMsg('Keine Gerichte erkannt. Bitte nochmal mit besserem Licht fotografieren.')
        setStep('scan')
        return
      }
      setDishes(result.dishes.map((d) => ({
        ...d,
        editCal:   String(d.calories),
        editProt:  String(d.protein),
        editFat:   String(d.fat),
        editCarbs: String(d.carbs),
        expanded:  false,
        added:     false,
      })))
      setSummary(result.summary)
      setStep('results')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Analysefehler. Bitte erneut versuchen.')
      setStep('scan')
    }
  }

  const toggle = (i: number) =>
    setDishes((prev) => prev.map((d, idx) => idx === i ? { ...d, expanded: !d.expanded } : d))

  const addDish = (i: number) => {
    const d = dishes[i]
    if (d.added) return
    const cals  = Number(d.editCal)  || d.calories
    const prot  = Number(d.editProt) || d.protein
    const fat   = Number(d.editFat)  || d.fat
    const carbs = Number(d.editCarbs) || d.carbs
    addFoodLog({
      id: uid(), date: today, mealType,
      foodItem: { id: uid(), name: d.name, category: '🍽️ Restaurant', macros: { calories: cals, protein: prot, fat, carbs } },
      amount: 1, macros: { calories: cals, protein: prot, fat, carbs },
      timestamp: Date.now(), aiEstimated: true,
    })
    setDishes((prev) => prev.map((dish, idx) => idx === i ? { ...dish, added: true } : dish))
    toast.success(`${d.name} hinzugefügt!`)
  }

  return (
    <div className="fixed inset-0 z-[110] flex flex-col" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 pt-safe" style={{ background: '#000', borderBottom: '1px solid #1a1a1a' }}>
          <div>
            <h2 className="text-lg font-black" style={{ color: '#fff' }}>📸 Menü scannen</h2>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>KI liest die Speisekarte & empfiehlt</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-2xl flex items-center justify-center glass-press"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <X size={18} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3 pb-8">

          {/* ── Step: Scan ── */}
          {step === 'scan' && (
            <>
              {/* Remaining budget */}
              <div className="glass p-4">
                <p className="label mb-2">Dein Restbedarf heute</p>
                <div className="flex gap-3">
                  <div className="flex-1 text-center rounded-2xl py-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <p className="text-xl font-black" style={{ color: '#f59e0b' }}>{Math.max(0, remainingCalories)}</p>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>kcal übrig</p>
                  </div>
                  <div className="flex-1 text-center rounded-2xl py-3" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
                    <p className="text-xl font-black" style={{ color: '#3b82f6' }}>{Math.max(0, remainingProtein)}g</p>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>Eiweiß übrig</p>
                  </div>
                </div>
              </div>

              {/* How it works */}
              <div className="glass p-4" style={{ background: 'rgba(139,92,246,0.06)', borderColor: 'rgba(139,92,246,0.2)' }}>
                <p className="text-sm font-bold mb-2" style={{ color: '#fff' }}>🤖 So funktioniert's</p>
                <ol className="space-y-1 text-sm" style={{ color: 'var(--text-2)' }}>
                  <li>1. Foto von der Speisekarte machen</li>
                  <li>2. KI liest alle Gerichte automatisch aus</li>
                  <li>3. Kalorien & Eiweiß werden geschätzt</li>
                  <li>4. ✅ Beste Wahl wird empfohlen</li>
                </ol>
              </div>

              {errorMsg && (
                <div className="rounded-2xl px-4 py-3 text-sm font-semibold"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
                  {errorMsg}
                </div>
              )}

              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])} />

              <button onClick={() => fileRef.current?.click()} disabled={!apiKey}
                className="w-full flex flex-col items-center justify-center gap-3 rounded-3xl glass-press disabled:opacity-40"
                style={{ minHeight: 160, border: '2px dashed rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.04)' }}>
                <Camera size={44} style={{ color: '#f59e0b' }} />
                <span className="font-black text-base" style={{ color: '#fff' }}>Speisekarte fotografieren</span>
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>oder aus Galerie wählen</span>
              </button>

              {!apiKey && (
                <p className="text-center text-xs" style={{ color: '#ef4444' }}>⚠️ API Key fehlt → Profil → API Keys</p>
              )}
            </>
          )}

          {/* ── Step: Loading ── */}
          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-5">
              {preview && (
                <img src={preview} alt="" className="w-full max-h-48 object-cover rounded-2xl mb-2"
                  style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
              )}
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
                style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <Loader size={28} className="animate-spin" style={{ color: '#f59e0b' }} />
              </div>
              <div className="text-center">
                <p className="font-black text-base" style={{ color: '#fff' }}>KI liest die Karte…</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Erkennt Gerichte · Schätzt Kalorien · Bewertet Optionen</p>
              </div>
            </div>
          )}

          {/* ── Step: Results ── */}
          {step === 'results' && (
            <>
              {/* Preview thumbnail */}
              {preview && (
                <img src={preview} alt="" className="w-full h-32 object-cover rounded-2xl"
                  style={{ border: '1px solid rgba(255,255,255,0.08)' }} />
              )}

              {/* Summary */}
              {summary && (
                <div className="glass p-4">
                  <p className="text-sm" style={{ color: 'var(--text-2)' }}>🤖 {summary}</p>
                </div>
              )}

              {/* Meal type selector */}
              <div className="glass p-4">
                <p className="label mb-2">Zu welcher Mahlzeit hinzufügen?</p>
                <div className="flex gap-2">
                  {MEALS.map((m) => (
                    <button key={m.id} onClick={() => setMealType(m.id)}
                      className="flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all glass-press"
                      style={mealType === m.id
                        ? { background: 'var(--grad-gold)', color: '#000' }
                        : { background: 'rgba(255,255,255,0.04)', color: 'var(--text-3)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      {m.emoji}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-center mt-1.5" style={{ color: 'var(--text-3)' }}>
                  {MEALS.find((m) => m.id === mealType)?.label}
                </p>
              </div>

              {/* Disclaimer */}
              <div className="rounded-2xl px-4 py-2.5 flex items-start gap-2"
                style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <span className="text-base flex-shrink-0">⚠️</span>
                <p className="text-xs" style={{ color: 'var(--text-2)' }}>
                  <strong style={{ color: '#f59e0b' }}>KI-Schätzung</strong> — Werte können abweichen. Tippe auf ein Gericht um Werte vor dem Speichern anzupassen.
                </p>
              </div>

              {/* Dishes */}
              <div className="space-y-2">
                {dishes.map((d, i) => {
                  const cfg = RATING_CONFIG[d.rating]
                  return (
                    <div key={i} className="glass overflow-hidden" style={{ background: cfg.bg, borderColor: cfg.border }}>
                      {/* Dish header row */}
                      <div className="flex items-center gap-3 p-4">
                        <span className="text-xl flex-shrink-0">{cfg.icon}</span>
                        <div className="flex-1" style={{ minWidth: 0 }}>
                          <p className="text-sm font-black truncate" style={{ color: '#fff' }}>{d.name}</p>
                          <p className="text-xs" style={{ color: cfg.color }}>{cfg.label}</p>
                        </div>
                        <div className="text-right flex-shrink-0 mr-1">
                          <p className="text-sm font-black" style={{ color: cfg.color }}>{d.editCal || d.calories} kcal</p>
                          <p className="text-xs" style={{ color: 'var(--text-3)' }}>{d.editProt || d.protein}g E</p>
                        </div>
                        {/* Add / Added button */}
                        {d.added ? (
                          <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                            <Check size={16} style={{ color: '#10b981' }} />
                          </div>
                        ) : (
                          <button onClick={() => addDish(i)}
                            className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 glass-press"
                            style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                            <Plus size={16} style={{ color: cfg.color }} />
                          </button>
                        )}
                        {/* Expand toggle */}
                        <button onClick={() => toggle(i)} className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                          {d.expanded
                            ? <ChevronUp size={15} style={{ color: 'var(--text-3)' }} />
                            : <ChevronDown size={15} style={{ color: 'var(--text-3)' }} />}
                        </button>
                      </div>

                      {/* Expanded: reason + editable macros */}
                      {d.expanded && (
                        <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          {d.reason && (
                            <p className="text-xs pt-3 leading-relaxed" style={{ color: 'var(--text-2)' }}>🤖 {d.reason}</p>
                          )}
                          <p className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>Werte anpassen:</p>
                          <div className="grid grid-cols-4 gap-2">
                            {([
                              { label: 'kcal', key: 'editCal' as const, color: '#f59e0b' },
                              { label: 'Eiweiß', key: 'editProt' as const, color: '#3b82f6' },
                              { label: 'Fett', key: 'editFat' as const, color: '#ef4444' },
                              { label: 'KH', key: 'editCarbs' as const, color: '#10b981' },
                            ] as const).map((field) => (
                              <div key={field.key}>
                                <p className="text-xs mb-1 text-center" style={{ color: field.color }}>{field.label}</p>
                                <input
                                  type="number"
                                  value={d[field.key]}
                                  onChange={(e) => setDishes((prev) =>
                                    prev.map((dish, idx) => idx === i ? { ...dish, [field.key]: e.target.value } : dish)
                                  )}
                                  className="w-full text-center text-sm font-bold rounded-xl py-2"
                                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                                />
                              </div>
                            ))}
                          </div>
                          {!d.added && (
                            <button onClick={() => addDish(i)}
                              className="w-full py-3 rounded-2xl font-black text-sm glass-press"
                              style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                              + Zum {MEALS.find((m) => m.id === mealType)?.label} hinzufügen
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Rescan button */}
              <button onClick={() => { setStep('scan'); setPreview(null); setDishes([]) }}
                className="w-full py-4 rounded-2xl font-bold text-sm glass-press"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-3)' }}>
                Neue Speisekarte scannen
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
