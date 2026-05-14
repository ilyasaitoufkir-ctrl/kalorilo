import { useState, useRef, useMemo } from 'react'
import { Search, Camera, PlusCircle, Trash2, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { FOOD_DATABASE, FOOD_CATEGORIES, searchFoods, calculateMacros } from '../data/foodDatabase'
import { formatDate, uid, imageToBase64 } from '../utils/calculations'
import { fetchByBarcode, analyzePlate } from '../utils/api'
import type { FoodItem, MealType, FoodLog } from '../types'
import toast from 'react-hot-toast'

const today = formatDate()

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '🌅 Frühstück',
  lunch: '☀️ Mittagessen',
  dinner: '🌙 Abendessen',
  snack: '🍎 Snack',
}

function FoodCard({ log, onRemove }: { log: FoodLog; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800 truncate">{log.foodItem.name}</div>
        <div className="text-xs text-gray-400">{log.amount}g{log.aiEstimated ? ' · KI-Schätzung' : ''}</div>
      </div>
      <div className="text-right mr-2">
        <div className="text-sm font-bold text-gray-800">{log.macros.calories} kcal</div>
        <div className="text-xs text-gray-400">E:{log.macros.protein}g K:{log.macros.carbs}g F:{log.macros.fat}g</div>
      </div>
      <button onClick={onRemove} className="text-gray-300 active:text-red-400 transition p-1">
        <Trash2 size={16} />
      </button>
    </div>
  )
}

