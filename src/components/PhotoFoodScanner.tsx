import { useState, useRef } from 'react'
import { Camera, Check, X, Plus, Trash2, ChevronRight, AlertCircle, Loader, RotateCcw } from 'lucide-react'
import { useStore } from '../store/useStore'
import { analyzePlateDetailed } from '../utils/api'
import { imageToBase64 } from '../utils/calculations'
import type { PlateIngredient, DetailedPlateAnalysis, MealType } from '../types'
import toast from 'react-hot-toast'

interface Props {
  mealType: MealType
  onConfirm: (items: { name: string; amount: number; calories: number; protein: number; fat: number; carbs: number }[], description: string) => void
  onClose: () => void
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = value >= 0.85 ? '#22c55e' : value >= 0.60 ? '#f59e0b' : '#ef4444'
  const label = value >= 0.85 ? '🟢 Sicher' : value >= 0.60 ? '🟡 Unsicher' : '🔴 Sehr unsicher'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color, minWidth: 80 }}>{pct}% {label}</span>
    </div>
  )
}

type RefObject = 'hand' | 'fork' | 'none'

export default function PhotoFoodScanner({ onConfirm, onClose }: Props) {
  const apiKeys = useStore((s) => s.apiKeys)
  const portionHistory = useStore((s) => s.portionHistory)
  const updatePortionHistory = useStore((s) => s.updatePortionHistory)

  const [step, setStep] = useState<'reference' | 'capture' | 'analyzing' | 'review'>('reference')
  const [refObject, setRefObject] = useState<RefObject>('hand')
  const [preview, setPreview] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<DetailedPlateAnalysis | null>(null)
  const [ingredients, setIngredients] = useState<PlateIngredient[]>([])
  const [addingName, setAddingName] = useState('')
  const [addingWeight, setAddingWeight] = useState(100)
  const [showAddForm, setShowAddForm] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const apiKey = apiKeys.anthropic || apiKeys.openai

  const total = ingredients.reduce(
    (acc, i) => ({
      calories: acc.calories + Math.round(i.calories * i.weight_g / (i.weight_g || 1)),
      protein:  acc.protein  + Math.round(i.protein  * i.weight_g / (i.weight_g || 1)),
      carbs:    acc.carbs    + Math.round(i.carbs    * i.weight_g / (i.weight_g || 1)),
      fat:      acc.fat      + Math.round(i.fat      * i.weight_g / (i.weight_g || 1)),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!apiKey) { toast.error('Kein API Key → Profil → API Keys'); return }
    try {
      const b64 = await imageToBase64(file)
      setPreview(b64)
      setStep('analyzing')
      const result = await analyzePlateDetailed(b64, portionHistory, apiKey, refObject)
      setAnalysis(result)
      setIngredients(result.ingredients)
      setStep('review')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analyse fehlgeschlagen')
      setStep('capture')
      setPreview(null)
    }
    e.target.value = ''
  }

  function updateWeight(idx: number, newWeight: number) {
    setIngredients((prev) => prev.map((ing, i) => {
      if (i !== idx) return ing
      const ratio = newWeight / (ing.weight_g || 1)
      return {
        ...ing,
        weight_g: newWeight,
        calories: Math.round(ing.calories * ratio),
        protein:  Math.round(ing.protein  * ratio * 10) / 10,
        carbs:    Math.round(ing.carbs    * ratio * 10) / 10,
        fat:      Math.round(ing.fat      * ratio * 10) / 10,
      }
    }))
  }

  function removeIngredient(idx: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== idx))
  }

  function addIngredient() {
    if (!addingName.trim()) return
    setIngredients((prev) => [...prev, {
      name: addingName.trim(),
      weight_g: addingWeight,
      calories: Math.round(addingWeight * 1.5),
      protein: Math.round(addingWeight * 0.1),
      carbs: Math.round(addingWeight * 0.15),
      fat: Math.round(addingWeight * 0.05),
      confidence: 0.4,
    }])
    setAddingName('')
    setAddingWeight(100)
    setShowAddForm(false)
  }

  function handleConfirm() {
    const items = ingredients.map((i) => ({
      name: i.name,
      amount: i.weight_g,
      calories: i.calories,
      protein: i.protein,
      fat: i.fat,
      carbs: i.carbs,
    }))
    // Learn portion sizes
    ingredients.forEach((i) => { if (i.confidence >= 0.6) updatePortionHistory(i.name, i.weight_g) })
    onConfirm(items, analysis?.dish ?? 'Gericht vom Foto')
    toast.success('Mahlzeit gespeichert! 📸')
  }

  // ── REFERENCE OBJECT SELECTION ────────────────────────────────────────
  if (step === 'reference') return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 32 }}>
        <div style={{
          width: 84, height: 84, borderRadius: 24,
          background: 'linear-gradient(135deg, #4a8c5c, #2d5c3a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(74,140,92,0.4)',
        }}>
          <Camera size={38} color="#fff" />
        </div>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>Referenzobjekt wählen</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            So schätzt Kalo die Portionsgröße<br />deutlich genauer ein
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 320 }}>
          {([
            { id: 'hand' as RefObject, emoji: '🖐️', label: 'Hand', desc: 'ca. 18cm Breite' },
            { id: 'fork' as RefObject, emoji: '🍴', label: 'Gabel', desc: 'ca. 19cm lang' },
            { id: 'none' as RefObject, emoji: '❌', label: 'Keines', desc: 'ohne Referenz' },
          ] as const).map(({ id, emoji, label, desc }) => {
            const active = refObject === id
            return (
              <button
                key={id}
                onClick={() => setRefObject(id)}
                style={{
                  flex: 1, padding: '14px 8px', borderRadius: 18,
                  border: active ? '2px solid #4a8c5c' : '1.5px solid rgba(255,255,255,0.12)',
                  background: active ? 'rgba(74,140,92,0.18)' : 'rgba(255,255,255,0.04)',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize: 26 }}>{emoji}</span>
                <span style={{ color: active ? '#c8e6c9' : '#fff', fontWeight: 700, fontSize: 13 }}>{label}</span>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{desc}</span>
              </button>
            )
          })}
        </div>

        {refObject !== 'none' && (
          <div style={{
            background: 'rgba(74,140,92,0.1)', border: '1px solid rgba(74,140,92,0.25)',
            borderRadius: 14, padding: '12px 16px', maxWidth: 320, width: '100%',
          }}>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, margin: 0, lineHeight: 1.6 }}>
              💡 Lege deine <strong style={{ color: '#7db88a' }}>{refObject === 'hand' ? 'Hand 🖐️' : 'Gabel 🍴'}</strong> neben den Teller, bevor du das Foto machst. Kalo nutzt sie als Maßstab.
            </p>
          </div>
        )}

        <button
          onClick={() => setStep('capture')}
          style={{
            padding: '16px 32px', borderRadius: 18, border: 'none',
            background: 'linear-gradient(135deg, #4a8c5c, #2d5c3a)',
            color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(74,140,92,0.4)',
            display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 320, justifyContent: 'center',
          }}
        >
          Weiter → Foto aufnehmen
        </button>
      </div>

      <button onClick={onClose} style={{
        margin: '0 24px max(24px, env(safe-area-inset-bottom)) 24px',
        padding: '14px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer',
      }}>
        Abbrechen
      </button>
    </div>
  )

  // ── CAPTURE ────────────────────────────────────────────────────────────
  if (step === 'capture') return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24, padding: 32,
      }}>
        <div style={{
          width: 96, height: 96, borderRadius: 28,
          background: 'linear-gradient(135deg, #4a8c5c, #2d5c3a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(74,140,92,0.4)',
        }}>
          <Camera size={44} color="#fff" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>
            Foto analysieren
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
            Kalo erkennt alle Zutaten,{'\n'}schätzt Portionen & zeigt Konfidenz
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320 }}>
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              padding: '16px 24px', borderRadius: 18, border: 'none',
              background: 'linear-gradient(135deg, #4a8c5c, #2d5c3a)',
              color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(74,140,92,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            <Camera size={20} /> Foto aufnehmen
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />

          <button
            onClick={() => {
              const inp = document.createElement('input')
              inp.type = 'file'; inp.accept = 'image/*'
              inp.onchange = (e) => handlePhoto(e as any)
              inp.click()
            }}
            style={{
              padding: '14px 24px', borderRadius: 18,
              border: '1.5px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
            }}
          >
            Aus Galerie wählen
          </button>
        </div>

        {refObject !== 'none' && (
          <div style={{
            background: 'rgba(74,140,92,0.12)', border: '1px solid rgba(74,140,92,0.3)',
            borderRadius: 14, padding: '12px 16px', maxWidth: 320, width: '100%',
          }}>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, margin: 0, lineHeight: 1.5, fontWeight: 600 }}>
              {refObject === 'hand' ? '🖐️ Hand' : '🍴 Gabel'} neben den Teller legen – dann Foto machen!
            </p>
          </div>
        )}

        <button onClick={() => setStep('reference')} style={{
          background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 12,
        }}>
          Referenz ändern
        </button>
      </div>

      <button onClick={onClose} style={{
        margin: '0 24px max(24px, env(safe-area-inset-bottom)) 24px',
        padding: '14px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.15)',
        background: 'rgba(255,255,255,0.06)', color: '#fff', fontWeight: 700, cursor: 'pointer',
      }}>
        Abbrechen
      </button>
    </div>
  )

  // ── ANALYZING ─────────────────────────────────────────────────────────
  if (step === 'analyzing') return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24,
    }}>
      {preview && (
        <div style={{ width: 200, height: 200, borderRadius: 20, overflow: 'hidden', opacity: 0.5 }}>
          <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}
      <Loader size={40} color="#4a8c5c" style={{ animation: 'spin 1s linear infinite' }} />
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: '0 0 6px' }}>
          Kalo analysiert dein Essen…
        </p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: 0 }}>
          Zutaten erkennen · Portionen schätzen · Kalorien berechnen
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  // ── REVIEW ────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#111', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: 'max(env(safe-area-inset-top),16px) 20px 16px',
        background: 'rgba(17,17,17,0.97)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: 0 }}>
            {analysis?.dish ?? 'Gericht'}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '2px 0 0' }}>
            Kalorien anpassen · dann bestätigen
          </p>
        </div>
        <button onClick={() => { setStep('capture'); setPreview(null) }} style={{
          background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 12,
          padding: '8px 12px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600,
        }}>
          <RotateCcw size={14} /> Neu
        </button>
      </div>

      {/* Overall confidence + accuracy */}
      {analysis && (
        <div style={{
          margin: '12px 16px 0',
          background: 'rgba(74,140,92,0.1)', border: '1px solid rgba(74,140,92,0.25)',
          borderRadius: 12, padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AlertCircle size={16} color="#7db88a" />
          <div style={{ flex: 1 }}>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Genauigkeit: </span>
            <span style={{ color: '#7db88a', fontWeight: 700, fontSize: 12 }}>
              ±{Math.round((1 - analysis.confidence_overall) * 20 + 5)}%
            </span>
            {refObject !== 'none' && (
              <span style={{ color: '#4a8c5c', fontWeight: 600, fontSize: 11 }}>
                {' '}· Referenz: {refObject === 'hand' ? '🖐️ Hand' : '🍴 Gabel'}
              </span>
            )}
            {analysis.notes ? <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}> · {analysis.notes}</span> : null}
          </div>
        </div>
      )}

      {/* Ingredient list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ingredients.map((ing, idx) => (
          <div key={idx} style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{ing.name}</span>
              <button onClick={() => removeIngredient(idx)} style={{
                background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 8,
                padding: '4px 8px', cursor: 'pointer', color: '#ef4444',
              }}>
                <Trash2 size={14} />
              </button>
            </div>

            <ConfidenceBar value={ing.confidence} />

            {/* Weight slider */}
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Menge</span>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{ing.weight_g}g · {ing.calories} kcal</span>
              </div>
              <input
                type="range" min={10} max={600} step={5} value={ing.weight_g}
                onChange={(e) => updateWeight(idx, Number(e.target.value))}
                style={{ width: '100%', accentColor: '#4a8c5c' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>10g</span>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                  P {ing.protein}g · F {ing.fat}g · KH {ing.carbs}g
                </span>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>600g</span>
              </div>
            </div>
          </div>
        ))}

        {/* Add ingredient form */}
        {showAddForm ? (
          <div style={{
            background: 'rgba(74,140,92,0.08)', border: '1px solid rgba(74,140,92,0.25)',
            borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <input
              placeholder="Zutat eingeben…"
              value={addingName}
              onChange={(e) => setAddingName(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 14,
                outline: 'none',
              }}
            />
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Menge</span>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{addingWeight}g</span>
              </div>
              <input type="range" min={10} max={600} step={5} value={addingWeight}
                onChange={(e) => setAddingWeight(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#4a8c5c' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowAddForm(false)} style={{
                flex: 1, padding: '10px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)',
                background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontWeight: 600,
              }}>Abbrechen</button>
              <button onClick={addIngredient} style={{
                flex: 2, padding: '10px', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #4a8c5c, #2d5c3a)',
                color: '#fff', cursor: 'pointer', fontWeight: 700,
              }}>Hinzufügen</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddForm(true)} style={{
            padding: '12px', borderRadius: 14,
            border: '1.5px dashed rgba(74,140,92,0.4)', background: 'transparent',
            color: '#7db88a', cursor: 'pointer', fontWeight: 700, fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Plus size={16} /> Zutat hinzufügen
          </button>
        )}
      </div>

      {/* Total + Confirm */}
      <div style={{
        padding: '16px 16px max(env(safe-area-inset-bottom),24px)',
        background: 'rgba(17,17,17,0.97)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}>
        {/* Macro summary */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14,
        }}>
          {[
            { label: 'Kalorien', value: total.calories, unit: 'kcal', color: '#f59e0b' },
            { label: 'Eiweiß', value: total.protein, unit: 'g', color: '#4a8c5c' },
            { label: 'Fett', value: total.fat, unit: 'g', color: '#8b5cf6' },
            { label: 'Kohlenhydrate', value: total.carbs, unit: 'g', color: '#3b82f6' },
          ].map(({ label, value, unit, color }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '10px 8px', textAlign: 'center',
            }}>
              <div style={{ color, fontWeight: 800, fontSize: 16 }}>{value}</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: 600 }}>{unit}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            padding: '14px 18px', borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600,
          }}>
            <X size={18} /> Verwerfen
          </button>
          <button onClick={handleConfirm} disabled={ingredients.length === 0} style={{
            flex: 1, padding: '14px 20px', borderRadius: 16, border: 'none',
            background: ingredients.length > 0
              ? 'linear-gradient(135deg, #4a8c5c, #2d5c3a)'
              : 'rgba(255,255,255,0.08)',
            color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: ingredients.length > 0 ? '0 4px 20px rgba(74,140,92,0.4)' : 'none',
          }}>
            <Check size={20} /> Bestätigen & speichern
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
