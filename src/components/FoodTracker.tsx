import { useState, useRef, useMemo } from 'react'
import { Search, Camera, Trash2, X, ScanLine, PenLine, Plus, ArrowLeft, Mic, MicOff, Loader, RefreshCw, ChevronRight } from 'lucide-react'
import { useStore } from '../store/useStore'
import { ALL_FOODS, FOOD_CATEGORIES, BRANDED_PRODUCTS, searchFoods, calculateMacros } from '../data/foodDatabase'
import { formatDate, uid, imageToBase64 } from '../utils/calculations'
import { fetchByBarcode, analyzePlate, correctPlateAnalysis, searchUSDA, getAINutrients } from '../utils/api'
import { useVoice } from '../hooks/useVoice'
import VoiceInput from './VoiceInput'
import type { FoodItem, MealType } from '../types'
import toast from 'react-hot-toast'

const today = formatDate()

const MEALS: { id: MealType; emoji: string; label: string }[] = [
  { id: 'breakfast', emoji: '🌅', label: 'Frühstück'   },
  { id: 'lunch',     emoji: '☀️', label: 'Mittagessen' },
  { id: 'dinner',    emoji: '🌙', label: 'Abendessen'  },
  { id: 'snack',     emoji: '🍎', label: 'Snack'       },
]

interface PhotoResult {
  description: string
  macros: { calories: number; protein: number; fat: number; carbs: number }
  items: { name: string; amount: string; calories: number }[]
}

