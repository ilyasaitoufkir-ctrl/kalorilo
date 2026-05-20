import { useState, useRef, useMemo } from 'react'
import { Search, Camera, Trash2, ChevronRight, X, ScanLine, PenLine, Plus, ArrowLeft, Mic, MicOff, RefreshCw, Loader } from 'lucide-react'
import { useStore } from '../store/useStore'
import { ALL_FOODS, FOOD_CATEGORIES, BRANDED_PRODUCTS, searchFoods, calculateMacros } from '../data/foodDatabase'
import { formatDate, uid, imageToBase64 } from '../utils/calculations'
import { fetchByBarcode, analyzePlate, correctPlateAnalysis } from '../utils/api'
import { useVoice } from '../hooks/useVoice'
import VoiceInput from './VoiceInput'
import type { FoodItem, MealType } from '../types'
import toast from 'react-hot-toast'

const today = formatDate()

const MEALS: { id: MealType; emoji: string; label: string }[] = [
  { id: 'breakfast', emoji: '🌅', label: 'Frühstück' },
  { id: 'lunch',     emoji: '☀️', label: 'Mittagessen' },
  { id: 'dinner',    emoji: '🌙', label: 'Abendessen' },
  { id: 'snack',     emoji: '🍎', label: 'Snack' },
]

// ── Add Food Sheet ────────────────────────────────────────────────────────
// ── Photo correction type ─────────────────────────────────────────────────
interface PhotoResult {
  description: string
  macros: { calories: number; protein: number; fat: number; carbs: number }
  items: { name: string; amount: string; calories: number }[]
}