function AddFoodModal({
  onClose,
  mealType,
}: {
  onClose: () => void
  mealType: MealType
}) {
  const [tab, setTab] = useState<'search' | 'barcode' | 'manual' | 'photo' | 'category'>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodItem[]>([])
  const [selected, setSelected] = useState<FoodItem | null>(null)
  const [amount, setAmount] = useState('100')
  const [manualName, setManualName] = useState('')
  const [manualCal, setManualCal] = useState('')
  const [manualP, setManualP] = useState('')
  const [manualF, setManualF] = useState('')
  const [manualC, setManualC] = useState('')
  const [barcodeInput, setBarcodeInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [photoResult, setPhotoResult] = useState<{ description: string; macros: { calories: number; protein: number; fat: number; carbs: number } } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const addFoodLog = useStore((s) => s.addFoodLog)
  const apiKeys = useStore((s) => s.apiKeys)

  const handleSearch = (q: string) => {
    setQuery(q)
    setResults(q.length >= 2 ? searchFoods(q) : [])
  }

  const handleBarcodeSearch = async () => {
    if (!barcodeInput) return
    setLoading(true)
    const food = await fetchByBarcode(barcodeInput)
    setLoading(false)
    if (food) { setSelected(food); setAmount(String(food.serving ?? 100)) }
    else toast.error('Produkt nicht gefunden')
  }

  const handlePhotoUpload = async (file: File) => {
    if (!apiKeys.anthropic) { toast.error('Anthropic API Key fehlt – bitte unter Profil eintragen'); return }
    setLoading(true)
    try {
      const b64 = await imageToBase64(file)
      const result = await analyzePlate(b64, apiKeys.anthropic)
      setPhotoResult({ description: result.description, macros: result.macros })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
      console.error('[PlateAnalysis]', e)
      toast.error(msg, { duration: 5000 })
    }
    setLoading(false)
  }

  const savePhotoResult = () => {
    if (!photoResult) return
    const log: FoodLog = {
      id: uid(), date: today, mealType,
      foodItem: { id: uid(), name: photoResult.description, category: 'KI-Schätzung', macros: { ...photoResult.macros, calories: photoResult.macros.calories } },
      amount: 100, macros: photoResult.macros, timestamp: Date.now(), aiEstimated: true,
    }
    addFoodLog(log)
    toast.success('Mahlzeit gespeichert!')
    onClose()
  }

  const addSelected = () => {
    if (!selected) return
    const amt = parseFloat(amount) || 100
    const macros = calculateMacros(selected, amt)
    addFoodLog({ id: uid(), date: today, mealType, foodItem: selected, amount: amt, macros, timestamp: Date.now() })
    toast.success(`${selected.name} hinzugefügt!`)
    onClose()
  }

  const addManual = () => {
    if (!manualName || !manualCal) { toast.error('Name und Kalorien erforderlich'); return }
    const macros = { calories: parseInt(manualCal), protein: parseFloat(manualP) || 0, fat: parseFloat(manualF) || 0, carbs: parseFloat(manualC) || 0 }
    const food: FoodItem = { id: uid(), name: manualName, category: 'Manuell', macros }
    addFoodLog({ id: uid(), date: today, mealType, foodItem: food, amount: 100, macros, timestamp: Date.now() })
    toast.success('Eingetragen!')
    onClose()
  }

  const addFromCategory = (food: FoodItem) => {
    setSelected(food)
    setAmount(String(food.serving ?? 100))
    setTab('search')
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={onClose}>
      <div className="bg-white w-full rounded-t-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white pt-4 px-4 pb-2 z-10">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">Essen hinzufügen</h2>
            <button onClick={onClose}><X size={22} className="text-gray-400" /></button>
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 overflow-x-auto">
            {(['search', 'category', 'barcode', 'manual', 'photo'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 text-xs py-2 px-2 rounded-xl font-medium whitespace-nowrap transition ${tab === t ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
              >
                {{ search: '🔍 Suchen', category: '📂 Kategorie', barcode: '📷 Barcode', manual: '✏️ Manuell', photo: '🍽️ KI-Foto' }[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 pb-6 pt-2">
          {/* Search */}
          {tab === 'search' && (
            <div>
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  className="w-full pl-9 pr-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Lebensmittel suchen…"
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
              {selected ? (
                <div className="bg-blue-50 rounded-2xl p-4 mb-3">
                  <div className="font-semibold text-gray-800 mb-1">{selected.name}</div>
                  <div className="text-xs text-gray-500 mb-3">{selected.category}</div>
                  <div className="flex items-center gap-2 mb-3">
                    <label className="text-sm text-gray-600">Menge (g):</label>
                    <input
                      type="number" value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-20 text-center border border-blue-200 rounded-xl py-1.5 text-sm outline-none"
                    />
                  </div>
                  {(() => {
                    const m = calculateMacros(selected, parseFloat(amount) || 100)
                    return (
                      <div className="grid grid-cols-4 gap-2 mb-3 text-center text-xs">
                        {[['kcal', m.calories], ['Eiweiß', `${m.protein}g`], ['KH', `${m.carbs}g`], ['Fett', `${m.fat}g`]].map(([l, v]) => (
                          <div key={String(l)} className="bg-white rounded-xl py-2">
                            <div className="font-bold text-gray-800">{v}</div>
                            <div className="text-gray-400">{l}</div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                  <div className="flex gap-2">
                    <button onClick={() => setSelected(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500">Zurück</button>
                    <button onClick={addSelected} className="flex-1 py-2.5 gradient-blue rounded-xl text-sm text-white font-semibold">Hinzufügen</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {results.map((f) => (
                    <button key={f.id} onClick={() => { setSelected(f); setAmount(String(f.serving ?? 100)) }}
                      className="w-full text-left flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition">
                      <div>
                        <div className="text-sm font-medium text-gray-800">{f.name}</div>
                        <div className="text-xs text-gray-400">{f.category}</div>
                      </div>
                      <div className="text-sm font-bold text-blue-600">{f.macros.calories} kcal</div>
                    </button>
                  ))}
                  {query.length >= 2 && results.length === 0 && (
                    <p className="text-center text-sm text-gray-400 py-6">Keine Ergebnisse gefunden</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Category */}
          {tab === 'category' && (
            <div>
              {!activeCategory ? (
                <div className="grid grid-cols-2 gap-2">
                  {FOOD_CATEGORIES.map((cat) => (
                    <button key={cat} onClick={() => setActiveCategory(cat)}
                      className="card p-3 text-left text-sm font-medium text-gray-700 card-pressed">
                      {cat}
                    </button>
                  ))}
                </div>
              ) : (
                <div>
                  <button onClick={() => setActiveCategory(null)} className="text-blue-500 text-sm mb-3 flex items-center gap-1">
                    ← {activeCategory}
                  </button>
                  <div className="space-y-1">
                    {FOOD_DATABASE.filter((f) => f.category === activeCategory).map((f) => (
                      <button key={f.id} onClick={() => addFromCategory(f)}
                        className="w-full text-left flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl">
                        <div>
                          <div className="text-sm font-medium">{f.name}</div>
                          <div className="text-xs text-gray-400">pro 100g</div>
                        </div>
                        <div className="text-sm font-bold text-blue-600">{f.macros.calories} kcal</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Barcode */}
          {tab === 'barcode' && (
            <div>
              <p className="text-sm text-gray-500 mb-4">Barcode manuell eingeben oder scannen (Open Food Facts – 3 Mio. Produkte)</p>
              <input
                className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-200 mb-3"
                placeholder="Barcode eingeben z.B. 4000539000015"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                type="number"
              />
              <button onClick={handleBarcodeSearch} disabled={loading}
                className="w-full py-3 gradient-blue rounded-2xl text-white font-semibold text-sm disabled:opacity-50">
                {loading ? '⏳ Suche…' : '🔍 Produkt suchen'}
              </button>
              {selected && (
                <div className="mt-4 bg-green-50 rounded-2xl p-4">
                  <div className="font-semibold text-gray-800">{selected.name}</div>
                  {selected.brand && <div className="text-xs text-gray-500">{selected.brand}</div>}
                  <div className="grid grid-cols-4 gap-2 mt-3 text-center text-xs">
                    {[['kcal', selected.macros.calories], ['E', `${selected.macros.protein}g`], ['KH', `${selected.macros.carbs}g`], ['F', `${selected.macros.fat}g`]].map(([l, v]) => (
                      <div key={String(l)} className="bg-white rounded-xl py-2">
                        <div className="font-bold text-gray-800">{v}</div>
                        <div className="text-gray-400">{l}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <label className="text-sm text-gray-600">Menge:</label>
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                      className="w-20 text-center border border-gray-200 rounded-xl py-1.5 text-sm outline-none" />
                    <span className="text-sm text-gray-500">g</span>
                  </div>
                  <button onClick={addSelected} className="w-full mt-3 py-2.5 gradient-blue rounded-xl text-white font-semibold text-sm">
                    Hinzufügen
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Manual */}
          {tab === 'manual' && (
            <div className="space-y-3">
              <input value={manualName} onChange={(e) => setManualName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none" placeholder="Name des Lebensmittels" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Kalorien *</label>
                  <input type="number" value={manualCal} onChange={(e) => setManualCal(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none" placeholder="kcal" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Eiweiß (g)</label>
                  <input type="number" value={manualP} onChange={(e) => setManualP(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none" placeholder="g" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Kohlenhydrate (g)</label>
                  <input type="number" value={manualC} onChange={(e) => setManualC(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none" placeholder="g" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Fett (g)</label>
                  <input type="number" value={manualF} onChange={(e) => setManualF(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none" placeholder="g" />
                </div>
              </div>
              <button onClick={addManual} className="w-full py-3 gradient-blue rounded-2xl text-white font-semibold">
                Eintragen
              </button>
            </div>
          )}

          {/* AI Photo */}
          {tab === 'photo' && (
            <div>
              <div className="bg-blue-50 rounded-2xl p-4 mb-4 text-sm text-blue-700">
                📸 Fotografiere deinen Teller – die KI schätzt Kalorien & Makros automatisch.
                <br /><span className="font-medium">Hinweis: KI-Schätzung ±15%</span>
              </div>
              {!photoResult ? (
                <>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])} />
                  <button onClick={() => fileRef.current?.click()} disabled={loading}
                    className="w-full py-4 border-2 border-dashed border-blue-200 rounded-2xl text-blue-500 font-medium text-sm disabled:opacity-50 flex flex-col items-center gap-2">
                    {loading ? <><span className="text-2xl">⏳</span>KI analysiert…</> : <><Camera size={28} />Foto aufnehmen oder auswählen</>}
                  </button>
                  {!apiKeys.anthropic && (
                    <p className="text-center text-xs text-red-500 mt-2">⚠️ Anthropic API Key fehlt – bitte unter Profil eintragen</p>
                  )}
                </>
              ) : (
                <div className="bg-green-50 rounded-2xl p-4">
                  <div className="font-semibold text-gray-800 mb-2">🎯 {photoResult.description}</div>
                  <div className="grid grid-cols-4 gap-2 mb-3 text-center text-xs">
                    {[['kcal', photoResult.macros.calories], ['Eiweiß', `${photoResult.macros.protein}g`], ['KH', `${photoResult.macros.carbs}g`], ['Fett', `${photoResult.macros.fat}g`]].map(([l, v]) => (
                      <div key={String(l)} className="bg-white rounded-xl py-2">
                        <div className="font-bold text-gray-800">{v}</div>
                        <div className="text-gray-400">{l}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-gray-400 mb-3 text-center">⚠️ KI-Schätzung ±15% – Werte vor dem Speichern anpassbar</div>
                  <div className="flex gap-2">
                    <button onClick={() => setPhotoResult(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500">Neu</button>
                    <button onClick={savePhotoResult} className="flex-1 py-2.5 gradient-blue rounded-xl text-white font-semibold text-sm">Speichern</button>
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

export default function FoodTracker() {
  const [addingMeal, setAddingMeal] = useState<MealType | null>(null)
  const [expandedMeal, setExpandedMeal] = useState<MealType | null>('breakfast')
  // Use raw array – never call store methods inside useStore selectors (causes infinite loop in React 19)
  const allFoodLogs = useStore((s) => s.foodLogs)
  const removeFoodLog = useStore((s) => s.removeFoodLog)

  const foodLogs = useMemo(() => allFoodLogs.filter((l) => l.date === today), [allFoodLogs])

  const mealLogs = (meal: MealType) => foodLogs.filter((l) => l.mealType === meal)
  const mealCals = (meal: MealType) => mealLogs(meal).reduce((s, l) => s + l.macros.calories, 0)

  const totalMacros = useMemo(() => foodLogs.reduce(
    (acc, l) => ({ calories: acc.calories + l.macros.calories, protein: acc.protein + l.macros.protein, fat: acc.fat + l.macros.fat, carbs: acc.carbs + l.macros.carbs }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  ), [foodLogs])

  return (
    <div className="pb-24 animate-fade-in">
      {/* Header */}
      <div className="gradient-blue px-4 pt-12 pb-6 safe-top">
        <h1 className="text-white text-2xl font-bold mb-1">Essen tracken</h1>
        <p className="text-blue-100 text-sm">Heute: {Math.round(totalMacros.calories)} kcal</p>
        <div className="flex gap-4 mt-3 text-white text-sm">
          <span>E: {Math.round(totalMacros.protein)}g</span>
          <span>KH: {Math.round(totalMacros.carbs)}g</span>
          <span>F: {Math.round(totalMacros.fat)}g</span>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {(Object.keys(MEAL_LABELS) as MealType[]).map((meal) => (
          <div key={meal} className="card overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-4"
              onClick={() => setExpandedMeal(expandedMeal === meal ? null : meal)}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{MEAL_LABELS[meal].split(' ')[0]}</span>
                <div className="text-left">
                  <div className="text-sm font-semibold text-gray-800">{MEAL_LABELS[meal].split(' ').slice(1).join(' ')}</div>
                  <div className="text-xs text-gray-400">{mealLogs(meal).length} Einträge · {Math.round(mealCals(meal))} kcal</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setAddingMeal(meal) }}
                  className="w-8 h-8 gradient-blue rounded-full flex items-center justify-center"
                >
                  <PlusCircle size={18} className="text-white" />
                </button>
                {expandedMeal === meal ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
              </div>
            </button>
            {expandedMeal === meal && mealLogs(meal).length > 0 && (
              <div className="px-4 pb-3 border-t border-gray-50">
                {mealLogs(meal).map((log) => (
                  <FoodCard key={log.id} log={log} onRemove={() => removeFoodLog(log.id)} />
                ))}
              </div>
            )}
            {expandedMeal === meal && mealLogs(meal).length === 0 && (
              <div className="px-4 pb-4 text-center text-sm text-gray-400 border-t border-gray-50 pt-3">
                Noch nichts eingetragen
              </div>
            )}
          </div>
        ))}
      </div>

      {addingMeal && <AddFoodModal mealType={addingMeal} onClose={() => setAddingMeal(null)} />}
    </div>
  )
}