// ── Add Sheet ──────────────────────────────────────────────────────────────
function AddSheet({ mealType, onClose }: { mealType: MealType; onClose: () => void }) {
  const [view, setView]         = useState<'main'|'search'|'barcode'|'manual'|'photo'>('main')
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<FoodItem[]>([])
  const [selected, setSelected] = useState<FoodItem|null>(null)
  const [amount, setAmount]     = useState('100')
  const [loading, setLoading]   = useState(false)
  const [correcting, setCorrecting] = useState(false)
  const [barcodeVal, setBarcodeVal]     = useState('')
  const [barcodeStatus, setBarcodeStatus] = useState<'idle'|'found'|'notfound'>('idle')
  const [productNameSuggestion, setProductNameSuggestion] = useState('')
  const [photoResult, setPhotoResult] = useState<PhotoResult|null>(null)
  const [lastCorrection, setLastCorrection] = useState('')
  const [manualForm, setManualForm] = useState({ name:'', cal:'', protein:'', fat:'', carbs:'' })
  const [activeCategory, setActiveCategory] = useState('⭐ Markenartikel')
  const fileRef = useRef<HTMLInputElement>(null)
  const addFoodLog = useStore((s) => s.addFoodLog)
  const apiKeys    = useStore((s) => s.apiKeys)
  const { listening, startListening, stopListening, isSupported: voiceSupported } = useVoice()

  const handleSearch = (q: string) => { setQuery(q); setResults(q.length>=2 ? searchFoods(q) : []) }
  const pick = (f: FoodItem) => { setSelected(f); setAmount(String(f.serving??100)) }
  const macro = selected ? calculateMacros(selected, parseFloat(amount)||100) : null

  const addSelected = () => {
    if (!selected||!macro) return
    addFoodLog({ id:uid(), date:today, mealType, foodItem:selected, amount:parseFloat(amount)||100, macros:macro, timestamp:Date.now() })
    toast.success(`${selected.name} hinzugefügt!`)
    onClose()
  }

  const handleBarcode = async () => {
    if (!barcodeVal) return
    setLoading(true)
    setBarcodeStatus('idle')
    // 1. Open Food Facts (größte kostenlose DB)
    let f = await fetchByBarcode(barcodeVal)
    // 2. Fallback: USDA FoodData Central
    if (!f) {
      f = await searchUSDA(barcodeVal)
    }
    setLoading(false)
    if (f) { pick(f); setBarcodeStatus('found') }
    else   { setBarcodeStatus('notfound') }
  }

  const handleAISuggestNutrients = async () => {
    if (!productNameSuggestion.trim() || !apiKeys.anthropic) return
    setLoading(true)
    try {
      const nutrients = await getAINutrients(productNameSuggestion, apiKeys.anthropic)
      if (nutrients) {
        const food: FoodItem = {
          id: uid(), name: productNameSuggestion, category: 'KI-Schätzung',
          macros: nutrients, serving: 100,
        }
        pick(food)
        toast.success(`KI-Schätzung für „${productNameSuggestion}" geladen`)
      } else {
        toast.error('KI konnte keine Nährwerte finden')
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Fehler') }
    setLoading(false)
  }

  const handlePhoto = async (file: File) => {
    setLoading(true)
    try {
      const r = await analyzePlate(await imageToBase64(file), apiKeys.anthropic)
      setPhotoResult({ description:r.description, macros:r.macros, items:r.items??[] })
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Fehler', { duration: 5000 }) }
    setLoading(false)
  }

  const handleVoiceCorrection = (text: string) => {
    if (!photoResult||!apiKeys.anthropic) return
    setLastCorrection(text); setCorrecting(true)
    correctPlateAnalysis(photoResult.description, photoResult.macros, photoResult.items, text, apiKeys.anthropic)
      .then((u) => { setPhotoResult({ description:u.description, macros:u.macros, items:u.items??[] }); toast.success('Kalorien aktualisiert!') })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Fehler', { duration:5000 }))
      .finally(() => setCorrecting(false))
  }

  const savePhoto = () => {
    if (!photoResult) return
    addFoodLog({ id:uid(), date:today, mealType, foodItem:{ id:uid(), name:photoResult.description, category:'KI-Schätzung', macros:photoResult.macros }, amount:100, macros:photoResult.macros, timestamp:Date.now(), aiEstimated:true })
    toast.success('Mahlzeit gespeichert!'); onClose()
  }

  const saveManual = () => {
    if (!manualForm.name||!manualForm.cal) { toast.error('Name und Kalorien erforderlich'); return }
    const m = { calories:parseInt(manualForm.cal), protein:parseFloat(manualForm.protein)||0, fat:parseFloat(manualForm.fat)||0, carbs:parseFloat(manualForm.carbs)||0 }
    addFoodLog({ id:uid(), date:today, mealType, foodItem:{ id:uid(), name:manualForm.name, category:'Manuell', macros:m }, amount:100, macros:m, timestamp:Date.now() })
    toast.success('Eingetragen!'); onClose()
  }

  const categoryFoods = ALL_FOODS.filter((f) => f.category === activeCategory)

  const inputStyle = { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius: 16, color:'var(--text-1)', padding:'12px 16px', width:'100%', fontSize:14, fontWeight:600 } as const
  const btnStyle   = { minHeight: 50 } as const

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="sheet-overlay absolute inset-0" />
      <div className="sheet-bg relative w-full max-w-[430px] mx-auto max-h-[93dvh] overflow-hidden flex flex-col anim-up"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0"><div className="sheet-handle"/></div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pb-4 pt-1 flex-shrink-0">
          {view !== 'main' && (
            <button onClick={() => { setView('main'); setSelected(null); setPhotoResult(null) }}
              className="glass-sm glass-press w-10 h-10 flex items-center justify-center flex-shrink-0">
              <ArrowLeft size={17} style={{ color:'var(--text-2)' }} />
            </button>
          )}
          <h2 className="flex-1 text-lg font-black" style={{ color:'var(--text-1)' }}>
            {{ main:'Essen hinzufügen', search:'Suchen', barcode:'Barcode', manual:'Manuell', photo:'📸 KI-Analyse' }[view]}
          </h2>
          <button onClick={onClose} className="glass-sm glass-press w-10 h-10 flex items-center justify-center flex-shrink-0">
            <X size={17} style={{ color:'var(--text-2)' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 space-y-3" style={{ paddingBottom:'calc(40px + max(env(safe-area-inset-bottom),16px))' }}>

          {/* Main view */}
          {view === 'main' && (
            <>
              {/* Voice banner */}
              <button onClick={() => (setView as any)('voice')}
                className="w-full p-4 rounded-3xl flex items-center gap-3 overflow-hidden relative glass-press"
                style={{ background:'linear-gradient(135deg,rgba(245,158,11,0.15),rgba(59,130,246,0.15))', border:'1px solid rgba(245,158,11,0.2)' }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background:'rgba(245,158,11,0.15)' }}>
                  <Mic size={22} style={{ color:'var(--gold)' }} />
                </div>
                <div style={{ minWidth:0 }}>
                  <p className="font-black text-sm text-left" style={{ color:'var(--text-1)' }}>🎤 Spracheingabe</p>
                  <p className="text-xs text-left" style={{ color:'var(--text-3)' }}>„Ich habe Hähnchen gegessen…"</p>
                </div>
              </button>

              {/* Options */}
              {[
                { icon:Search,   label:'Lebensmittel suchen',  sub:'100+ Einträge + Marken',     action:()=>setView('search'),  color:'#3b82f6' },
                { icon:ScanLine, label:'Barcode scannen',       sub:'Open Food Facts – 3 Mio.',   action:()=>setView('barcode'), color:'#10b981' },
                { icon:Camera,   label:'KI-Teller-Foto',        sub:'Claude AI analysiert',        action:()=>setView('photo'),   color:'#8b5cf6' },
                { icon:PenLine,  label:'Manuell eintragen',     sub:'Eigene Kalorien & Makros',    action:()=>setView('manual'),  color:'#f59e0b' },
              ].map((opt) => (
                <button key={opt.label} onClick={opt.action} style={btnStyle}
                  className="w-full glass glass-press p-4 flex items-center gap-4 text-left">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background:`${opt.color}18`, border:`1px solid ${opt.color}30` }}>
                    <opt.icon size={20} style={{ color:opt.color }} />
                  </div>
                  <div className="flex-1" style={{ minWidth:0 }}>
                    <p className="text-sm font-black" style={{ color:'var(--text-1)' }}>{opt.label}</p>
                    <p className="text-xs" style={{ color:'var(--text-3)' }}>{opt.sub}</p>
                  </div>
                  <ChevronRight size={15} style={{ color:'var(--text-3)', flexShrink:0 }} />
                </button>
              ))}

              {/* Quick brands */}
              <div className="glass p-4">
                <p className="label mb-3">⭐ Schnellauswahl</p>
                <div className="space-y-2">
                  {BRANDED_PRODUCTS.slice(0,5).map((f) => (
                    <button key={f.id} onClick={() => { pick(f); setView('search') }}
                      className="w-full flex items-center justify-between py-2.5 glass-press"
                      style={{ minWidth:0 }}>
                      <div style={{ minWidth:0 }}>
                        <p className="text-sm font-semibold text-left truncate" style={{ color:'var(--text-1)' }}>{f.name}</p>
                        <p className="text-xs text-left" style={{ color:'var(--text-3)' }}>{f.brand} · {f.serving}g</p>
                      </div>
                      <span className="text-sm font-black flex-shrink-0 ml-2" style={{ color:'var(--gold)' }}>
                        {Math.round(f.macros.calories*(f.serving||100)/100)} kcal
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Voice view */}
          {(view as string) === 'voice' && (
            <div className="py-8 flex flex-col items-center">
              <VoiceInput defaultMealType={mealType} onDone={onClose} />
            </div>
          )}

          {/* Search */}
          {view === 'search' && !selected && (
            <>
              <input autoFocus value={query} onChange={(e)=>handleSearch(e.target.value)}
                style={inputStyle} placeholder="Lebensmittel oder Marke…" />
              {!query && (
                <>
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth:'none' }}>
                    {FOOD_CATEGORIES.map((cat) => (
                      <button key={cat} onClick={() => setActiveCategory(cat)}
                        className="flex-shrink-0 glass-press rounded-2xl px-3 py-2 text-xs font-bold whitespace-nowrap transition-all"
                        style={activeCategory===cat
                          ? { background:'var(--gold-dim)', border:'1px solid rgba(245,158,11,0.3)', color:'var(--gold)' }
                          : { background:'var(--glass)', border:'1px solid var(--glass-border)', color:'var(--text-2)' }
                        }>{cat}</button>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    {categoryFoods.slice(0,20).map((f) => (
                      <button key={f.id} onClick={()=>pick(f)}
                        className="w-full flex items-center justify-between glass glass-press p-3.5"
                        style={{ minWidth:0 }}>
                        <div style={{ minWidth:0 }}>
                          <p className="text-sm font-semibold text-left truncate" style={{ color:'var(--text-1)' }}>{f.name}</p>
                          <p className="text-xs text-left" style={{ color:'var(--text-3)' }}>{f.brand?`${f.brand} · `:''}pro 100g</p>
                        </div>
                        <span className="text-sm font-black flex-shrink-0 ml-2" style={{ color:'var(--gold)' }}>{f.macros.calories} kcal</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {query && (
                <div className="space-y-1.5">
                  {results.map((f) => (
                    <button key={f.id} onClick={()=>pick(f)}
                      className="w-full flex items-center justify-between glass glass-press p-3.5"
                      style={{ minWidth:0 }}>
                      <div style={{ minWidth:0 }}>
                        <p className="text-sm font-semibold text-left truncate" style={{ color:'var(--text-1)' }}>{f.name}</p>
                        <p className="text-xs text-left" style={{ color:'var(--text-3)' }}>{f.brand?`${f.brand} · `:''}pro 100g</p>
                      </div>
                      <span className="text-sm font-black flex-shrink-0 ml-2" style={{ color:'var(--gold)' }}>{f.macros.calories} kcal</span>
                    </button>
                  ))}
                  {results.length===0 && <p className="text-center py-8 text-sm" style={{ color:'var(--text-3)' }}>Keine Ergebnisse</p>}
                </div>
              )}
            </>
          )}

          {/* Amount picker */}
          {view === 'search' && selected && macro && (
            <div className="space-y-4">
              <div className="glass p-4" style={{ background:'rgba(245,158,11,0.05)', borderColor:'rgba(245,158,11,0.15)' }}>
                <p className="font-black" style={{ color:'var(--text-1)' }}>{selected.name}</p>
                {selected.brand && <p className="text-xs mt-0.5" style={{ color:'var(--gold)' }}>{selected.brand}</p>}
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {[['kcal',macro.calories],['E',`${macro.protein}g`],['KH',`${macro.carbs}g`],['F',`${macro.fat}g`]].map(([l,v])=>(
                    <div key={String(l)} className="rounded-2xl py-3 text-center" style={{ background:'var(--glass)', border:'1px solid var(--glass-border)' }}>
                      <p className="text-sm font-black" style={{ color:'var(--text-1)' }}>{v}</p>
                      <p className="text-[10px]" style={{ color:'var(--text-3)' }}>{l}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="label mb-2">Menge</p>
                <div className="flex gap-2 mb-2">
                  {[50,100,150,200,250].map((g)=>(
                    <button key={g} onClick={()=>setAmount(String(g))}
                      className="flex-1 py-3 rounded-2xl text-sm font-bold glass-press transition-all"
                      style={amount===String(g)
                        ? { background:'var(--grad-gold)', color:'#fff' }
                        : { background:'var(--glass)', border:'1px solid var(--glass-border)', color:'var(--text-2)' }
                      }>{g}g</button>
                  ))}
                </div>
                <input type="number" inputMode="decimal" value={amount} onChange={(e)=>setAmount(e.target.value)}
                  style={{ ...inputStyle, textAlign:'center', fontSize:18, fontWeight:800 }} />
              </div>
              <button onClick={addSelected} className="btn-gold w-full py-4 text-base" style={btnStyle}>Hinzufügen</button>
            </div>
          )}

          {/* Barcode */}
          {view === 'barcode' && (
            <div className="space-y-3">
              <div className="glass p-3" style={{ background:'rgba(16,185,129,0.06)', borderColor:'rgba(16,185,129,0.15)' }}>
                <p className="text-xs font-semibold" style={{ color:'var(--text-2)' }}>
                  🔍 Sucht in <strong>Open Food Facts</strong> (3 Mio. Produkte) + <strong>USDA FoodData Central</strong>
                </p>
              </div>
              <div className="flex gap-2">
                <input type="number" inputMode="numeric" value={barcodeVal}
                  onChange={(e)=>{ setBarcodeVal(e.target.value); setBarcodeStatus('idle') }}
                  style={{ ...inputStyle, flex:1 }} placeholder="Barcode-Nummer eingeben…" />
                <button onClick={handleBarcode} disabled={loading||!barcodeVal} className="btn-gold px-5" style={btnStyle}>
                  {loading ? <Loader size={16} className="animate-spin"/> : 'Suchen'}
                </button>
              </div>

              {/* Found */}
              {barcodeStatus==='found' && selected && macro && (
                <div className="glass p-4 space-y-3" style={{ background:'rgba(16,185,129,0.06)', borderColor:'rgba(16,185,129,0.2)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">✅</span>
                    <p className="font-black" style={{ color:'var(--text-1)' }}>{selected.name}</p>
                  </div>
                  {selected.brand && <p className="text-xs" style={{ color:'var(--gold)' }}>{selected.brand}</p>}
                  <div className="flex items-center gap-2">
                    <input type="number" inputMode="decimal" value={amount} onChange={(e)=>setAmount(e.target.value)}
                      className="w-24 text-center" style={{ ...inputStyle, width:96 }} />
                    <span style={{ color:'var(--text-3)' }}>g</span>
                    <span className="ml-auto font-black text-lg" style={{ color:'var(--gold)' }}>{macro.calories} kcal</span>
                  </div>
                  <button onClick={addSelected} className="btn-gold w-full py-3 text-sm" style={btnStyle}>Hinzufügen</button>
                </div>
              )}

              {/* Not found – AI fallback */}
              {barcodeStatus==='notfound' && !selected && (
                <div className="glass p-4 space-y-3" style={{ background:'rgba(239,68,68,0.06)', borderColor:'rgba(239,68,68,0.15)' }}>
                  <div className="flex items-center gap-2">
                    <span>❌</span>
                    <p className="text-sm font-bold" style={{ color:'var(--text-1)' }}>Produkt nicht gefunden</p>
                  </div>
                  <p className="text-xs" style={{ color:'var(--text-3)' }}>
                    Gib den Produktnamen ein – die KI schlägt Nährwerte vor:
                  </p>
                  <div className="flex gap-2">
                    <input value={productNameSuggestion}
                      onChange={(e)=>setProductNameSuggestion(e.target.value)}
                      onKeyDown={(e)=>e.key==='Enter'&&handleAISuggestNutrients()}
                      style={{ ...inputStyle, flex:1 }} placeholder="z.B. Haribo Goldbären 200g" />
                    <button onClick={handleAISuggestNutrients}
                      disabled={loading||!productNameSuggestion.trim()||!apiKeys.anthropic}
                      className="btn-gold px-4 text-xs disabled:opacity-40" style={btnStyle}>
                      {loading ? <Loader size={14} className="animate-spin"/> : '🤖 KI'}
                    </button>
                  </div>
                  {!apiKeys.anthropic && <p className="text-xs" style={{ color:'#ef4444' }}>⚠️ API Key für KI-Vorschläge fehlt</p>}
                  <button onClick={() => setView('manual')}
                    className="w-full py-2.5 rounded-2xl text-sm font-bold glass-press"
                    style={{ color:'var(--text-2)', background:'var(--glass)', border:'1px solid var(--glass-border)' }}>
                    ✏️ Manuell eingeben
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Manual */}
          {view === 'manual' && (
            <div className="space-y-3">
              <input value={manualForm.name} onChange={(e)=>setManualForm({...manualForm,name:e.target.value})}
                style={inputStyle} placeholder="Name des Lebensmittels" />
              <div className="grid grid-cols-2 gap-2">
                {[['Kalorien (kcal) *','cal'],['Eiweiß (g)','protein'],['Kohlenhydrate (g)','carbs'],['Fett (g)','fat']].map(([label,key])=>(
                  <div key={key}>
                    <p className="label mb-1.5">{label}</p>
                    <input type="number" inputMode="decimal"
                      value={manualForm[key as keyof typeof manualForm]}
                      onChange={(e)=>setManualForm({...manualForm,[key]:e.target.value})}
                      style={inputStyle} />
                  </div>
                ))}
              </div>
              <button onClick={saveManual} className="btn-gold w-full py-4 text-base" style={btnStyle}>Eintragen</button>
            </div>
          )}

          {/* Photo */}
          {view === 'photo' && (
            <div className="space-y-3">
              <div className="rounded-2xl p-4" style={{ background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.15)' }}>
                <p className="text-sm font-semibold" style={{ color:'var(--text-1)' }}>KI analysiert deinen Teller automatisch</p>
                <p className="text-xs mt-1" style={{ color:'var(--text-3)' }}>⚠️ Schätzung ±15% · per Sprache korrigierbar</p>
              </div>
              {!photoResult ? (
                <>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e)=>e.target.files?.[0]&&handlePhoto(e.target.files[0])} />
                  <button onClick={()=>fileRef.current?.click()} disabled={loading}
                    className="w-full py-10 rounded-3xl flex flex-col items-center gap-3 glass-press transition-all disabled:opacity-50"
                    style={{ border:'2px dashed rgba(139,92,246,0.3)', background:'rgba(139,92,246,0.05)' }}>
                    {loading ? <><Loader size={32} className="animate-spin" style={{ color:'#8b5cf6' }}/><span style={{ color:'var(--text-2)' }}>Analysiert…</span></>
                      : <><Camera size={36} style={{ color:'#8b5cf6' }}/><span className="font-bold" style={{ color:'var(--text-1)' }}>Foto aufnehmen</span></>}
                  </button>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="glass p-4">
                    <p className="font-black mb-3" style={{ color:'var(--text-1)' }}>🎯 {photoResult.description}</p>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {[['kcal',photoResult.macros.calories,'#f59e0b'],['E',`${photoResult.macros.protein}g`,'#3b82f6'],['KH',`${photoResult.macros.carbs}g`,'#10b981'],['F',`${photoResult.macros.fat}g`,'#ef4444']].map(([l,v,c])=>(
                        <div key={String(l)} className="rounded-2xl py-3 text-center" style={{ background:'var(--glass)' }}>
                          <p className="text-sm font-black" style={{ color:String(c) }}>{v}</p>
                          <p className="text-[10px]" style={{ color:'var(--text-3)' }}>{l}</p>
                        </div>
                      ))}
                    </div>
                    {photoResult.items.length>0 && (
                      <div className="mb-3 space-y-1">
                        {photoResult.items.map((item,i)=>(
                          <div key={i} className="flex justify-between text-xs">
                            <span style={{ color:'var(--text-2)' }}>• {item.name} ({item.amount})</span>
                            <span className="font-bold" style={{ color:'var(--text-1)' }}>{item.calories} kcal</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={()=>{ setPhotoResult(null); setLastCorrection('') }}
                        className="btn-ghost flex items-center gap-1.5 px-4 py-3 text-sm" style={btnStyle}>
                        <RefreshCw size={14}/>Neu
                      </button>
                      <button onClick={savePhoto} className="btn-gold flex-1 py-3 text-sm" style={btnStyle}>Speichern ✓</button>
                    </div>
                  </div>

                  {/* Voice correction */}
                  <div className="glass p-4">
                    <p className="text-sm font-black mb-1" style={{ color:'var(--text-1)' }}>Etwas fehlt? Per Sprache korrigieren</p>
                    <p className="text-xs mb-3" style={{ color:'var(--text-3)' }}>z.B. „Der Käse fehlt" · „Reis war 200g"</p>
                    <button onClick={() => listening ? stopListening() : startListening(handleVoiceCorrection, (err)=>toast.error(err,{duration:8000}))}
                      disabled={correcting||!voiceSupported}
                      className="w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 glass-press transition-all disabled:opacity-50"
                      style={{ background: listening?'#ef4444':correcting?'#8b5cf6':'linear-gradient(135deg,#f59e0b,#3b82f6)', color:'#fff' }}>
                      {correcting ? <><Loader size={16} className="animate-spin"/>KI rechnet nach…</>
                        : listening ? <><MicOff size={16}/>Stoppen</>
                        : <><Mic size={16}/>🎤 Korrektur sprechen</>}
                    </button>
                    {lastCorrection && !listening && !correcting && (
                      <p className="text-xs mt-2 italic text-center" style={{ color:'var(--text-3)' }}>„{lastCorrection}"</p>
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
  const [addingMeal, setAddingMeal]     = useState<MealType|null>(null)
  const [expandedMeal, setExpandedMeal] = useState<MealType>('breakfast')
  const allFoodLogs  = useStore((s) => s.foodLogs)
  const removeFoodLog = useStore((s) => s.removeFoodLog)

  const foodLogs   = useMemo(()=>allFoodLogs.filter((l)=>l.date===today),[allFoodLogs])
  const totalCals  = useMemo(()=>foodLogs.reduce((s,f)=>s+(f.macros?.calories??0),0),[foodLogs])
  const totalProt  = useMemo(()=>foodLogs.reduce((s,f)=>s+(f.macros?.protein??0),0),[foodLogs])
  const totalCarbs = useMemo(()=>foodLogs.reduce((s,f)=>s+(f.macros?.carbs??0),0),[foodLogs])
  const totalFat   = useMemo(()=>foodLogs.reduce((s,f)=>s+(f.macros?.fat??0),0),[foodLogs])

  return (
    <div className="pb-nav anim-fade overflow-x-hidden" style={{ background:'var(--bg)' }}>
      {/* Header */}
      <div className="pt-safe px-5 pb-5" style={{ background:'linear-gradient(160deg,var(--bg-2),var(--bg))' }}>
        <h1 className="text-2xl font-black mb-1" style={{ color:'var(--text-1)' }}>Essen tracken</h1>
        <p className="text-sm mb-4" style={{ color:'var(--text-3)' }}>Heute: {Math.round(totalCals)} kcal</p>
        <div className="flex gap-2">
          {[{ l:'Eiweiß',c:'#3b82f6',v:Math.round(totalProt)},{l:'Kohlenhydrate',c:'#f59e0b',v:Math.round(totalCarbs)},{l:'Fett',c:'#ef4444',v:Math.round(totalFat)}].map((m)=>(
            <div key={m.l} className="flex-1 glass-sm py-2.5 text-center" style={{ minWidth:0 }}>
              <p className="text-base font-black" style={{ color:m.c }}>{m.v}g</p>
              <p className="text-[10px]" style={{ color:'var(--text-3)' }}>{m.l}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {MEALS.map((meal) => {
          const logs = foodLogs.filter((l)=>l.mealType===meal.id)
          const cals = logs.reduce((s,l)=>s+(l.macros?.calories??0),0)
          const open = expandedMeal===meal.id
          return (
            <div key={meal.id} className="glass overflow-hidden">
              <button className="w-full flex items-center gap-3 p-4 glass-press"
                onClick={()=>setExpandedMeal(open?'breakfast':meal.id)}>
                <span className="text-2xl flex-shrink-0">{meal.emoji}</span>
                <div className="flex-1 text-left" style={{ minWidth:0 }}>
                  <p className="text-sm font-black" style={{ color:'var(--text-1)' }}>{meal.label}</p>
                  <p className="text-xs" style={{ color:'var(--text-3)' }}>{logs.length} Einträge · {Math.round(cals)} kcal</p>
                </div>
                <button onClick={(e)=>{ e.stopPropagation(); setAddingMeal(meal.id) }}
                  className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background:'var(--gold-dim)', border:'1px solid rgba(245,158,11,0.2)' }}>
                  <Plus size={17} style={{ color:'var(--gold)' }} />
                </button>
              </button>
              {open && (
                <div className="px-4 pb-3 space-y-2" style={{ borderTop:'1px solid var(--glass-border)' }}>
                  {logs.length>0 ? logs.map((log)=>(
                    <div key={log.id} className="flex items-center gap-3 py-2">
                      <div className="flex-1" style={{ minWidth:0 }}>
                        <p className="text-sm font-semibold truncate" style={{ color:'var(--text-1)' }}>{log.foodItem.name}</p>
                        <p className="text-xs" style={{ color:'var(--text-3)' }}>{log.amount}g{log.aiEstimated?' · 🤖':''}</p>
                      </div>
                      <p className="text-sm font-black flex-shrink-0 mr-2" style={{ color:'var(--gold)' }}>{log.macros.calories} kcal</p>
                      <button onClick={()=>removeFoodLog(log.id)} className="glass-press p-1 flex-shrink-0">
                        <Trash2 size={14} style={{ color:'var(--text-3)' }} />
                      </button>
                    </div>
                  )) : (
                    <div className="py-4 text-center">
                      <p className="text-sm mb-2" style={{ color:'var(--text-3)' }}>Noch nichts</p>
                      <button onClick={()=>setAddingMeal(meal.id)}
                        className="text-sm font-bold px-4 py-2 rounded-2xl glass-press"
                        style={{ color:'var(--gold)', background:'var(--gold-dim)', border:'1px solid rgba(245,158,11,0.2)' }}>
                        + Hinzufügen
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {addingMeal && <AddSheet mealType={addingMeal} onClose={()=>setAddingMeal(null)} />}
    </div>
  )
}
