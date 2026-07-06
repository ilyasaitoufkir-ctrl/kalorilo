import { useState, useRef } from 'react'
import { Camera, ChevronLeft, X, Loader, Check, ChevronRight, Trash2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import { analyzeBodyPhoto } from '../utils/api'
import { imageToBase64, imageFileToDataUrl, uid } from '../utils/calculations'
import type { BodyAnalysis } from '../types'
import toast from 'react-hot-toast'

interface Props {
  onClose: () => void
}

type Step = 'instructions' | 'capture' | 'analyzing' | 'result' | 'timeline'

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: '#f0f4f1', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${(value / 10) * 100}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 800, color, minWidth: 24 }}>{value}</span>
    </div>
  )
}

function BodyTypeTag({ type }: { type: string }) {
  const colors: Record<string, string> = {
    Ektomorph: '#60a5fa',
    Mesomorph: '#4a8c5c',
    Endomorph: '#f59e0b',
  }
  const color = colors[type] ?? '#7db88a'
  return (
    <span style={{
      background: `${color}22`,
      border: `1px solid ${color}55`,
      color, borderRadius: 10, padding: '3px 10px',
      fontSize: 12, fontWeight: 700,
    }}>{type}</span>
  )
}

function ResultCard({ analysis, photo, weight, date }: { analysis: BodyAnalysis; photo?: string; weight?: number; date?: string }) {
  const muscleColor = analysis.muscleScore >= 8 ? '#10b981' : analysis.muscleScore >= 6 ? '#22c55e' : analysis.muscleScore >= 4 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Photo + stats row */}
      <div style={{ display: 'flex', gap: 12 }}>
        {photo && (
          <div style={{ width: 90, height: 120, borderRadius: 16, overflow: 'hidden', flexShrink: 0 }}>
            <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: '#1a2e1f', fontSize: 20, fontWeight: 900 }}>{analysis.bodyFatRange}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Körperfett</span>
          </div>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>MUSKEL-SCORE</div>
            <ScoreBar value={analysis.muscleScore} color={muscleColor} />
          </div>
          <BodyTypeTag type={analysis.bodyType} />
          {weight && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{weight} kg · {date}</span>}
        </div>
      </div>

      {/* Strengths */}
      {analysis.strengths.length > 0 && (
        <div style={{ background: '#e8f2ec', border: '1px solid rgba(74,140,92,0.25)', borderRadius: 14, padding: '12px 14px' }}>
          <div style={{ color: '#7db88a', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>💪 STÄRKEN</div>
          {analysis.strengths.map((s, i) => (
            <div key={i} style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, display: 'flex', gap: 6, marginBottom: 3 }}>
              <span style={{ color: '#4a8c5c' }}>✓</span> {s}
            </div>
          ))}
        </div>
      )}

      {/* Improvements */}
      {analysis.improvements.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 14, padding: '12px 14px' }}>
          <div style={{ color: '#f59e0b', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>🎯 VERBESSERUNGSBEREICHE</div>
          {analysis.improvements.map((s, i) => (
            <div key={i} style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, display: 'flex', gap: 6, marginBottom: 3 }}>
              <span style={{ color: '#f59e0b' }}>→</span> {s}
            </div>
          ))}
        </div>
      )}

      {/* Recommendation */}
      {analysis.recommendation && (
        <div style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 14, padding: '12px 14px' }}>
          <div style={{ color: '#60a5fa', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>💡 EMPFEHLUNG</div>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 1.5, margin: 0 }}>{analysis.recommendation}</p>
        </div>
      )}
    </div>
  )
}