function AddSheet({ mealType, onClose }: { mealType: MealType; onClose: () => void }) {
  const [view, setView]           = useState<'main'|'search'|'barcode'|'manual'|'photo'>('main')
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<FoodItem[]>([])
  const [selected, setSelected]   = useState<FoodItem | null>(null)
  const [amount, setAmount]       = useState('100')
  const [loading, setLoading]     = useState(false)
  const [correcting, setCorrecting] = useState(false)   // voice correction in progress
  const [barcodeVal, setBarcodeVal] = useState('')
  const [photoResult, setPhotoResult] = useState<PhotoResult | null>(null)
  const [lastCorrection, setLastCorrection] = useState('')
  const [manualForm, setManualForm] = useState({ name: '', cal: '', protein: '', fat: '', carbs: '' })
  const [activeCategory, setActiveCategory] = useState('⭐ Markenartikel')
  const fileRef = useRef<HTMLInputElement>(null)
  const addFoodLog = useStore((s) => s.addFoodLog)
  const apiKeys    = useStore((s) => s.apiKeys)

  // Voice hook for photo correction
  const { listening, startListening, stopListening, isSupported: voiceSupported } = useVoice()

  const handleSearch = (q: string) => { setQuery(q); setResults(q.length >= 2 ? searchFoods(q) : []) }
  const pick = (food: FoodItem) => { setSelected(food); setAmount(String(food.serving ?? 100)) }
  const macro = selected ? calculateMacros(selected, parseFloat(amount) || 100) : null

  const addSelected = () => {
    if (!selected || !macro) return
    addFoodLog({ id: uid(), date: today, mealType, foodItem: selected, amount: parseFloat(amount)||100, macros: macro, timestamp: Date.now() })
    toast.success(`${selected.name} hinzugefügt!`)
    onClose()
  }

  const handleBarcode = async () => {
    if (!barcodeVal) return
    setLoading(true)
    const food = await fetchByBarcode(barcodeVal)
    setLoading(false)
    if (food) pick(food)
    else toast.error('Produkt nicht gefunden')
  }

  const handlePhoto = async (file: File) => {
    if (!apiKeys.anthropic) { toast.error('Anthropic API Key fehlt'); return }
    setLoading(true)
    try {
      const result = await analyzePlate(await imageToBase64(file), apiKeys.anthropic)
      setPhotoResult({ description: result.description, macros: result.macros, items: result.items ?? [] })
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Fehler', { duration: 5000 }) }
    setLoading(false)
  }

  // ── Voice correction handler ───────────────────────────────────────────
  const handleVoiceCorrection = (transcript: string) => {
    if (!photoResult || !apiKeys.anthropic) return
    setLastCorrection(transcript)
    setCorrecting(true)
    correctPlateAnalysis(
      photoResult.description,
      photoResult.macros,
      photoResult.items,
      transcript,
      apiKeys.anthropic
    )
      .then((updated) => {
        setPhotoResult({ description: updated.description, macros: updated.macros, items: updated.items ?? [] })
        toast.success('✅ Kalorien aktualisiert!')
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Fehler', { duration: 5000 }))
      .finally(() => setCorrecting(false))
  }

  const startVoiceCorrection = () => {
    if (listening) { stopListening(); return }
    startListening(
      handleVoiceCorrection,
      (err) => toast.error(err)
    )
  }

  const savePhoto = () => {
    if (!photoResult) return
    addFoodLog({ id: uid(), date: today, mealType, foodItem: { id: uid(), name: photoResult.description, category: 'KI-Schätzung', macros: photoResult.macros }, amount: 100, macros: photoResult.macros, timestamp: Date.now(), aiEstimated: true })
    toast.success('Mahlzeit gespeichert!'); onClose()
  }

  const saveManual = () => {
    if (!manualForm.name || !manualForm.cal) { toast.error('Name und Kalorien erforderlich'); return }
    const m = { calories: parseInt(manualForm.cal), protein: parseFloat(manualForm.protein)||0, fat: parseFloat(manualForm.fat)||0, carbs: parseFloat(manualForm.carbs)||0 }
    addFoodLog({ id: uid(), date: today, mealType, foodItem: { id: uid(), name: manualForm.name, category: 'Manuell', macros: m }, amount: 100, macros: m, timestamp: Date.now() })
    toast.success('Eingetragen!'); onClose()
  }

  const categoryFoods = ALL_FOODS.filter((f) => f.category === activeCategory)

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="sheet-overlay absolute inset-0" />
      <div className="relative w-full max-w-[430px] mx-auto rounded-t-[32px] max-h-[92dvh] overflow-hidden flex flex-col anim-up"
        style={{ background: 'var(--bg)' }}
        onClick={(e) => e.stopPropagation()}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="sheet-handle" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pb-4 pt-1 flex-shrink-0">
          {view !== 'main' && (
            <button onClick={() => { setView('main'); setSelected(null); setPhotoResult(null) }}
              className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0 card">
              <ArrowLeft size={18} style={{ color: 'var(--text1)' }} />
            </button>
          )}
          <div className="flex-1">
            <h2 className="text-lg font-black" style={{ color: 'var(--text1)' }}>
              {{ main: 'Essen hinzufügen', search: 'Lebensmittel suchen', barcode: 'Barcode scannen', manual: 'Manuell eintragen', photo: '📸 KI-Teller-Analyse', voice: '🎤 Spracheingabe' }[view]}
            </h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-sm card">
            <X size={18} style={{ color: 'var(--text1)' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8">
          {/* Voice view */}
          {(view as string) === 'voice' && (
            <div className="py-8 flex flex-col items-center">
              <VoiceInput defaultMealType={mealType} onDone={onClose} />
            </div>
          )}

          {/* Main */}
          {view === 'main' && (
            <div className="space-y-3">
              {/* Voice Banner */}
              <button onClick={() => (setView as any)('voice')}
                className="w-full rounded-3xl p-4 flex items-center gap-4 text-left overflow-hidden relative"
                style={{ background: 'linear-gradient(135deg,#3b82f6,#7c3aed)' }}>
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Mic size={24} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-black text-sm">Spracheingabe 🎤</p>
                  <p className="text-blue-100 text-xs mt-0.5">„Ich habe Hähnchen gegessen"</p>
                </div>
                <div className="absolute right-4 text-white/30 text-3xl">✦</div>
              </button>

              {/* Quick option cards */}
              {[
                { icon: Search,   label: 'Lebensmittel suchen',     sub: '100+ Einträge + Markenprodukte', action: () => setView('search'),  color: 'bg-blue-500' },
                { icon: ScanLine, label: 'Barcode scannen',          sub: 'Open Food Facts – 3 Mio. Produkte', action: () => setView('barcode'), color: 'bg-emerald-500' },
                { icon: Camera,   label: 'KI-Teller-Foto',           sub: 'Claude AI analysiert dein Essen', action: () => setView('photo'),   color: 'bg-purple-500' },
                { icon: PenLine,  label: 'Manuell eintragen',         sub: 'Eigene Kalorien & Makros',       action: () => setView('manual'),  color: 'bg-orange-500' },
              ].map((opt) => (
                <button key={opt.label} onClick={opt.action}
                  className="w-full card card-press p-4 flex items-center gap-4 text-left">
                  <div className={`w-12 h-12 ${opt.color} rounded-2xl flex items-center justify-center flex-shrink-0`}>
                    <opt.icon size={22} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800">{opt.label}</p>
                    <p className="text-xs text-slate-400">{opt.sub}</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                </button>
              ))}
              {/* Markenartikel quick list */}
              <div className="card p-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">⭐ Beliebte Markenartikel</p>
                <div className="space-y-1">
                  {BRANDED_PRODUCTS.slice(0, 6).map((f) => (
                    <button key={f.id} onClick={() => { pick(f); setView('search') }}
                      className="w-full flex items-center justify-between py-2.5 px-3 hover:bg-slate-50 rounded-2xl transition">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{f.name}</p>
                        <p className="text-xs text-slate-400">{f.brand} · {f.serving}g</p>
                      </div>
                      <span className="text-sm font-bold text-blue-600">{Math.round(f.macros.calories * (f.serving||100)/100)} kcal</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Search */}
          {view === 'search' && !selected && (
            <div>
              <div className="relative mb-4">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input autoFocus value={query} onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3.5 bg-white rounded-2xl text-sm outline-none shadow-sm border-0 font-medium"
                  placeholder="Lebensmittel oder Marke suchen…" />
              </div>
              {/* Categories */}
              {!query && (
                <>
                  <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
                    {FOOD_CATEGORIES.map((cat) => (
                      <button key={cat} onClick={() => setActiveCategory(cat)}
                        className={`flex-shrink-0 px-3.5 py-2 rounded-2xl text-xs font-bold transition whitespace-nowrap ${activeCategory === cat ? 'bg-blue-500 text-white' : 'bg-white text-slate-600'}`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {categoryFoods.slice(0, 20).map((f) => (
                      <button key={f.id} onClick={() => pick(f)}
                        className="w-full flex items-center justify-between p-3.5 bg-white rounded-2xl active:bg-slate-50 transition">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{f.name}</p>
                          <p className="text-xs text-slate-400">{f.brand ? `${f.brand} · ` : ''}pro 100g</p>
                        </div>
                        <span className="text-sm font-bold text-blue-600">{f.macros.calories} kcal</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {query && (
                <div className="space-y-1">
                  {results.map((f) => (
                    <button key={f.id} onClick={() => pick(f)}
                      className="w-full flex items-center justify-between p-3.5 bg-white rounded-2xl active:bg-slate-50 transition">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{f.name}</p>
                        <p className="text-xs text-slate-400">{f.brand ? `${f.brand} · ` : ''}{f.category} · pro 100g</p>
                      </div>
                      <span className="text-sm font-bold text-blue-600">{f.macros.calories} kcal</span>
                    </button>
                  ))}
                  {results.length === 0 && <p className="text-center text-sm text-slate-400 py-8">Keine Ergebnisse</p>}
                </div>
              )}
            </div>
          )}

          {/* Selected food – amount picker */}
          {view === 'search' && selected && macro && (
            <div className="space-y-4">
              <div className="card p-4 bg-blue-50">
                <p className="font-black text-slate-900 text-base">{selected.name}</p>
                {selected.brand && <p className="text-xs text-blue-600 font-semibold mt-0.5">{selected.brand}</p>}
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {[['kcal', macro.calories], ['Eiweiß', `${macro.protein}g`], ['KH', `${macro.carbs}g`], ['Fett', `${macro.fat}g`]].map(([l, v]) => (
                    <div key={String(l)} className="bg-white rounded-2xl py-2.5 text-center">
                      <p className="text-sm font-black text-slate-800">{v}</p>
                      <p className="text-[10px] text-slate-400">{l}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700 mb-2">Menge</p>
                <div className="flex gap-2 mb-2">
                  {[50, 100, 150, 200, 250].map((g) => (
                    <button key={g} onClick={() => setAmount(String(g))}
                      className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition ${amount === String(g) ? 'bg-blue-500 text-white' : 'bg-white text-slate-600'}`}>{g}g</button>
                  ))}
                </div>
                <div className="flex items-center gap-2 card rounded-2xl px-4 py-3">
                  <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
                    className="flex-1 text-base font-bold outline-none bg-transparent" style={{ color: 'var(--text1)' }} />
                  <span style={{ color: 'var(--text3)' }} className="font-medium">Gramm</span>
                </div>
              </div>
              <button onClick={addSelected} className="w-full py-4 bg-blue-500 rounded-3xl text-white font-black text-base">
                Hinzufügen
              </button>
            </div>
          )}

          {/* Barcode */}
          {view === 'barcode' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">Barcode-Nummer eingeben (vom Produkt abtippen) oder scannen:</p>
              <div className="flex gap-2">
                <input type="number" inputMode="numeric" value={barcodeVal} onChange={(e) => setBarcodeVal(e.target.value)}
                  className="flex-1 rounded-2xl px-4 py-3.5 text-sm font-medium outline-none card"
                  placeholder="z.B. 4000539000015" style={{ color: 'var(--text1)' }} />
                <button onClick={handleBarcode} disabled={loading || !barcodeVal}
                  className="px-5 py-3 bg-blue-500 rounded-2xl text-white font-bold text-sm disabled:opacity-50">
                  {loading ? '⏳' : 'Suchen'}
                </button>
              </div>
              {selected && macro && (
                <div className="card p-4">
                  <p className="font-black text-slate-900">{selected.name}</p>
                  {selected.brand && <p className="text-xs text-blue-600">{selected.brand}</p>}
                  <div className="flex items-center gap-2 mt-3">
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                      className="w-20 text-center bg-slate-100 rounded-xl py-2 text-sm font-bold outline-none" />
                    <span className="text-sm text-slate-500">g</span>
                    <span className="ml-auto text-base font-black text-blue-600">{macro.calories} kcal</span>
                  </div>
                  <button onClick={addSelected} className="w-full mt-3 py-3 bg-blue-500 rounded-2xl text-white font-bold text-sm">Hinzufügen</button>
                </div>
              )}
            </div>
          )}

          {/* Manual */}
          {view === 'manual' && (
            <div className="space-y-3">
              <input value={manualForm.name} onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                className="w-full bg-white rounded-2xl px-4 py-3.5 text-sm font-medium outline-none"
                placeholder="Name des Lebensmittels" />
              <div className="grid grid-cols-2 gap-2">
                {[['Kalorien (kcal) *', 'cal'], ['Eiweiß (g)', 'protein'], ['Kohlenhydrate (g)', 'carbs'], ['Fett (g)', 'fat']] .map(([label, key]) => (
                  <div key={key}>
                    <p className="text-xs text-slate-500 mb-1 pl-1">{label}</p>
                    <input type="number" value={manualForm[key as keyof typeof manualForm]}
                      onChange={(e) => setManualForm({ ...manualForm, [key]: e.target.value })}
                      className="w-full bg-white rounded-2xl px-4 py-3 text-sm font-medium outline-none" />
                  </div>
                ))}
              </div>
              <button onClick={saveManual} className="w-full py-4 bg-blue-500 rounded-3xl text-white font-black text-base">Eintragen</button>
            </div>
          )}

          {/* Photo */}
          {view === 'photo' && (
            <div className="space-y-3">
              <div className="bg-blue-50 rounded-2xl p-3 flex items-start gap-2">
                <span className="text-lg flex-shrink-0">📸</span>
                <div>
                  <p className="text-sm text-blue-800 font-semibold">KI-Teller-Analyse</p>
                  <p className="text-xs text-blue-600 mt-0.5">Claude AI erkennt alle Zutaten und berechnet Kalorien. Falls etwas fehlt → per Sprache korrigieren!</p>
                </div>
              </div>

              {!photoResult ? (
                <>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])} />
                  <button onClick={() => fileRef.current?.click()} disabled={loading}
                    className="w-full py-8 border-2 border-dashed border-blue-200 rounded-3xl flex flex-col items-center gap-3 text-blue-500 font-bold disabled:opacity-50 transition-all active:scale-95"
                    style={{ background: 'var(--surface2)' }}>
                    {loading
                      ? <><Loader size={32} className="animate-spin" /><span>KI analysiert Teller…</span><span className="text-xs font-normal" style={{ color: 'var(--text3)' }}>Bitte warten</span></>
                      : <><Camera size={36} /><span className="text-base">Foto aufnehmen</span><span className="text-xs font-normal" style={{ color: 'var(--text3)' }}>Tippe hier</span></>}
                  </button>
                  {!apiKeys.anthropic && (
                    <p className="text-center text-xs text-red-500">⚠️ Anthropic API Key fehlt → Profil → API Keys</p>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  {/* Result card */}
                  <div className="card p-4">
                    <div className="flex items-start justify-between mb-3">
                      <p className="font-black text-sm flex-1 pr-2" style={{ color: 'var(--text1)' }}>
                        🎯 {photoResult.description}
                      </p>
                      <span className="text-[10px] font-bold text-orange-500 bg-orange-50 rounded-xl px-2 py-0.5 flex-shrink-0">±15%</span>
                    </div>

                    {/* Macro chips */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {[
                        { l: 'kcal', v: photoResult.macros.calories,          color: '#3b82f6' },
                        { l: 'Eiweiß', v: `${photoResult.macros.protein}g`,   color: '#10b981' },
                        { l: 'KH',    v: `${photoResult.macros.carbs}g`,      color: '#f59e0b' },
                        { l: 'Fett',  v: `${photoResult.macros.fat}g`,        color: '#ef4444' },
                      ].map((item) => (
                        <div key={item.l} className="rounded-2xl py-2.5 text-center" style={{ background: 'var(--surface2)' }}>
                          <p className="text-sm font-black" style={{ color: item.color }}>{item.v}</p>
                          <p className="text-[10px]" style={{ color: 'var(--text3)' }}>{item.l}</p>
                        </div>
                      ))}
                    </div>

                    {/* Detected items */}
                    {photoResult.items.length > 0 && (
                      <div className="mb-3 space-y-1">
                        <p className="text-xs font-bold mb-1" style={{ color: 'var(--text3)' }}>Erkannte Zutaten:</p>
                        {photoResult.items.map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span style={{ color: 'var(--text2)' }}>• {item.name} ({item.amount})</span>
                            <span className="font-semibold" style={{ color: 'var(--text1)' }}>{item.calories} kcal</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button onClick={() => { setPhotoResult(null); setLastCorrection('') }}
                        className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl text-sm font-bold transition"
                        style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
                        <RefreshCw size={14} />Neu
                      </button>
                      <button onClick={savePhoto}
                        className="flex-1 py-3 bg-blue-500 rounded-2xl text-sm font-black text-white">
                        Speichern ✓
                      </button>
                    </div>
                  </div>

                  {/* ── Voice Correction Section ─────────────────────────── */}
                  <div className="card p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: listening ? '#fee2e2' : 'var(--surface2)' }}>
                        <Mic size={16} className={listening ? 'text-red-500' : 'text-blue-500'} />
                      </div>
                      <div>
                        <p className="text-sm font-black" style={{ color: 'var(--text1)' }}>
                          Etwas fehlt? Per Sprache korrigieren
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text3)' }}>
                          z.B. „Der Käse fehlt" · „Reis war 200g" · „Noch Soße dazu"
                        </p>
                      </div>
                    </div>

                    {/* Big microphone button */}
                    <button
                      onClick={startVoiceCorrection}
                      disabled={correcting || !voiceSupported}
                      className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 transition-all active:scale-95 disabled:opacity-50 ${
                        listening
                          ? 'bg-red-500 text-white'
                          : correcting
                            ? 'bg-purple-500 text-white'
                            : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                      }`}
                    >
                      {correcting ? (
                        <><Loader size={18} className="animate-spin" />KI rechnet nach…</>
                      ) : listening ? (
                        <><MicOff size={18} /><span>Tippe zum Stoppen</span><span className="w-2 h-2 bg-white rounded-full anim-pulse" /></>
                      ) : (
                        <><Mic size={18} />🎤 Sprache zur Korrektur</>
                      )}
                    </button>

                    {/* Last correction shown */}
                    {lastCorrection && !listening && !correcting && (
                      <div className="mt-2 rounded-xl px-3 py-2" style={{ background: 'var(--surface2)' }}>
                        <p className="text-xs" style={{ color: 'var(--text3)' }}>
                          Letzte Korrektur: <span className="italic" style={{ color: 'var(--text2)' }}>„{lastCorrection}"</span>
                        </p>
                      </div>
                    )}

                    {!voiceSupported && (
                      <p className="text-center text-xs text-slate-400 mt-2">
                        Spracheingabe nur in Safari verfügbar
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main FoodTracker ───────────────────────────────────────────────────────
export default function FoodTracker() {
  const [addingMeal, setAddingMeal]   = useState<MealType | null>(null)
  const [expandedMeal, setExpandedMeal] = useState<MealType>('breakfast')
  const allFoodLogs  = useStore((s) => s.foodLogs)
  const removeFoodLog = useStore((s) => s.removeFoodLog)

  const foodLogs = useMemo(() => allFoodLogs.filter((l) => l.date === today), [allFoodLogs])
  const totalCals = useMemo(() => foodLogs.reduce((s, f) => s + (f.macros?.calories ?? 0), 0), [foodLogs])
  const totalProt = useMemo(() => foodLogs.reduce((s, f) => s + (f.macros?.protein ?? 0), 0), [foodLogs])
  const totalCarbs = useMemo(() => foodLogs.reduce((s, f) => s + (f.macros?.carbs ?? 0), 0), [foodLogs])
  const totalFat   = useMemo(() => foodLogs.reduce((s, f) => s + (f.macros?.fat ?? 0), 0), [foodLogs])

  return (
    <div className="pb-nav anim-fade">
      {/* Header */}
      <div className="grad-blue px-5 pt-safe pb-6">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
        <h1 className="text-white text-2xl font-black mb-1">Essen tracken</h1>
        <p className="text-blue-200 text-sm mb-4">Heute: {Math.round(totalCals)} kcal</p>
        <div className="flex gap-3">
          {[{ l: 'Eiweiß', v: Math.round(totalProt), c: '#93c5fd' }, { l: 'Kohlenhydrate', v: Math.round(totalCarbs), c: '#fcd34d' }, { l: 'Fett', v: Math.round(totalFat), c: '#fca5a5' }].map((m) => (
            <div key={m.l} className="flex-1 bg-white/10 rounded-2xl px-3 py-2 text-center">
              <p className="font-black text-sm" style={{ color: m.c }}>{m.v}g</p>
              <p className="text-[10px] text-blue-200">{m.l}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {MEALS.map((meal) => {
          const logs = foodLogs.filter((l) => l.mealType === meal.id)
          const cals = logs.reduce((s, l) => s + (l.macros?.calories ?? 0), 0)
          const open = expandedMeal === meal.id
          return (
            <div key={meal.id} className="card overflow-hidden">
              <button className="w-full flex items-center gap-3 p-4" onClick={() => setExpandedMeal(open ? ('breakfast' as MealType) : meal.id)}>
                <span className="text-2xl">{meal.emoji}</span>
                <div className="flex-1 text-left">
                  <p className="text-sm font-black text-slate-800">{meal.label}</p>
                  <p className="text-xs text-slate-400">{logs.length} Einträge · {Math.round(cals)} kcal</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setAddingMeal(meal.id) }}
                  className="w-9 h-9 bg-blue-500 rounded-2xl flex items-center justify-center mr-2 flex-shrink-0">
                  <Plus size={18} className="text-white" />
                </button>
                <ChevronRight size={16} className={`text-slate-300 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
              </button>
              {open && logs.length > 0 && (
                <div className="border-t border-slate-50 px-4 pb-2 space-y-0">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{log.foodItem.name}</p>
                        <p className="text-xs text-slate-400">{log.amount}g{log.aiEstimated ? ' · 🤖 KI' : ''}</p>
                      </div>
                      <div className="text-right mr-2">
                        <p className="text-sm font-black text-slate-800">{log.macros.calories} kcal</p>
                        <p className="text-[10px] text-slate-400">E:{log.macros.protein}g K:{log.macros.carbs}g F:{log.macros.fat}g</p>
                      </div>
                      <button onClick={() => removeFoodLog(log.id)} className="text-slate-200 active:text-red-400 p-1">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {open && logs.length === 0 && (
                <div className="border-t border-slate-50 px-4 py-4 text-center">
                  <p className="text-sm text-slate-400">Noch nichts eingetragen</p>
                  <button onClick={() => setAddingMeal(meal.id)}
                    className="mt-2 px-4 py-2 bg-blue-50 text-blue-600 text-sm font-bold rounded-2xl">
                    Jetzt hinzufügen
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {addingMeal && <AddSheet mealType={addingMeal} onClose={() => setAddingMeal(null)} />}
    </div>
  )
}