export default function BodyScanScreen({ onClose }: Props) {
  const profile = useStore((s) => s.profile)
  const apiKeys = useStore((s) => s.apiKeys)
  const beforeAfterPhotos = useStore((s) => s.beforeAfterPhotos)
  const addBeforeAfterPhoto = useStore((s) => s.addBeforeAfterPhoto)
  const removeBeforeAfterPhoto = useStore((s) => s.removeBeforeAfterPhoto)

  const [step, setStep] = useState<Step>('instructions')
  const [preview, setPreview] = useState<string | null>(null)
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<BodyAnalysis | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const apiKey = apiKeys.anthropic

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!apiKey) { toast.error('Kein Anthropic API Key → Profil → API Keys'); return }

    try {
      const [b64, url] = await Promise.all([imageToBase64(file), imageFileToDataUrl(file)])
      setPreview(b64)
      setDataUrl(url)
      setStep('analyzing')

      const activityMap: Record<string, number> = { sedentary: 1, light: 2, moderate: 3, active: 5, very_active: 6 }
      const result = await analyzeBodyPhoto(b64, apiKey, {
        weight: profile?.weight,
        height: profile?.height,
        trainingFrequency: profile ? activityMap[profile.activityLevel] ?? 3 : undefined,
        goal: profile?.goal,
      })
      setAnalysis(result)
      setStep('result')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analyse fehlgeschlagen')
      setStep('capture')
      setPreview(null)
    }
    e.target.value = ''
  }

  function handleSave() {
    if (!analysis || !dataUrl) return
    const today = new Date().toISOString().split('T')[0]
    addBeforeAfterPhoto({
      id: uid(),
      date: today,
      photo: dataUrl,
      weight: profile?.weight,
      analysis,
    })
    toast.success('Scan gespeichert! 📸')
    setStep('timeline')
  }

  // ── INSTRUCTIONS ─────────────────────────────────────────────────────────
  if (step === 'instructions') return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'linear-gradient(160deg, #0a1f0e, #1a2e1f)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 'max(env(safe-area-inset-top),20px) 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onClose} style={{ background: '#f0f4f1', border: 'none', borderRadius: 12, padding: 10, cursor: 'pointer' }}>
          <ChevronLeft size={20} color="#fff" />
        </button>
        <h1 style={{ color: '#1a2e1f', fontSize: 20, fontWeight: 900, margin: 0 }}>Körper Scan 📸</h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Hero icon */}
        <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
          <div style={{
            width: 100, height: 100, borderRadius: 30, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #4a8c5c, #2d5c3a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 40px rgba(74,140,92,0.4)',
          }}>
            <span style={{ fontSize: 48 }}>🏋️</span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
            KI analysiert dein Körperfoto und schätzt<br />Körperfett, Muskelverteilung & Body Type
          </p>
        </div>

        {/* Instructions */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #e8f0ea', borderRadius: 20, padding: '18px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ color: '#c8e6c9', fontSize: 13, fontWeight: 700, letterSpacing: '0.05em' }}>FÜR BESTE ERGEBNISSE</div>
          {[
            { icon: '📏', text: 'Stell dich ca. 2m vom Spiegel auf' },
            { icon: '📸', text: 'Ganzkörper-Foto machen (Kopf bis Fuß)' },
            { icon: '💡', text: 'Gutes, gleichmäßiges Licht wichtig' },
            { icon: '👕', text: 'Eng anliegende Kleidung oder wenig Kleidung' },
            { icon: '🧍', text: 'Frontal oder seitlich stehen' },
          ].map(({ icon, text }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 22, width: 32, flexShrink: 0 }}>{icon}</span>
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: 14, padding: '12px 14px' }}>
          <p style={{ color: 'rgba(245,158,11,0.9)', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
            ⚠️ Alle Ergebnisse sind visuelle Schätzungen der KI und kein medizinischer Rat.
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={() => setStep('capture')}
          style={{
            padding: '16px', borderRadius: 18, border: 'none',
            background: 'linear-gradient(135deg, #4a8c5c, #2d5c3a)',
            color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(74,140,92,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          <Camera size={20} /> Weiter zum Foto
        </button>

        {/* Timeline shortcut */}
        {beforeAfterPhotos.length > 0 && (
          <button
            onClick={() => setStep('timeline')}
            style={{
              padding: '14px', borderRadius: 16, border: '1px solid #d0e0d4',
              background: 'rgba(255,255,255,0.04)',
              color: '#7db88a', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            📅 Meine {beforeAfterPhotos.length} gespeicherten Scans
          </button>
        )}
      </div>
    </div>
  )

  // ── CAPTURE ───────────────────────────────────────────────────────────────
  if (step === 'capture') return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(26,46,31,0.4)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 32 }}>
      <div style={{ width: 88, height: 88, borderRadius: 26, background: 'linear-gradient(135deg, #4a8c5c, #2d5c3a)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(74,140,92,0.4)' }}>
        <Camera size={40} color="#fff" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ color: '#1a2e1f', fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>Foto aufnehmen</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: 0 }}>Ganzkörper · Gutes Licht · 2m Abstand</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320 }}>
        <button
          onClick={() => fileRef.current?.click()}
          style={{ padding: '16px 24px', borderRadius: 18, border: 'none', background: 'linear-gradient(135deg, #4a8c5c, #2d5c3a)', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer', boxShadow: '0 4px 20px rgba(74,140,92,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
        >
          <Camera size={20} /> Kamera öffnen
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="user" onChange={handlePhoto} style={{ display: 'none' }} />

        <button
          onClick={() => {
            const inp = document.createElement('input')
            inp.type = 'file'; inp.accept = 'image/*'
            inp.onchange = (e) => handlePhoto(e as any)
            inp.click()
          }}
          style={{ padding: '14px 24px', borderRadius: 18, border: '1.5px solid rgba(255,255,255,0.2)', background: '#f8faf8', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
        >
          Aus Galerie wählen
        </button>
      </div>

      <button onClick={() => setStep('instructions')} style={{ padding: '12px 28px', borderRadius: 14, border: '1px solid #e8f0ea', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontWeight: 600 }}>
        Zurück
      </button>
    </div>
  )

  // ── ANALYZING ─────────────────────────────────────────────────────────────
  if (step === 'analyzing') return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(26,46,31,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
      {preview && (
        <div style={{ width: 160, height: 210, borderRadius: 20, overflow: 'hidden', opacity: 0.4 }}>
          <img src={`data:image/jpeg;base64,${preview}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}
      <Loader size={44} color="#4a8c5c" style={{ animation: 'spin 1s linear infinite' }} />
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#1a2e1f', fontSize: 18, fontWeight: 800, margin: '0 0 6px' }}>KI analysiert dein Foto…</p>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: 0 }}>Körperfett · Muskelverteilung · Body Type</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  // ── RESULT ────────────────────────────────────────────────────────────────
  if (step === 'result' && analysis) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'linear-gradient(160deg, #0a1f0e, #1a2e1f)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 'max(env(safe-area-inset-top),20px) 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ color: '#1a2e1f', fontSize: 20, fontWeight: 900, margin: 0 }}>Ergebnis 🎯</h1>
        <button onClick={onClose} style={{ background: '#f0f4f1', border: 'none', borderRadius: 12, padding: 10, cursor: 'pointer' }}>
          <X size={18} color="rgba(255,255,255,0.6)" />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        <ResultCard analysis={analysis} photo={dataUrl ?? undefined} weight={profile?.weight} date={new Date().toLocaleDateString('de-DE')} />
      </div>

      <div style={{ padding: '14px 16px max(env(safe-area-inset-bottom),24px)', borderTop: '1px solid #e8f0ea', background: 'rgba(10,31,14,0.95)', display: 'flex', gap: 10 }}>
        <button
          onClick={() => { setStep('capture'); setPreview(null); setAnalysis(null) }}
          style={{ padding: '14px 16px', borderRadius: 16, border: '1px solid #e8f0ea', background: '#f8faf8', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
        >
          <Camera size={16} /> Neu
        </button>
        <button
          onClick={handleSave}
          style={{ flex: 1, padding: '14px 20px', borderRadius: 16, border: 'none', background: 'linear-gradient(135deg, #4a8c5c, #2d5c3a)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 20px rgba(74,140,92,0.4)' }}
        >
          <Check size={20} /> Speichern <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )

  // ── TIMELINE ──────────────────────────────────────────────────────────────
  const sorted = [...beforeAfterPhotos].sort((a, b) => a.date.localeCompare(b.date))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'linear-gradient(160deg, #0a1f0e, #1a2e1f)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 'max(env(safe-area-inset-top),20px) 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onClose} style={{ background: '#f0f4f1', border: 'none', borderRadius: 12, padding: 10, cursor: 'pointer' }}>
          <X size={18} color="#fff" />
        </button>
        <h1 style={{ color: '#1a2e1f', fontSize: 20, fontWeight: 900, margin: 0 }}>Verlauf 📅</h1>
        <button
          onClick={() => setStep('instructions')}
          style={{ marginLeft: 'auto', background: 'linear-gradient(135deg, #4a8c5c, #2d5c3a)', border: 'none', borderRadius: 12, padding: '8px 14px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Camera size={14} /> Neuer Scan
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px max(env(safe-area-inset-bottom),24px)' }}>
        {sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: 'rgba(255,255,255,0.4)' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📸</div>
            <p style={{ fontSize: 15, fontWeight: 600 }}>Noch kein Scan gespeichert</p>
            <p style={{ fontSize: 13 }}>Mach deinen ersten Körper-Scan!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Before / After comparison */}
            {sorted.length >= 2 && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #e8f0ea', borderRadius: 20, padding: 16 }}>
                <div style={{ color: '#c8e6c9', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 12 }}>VORHER / NACHHER</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[first, last].map((p, i) => p && (
                    <div key={p.id}>
                      <div style={{ borderRadius: 14, overflow: 'hidden', aspectRatio: '3/4', marginBottom: 6 }}>
                        <img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, textAlign: 'center' }}>
                        {i === 0 ? 'Vorher' : 'Aktuell'} · {new Date(p.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
                      </div>
                      {p.analysis && (
                        <div style={{ textAlign: 'center', marginTop: 4 }}>
                          <span style={{ color: '#7db88a', fontSize: 13, fontWeight: 800 }}>{p.analysis.bodyFatRange}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {first?.analysis && last?.analysis && first.date !== last.date && (
                  <div style={{ marginTop: 12, padding: '10px 12px', background: '#e8f2ec', borderRadius: 12, textAlign: 'center' }}>
                    <span style={{ color: '#7db88a', fontSize: 13, fontWeight: 700 }}>
                      📈 Fortschritt seit {new Date(first.date).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* All scans */}
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em' }}>ALLE SCANS ({sorted.length})</div>
            {sorted.slice().reverse().map((photo) => (
              <div key={photo.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #e8f0ea', borderRadius: 20, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
                    {new Date(photo.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                  <button onClick={() => removeBeforeAfterPhoto(photo.id)} style={{ background: 'rgba(239,68,68,0.12)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#ef4444' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                {photo.analysis ? (
                  <ResultCard analysis={photo.analysis} photo={photo.photo} weight={photo.weight} />
                ) : (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 80, height: 106, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
                      <img src={photo.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div>
                      {photo.weight && <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: '0 0 4px' }}>{photo.weight} kg</p>}
                      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, margin: 0 }}>Keine KI-Analyse</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
