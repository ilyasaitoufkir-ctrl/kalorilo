import { useState, useMemo, useRef } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Scale, Camera, X, Loader } from 'lucide-react'
import { useStore } from '../store/useStore'
import { getLast7Days, getLast30Days, formatDate, getDayName, uid, imageFileToDataUrl, imageToBase64 } from '../utils/calculations'
import { analyzeBodyPhoto } from '../utils/api'
import toast from 'react-hot-toast'

const today = formatDate()

export default function Statistics() {
  const [activeTab, setActiveTab] = useState<'week'|'weight'|'body'|'photos'>('week')
  const [newWeight, setNewWeight]     = useState('')
  const [showInput, setShowInput]     = useState(false)
  // Body tracking
  const [bodyAnalyzing, setBodyAnalyzing] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<string|null>(null)
  const bodyFileRef = useRef<HTMLInputElement>(null)

  const weightHistory       = useStore((s) => s.weightHistory)
  const addWeightEntry         = useStore((s) => s.addWeightEntry)
  const profile                = useStore((s) => s.profile)
  const foodLogs               = useStore((s) => s.foodLogs)
  const activityLogs           = useStore((s) => s.activityLogs)
  const beforeAfterPhotos      = useStore((s) => s.beforeAfterPhotos)
  const addBeforeAfterPhoto    = useStore((s) => s.addBeforeAfterPhoto)
  const removeBeforeAfterPhoto = useStore((s) => s.removeBeforeAfterPhoto)
  const getStatsForDate        = useStore((s) => s.getStatsForDate)
  const apiKeys                = useStore((s) => s.apiKeys)

  const analyzePhoto = async (file: File) => {
    if (!apiKeys.anthropic) { toast.error('Anthropic API Key fehlt → Profil → API Keys'); return }
    setBodyAnalyzing(true)
    try {
      const b64      = await imageToBase64(file)
      const dataUrl  = await imageFileToDataUrl(file)
      const analysis = await analyzeBodyPhoto(b64, apiKeys.anthropic)
      addBeforeAfterPhoto({ id: uid(), date: today, photo: dataUrl, weight: profile?.weight, analysis })
      toast.success('Foto analysiert! 🎯')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler', { duration: 5000 })
    }
    setBodyAnalyzing(false)
  }

  const last7  = useMemo(() => getLast7Days(), [])
  const last30 = useMemo(() => getLast30Days(), [])

  const weekData = useMemo(() => last7.map((date) => {
    const c = foodLogs.filter((l)=>l.date===date).reduce((s,f)=>s+(f.macros?.calories??0),0)
    const b = activityLogs.filter((l)=>l.date===date).reduce((s,a)=>s+a.caloriesBurned,0)
    const p = foodLogs.filter((l)=>l.date===date).reduce((s,f)=>s+(f.macros?.protein??0),0)
    return { day:getDayName(date), calories:Math.round(c), burned:Math.round(b), protein:Math.round(p) }
  }), [foodLogs, activityLogs, last7])

  const weightData = useMemo(() => weightHistory.slice(-30).map((w) => ({ date:w.date.slice(5), weight:w.weight })), [weightHistory])

  const totalDays = useMemo(() => last30.filter((d) => foodLogs.some((l)=>l.date===d)).length, [last30, foodLogs])
  const goalDays  = useMemo(() => last30.filter((d) => getStatsForDate(d).goalMet).length, [last30, getStatsForDate])
  const avgCals   = useMemo(() => {
    const days = last7.filter((d) => foodLogs.some((l)=>l.date===d))
    if (!days.length) return 0
    return Math.round(days.reduce((s,d)=>s+foodLogs.filter((l)=>l.date===d).reduce((s2,f)=>s2+(f.macros?.calories??0),0),0)/days.length)
  }, [last7, foodLogs])

  const streak = useMemo(() => {
    const target = (() => {
      if (!profile) return 2000
      const w=Number(profile.weight)||75,h=Number(profile.height)||175,a=Number(profile.age)||25
      const bmr=profile.gender==='male'?10*w+6.25*h-5*a+5:10*w+6.25*h-5*a-161
      const m:Record<string,number>={sedentary:1.2,light:1.375,moderate:1.55,active:1.725,very_active:1.9}
      return Math.round(bmr*(m[profile.activityLevel]??1.55))
    })()
    let count=0; const d=new Date()
    for (let i=0;i<365;i++) {
      const ds=d.toISOString().split('T')[0]
      const c=foodLogs.filter((l)=>l.date===ds).reduce((s,f)=>s+(f.macros?.calories??0),0)
      const b=activityLogs.filter((l)=>l.date===ds).reduce((s,a)=>s+a.caloriesBurned,0)
      if (c>0&&Math.abs((c-b)-target)<=200) count++; else if (i>0) break
      d.setDate(d.getDate()-1)
    }
    return count
  }, [foodLogs, activityLogs, profile])

  const currentWeight = weightHistory.length>0 ? weightHistory[weightHistory.length-1].weight : profile?.weight
  const startWeight   = weightHistory.length>0 ? weightHistory[0].weight : profile?.weight
  const weightChange  = currentWeight&&startWeight ? Math.round((currentWeight-startWeight)*10)/10 : null

  const addWeight = () => {
    const w=parseFloat(newWeight)
    if (!w||w<30||w>300) { toast.error('Ungültiges Gewicht'); return }
    addWeightEntry({ date:today, weight:w })
    toast.success(`${w} kg eingetragen! ✅`)
    setNewWeight(''); setShowInput(false)
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file=e.target.files?.[0]; if (!file) return
    const url=await imageFileToDataUrl(file)
    addBeforeAfterPhoto({ id:uid(), date:today, photo:url, weight:profile?.weight })
    toast.success('Foto gespeichert! 📸')
  }

  const inputStyle = { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, color:'var(--text-1)', padding:'13px 16px', width:'100%', fontSize:14, fontWeight:600 } as const

  const tooltipStyle = { background:'rgba(17,24,40,0.95)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, color:'#f1f5f9', fontSize:12 }
  const axisStyle    = { fontSize:10, fill:'#475569', fontWeight:600 }

  const TABS = [
    { id:'week'   as const, label:'📊 Woche'  },
    { id:'weight' as const, label:'⚖️ Gewicht'},
    { id:'body'   as const, label:'💪 Körper' },
    { id:'photos' as const, label:'📸 Fotos'  },
  ]

  return (
    <div className="pb-nav anim-fade overflow-x-hidden" style={{ background:'var(--bg)' }}>
      <div className="pt-safe px-5 pb-5 relative overflow-hidden" style={{ background:'linear-gradient(160deg,var(--bg-2),var(--bg))' }}>
        <div className="absolute" style={{ top:-40,right:-40,width:200,height:200,background:'radial-gradient(circle,rgba(245,158,11,0.06),transparent 70%)',pointerEvents:'none' }}/>
        <h1 className="text-2xl font-black mb-3 relative" style={{ color:'var(--text-1)' }}>Statistiken</h1>
        <div className="grid grid-cols-3 gap-2">
          {[{v:`${avgCals}`,u:'kcal/Tag',l:'Ø Kalorien'},{v:`${goalDays}`,u:'Tage',l:'Ziel erreicht'},{v:`${totalDays}`,u:'Tage',l:'Eingetragen'}].map((s)=>(
            <div key={s.l} className="glass-sm py-3 px-2 text-center">
              <p className="text-lg font-black" style={{ color:'var(--gold)' }}>{s.v}</p>
              <p className="text-[10px]" style={{ color:'var(--text-3)' }}>{s.u}</p>
              <p className="text-[10px]" style={{ color:'var(--text-3)' }}>{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* Streak hero */}
        <div className="glass p-5 mb-4 flex items-center gap-4">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-4xl flex-shrink-0"
            style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.15)' }}>
            {streak>0?'🔥':'💤'}
          </div>
          <div>
            <p className="text-5xl font-black" style={{ color:'var(--gold)' }}>{streak}</p>
            <p className="text-sm font-bold" style={{ color:'var(--text-1)' }}>{streak===1?'Tag':'Tage'} Streak</p>
            <p className="text-xs" style={{ color:'var(--text-3)' }}>{streak>0?'Weiter so! 🎉':'Starte heute!'}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 p-1.5 rounded-2xl mb-4" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
          {TABS.map((t)=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
              style={activeTab===t.id ? { background:'var(--grad-gold)', color:'#fff' } : { color:'var(--text-3)' }}>
              {t.label}
            </button>
          ))}
        </div>

        {activeTab==='week' && (
          <div className="space-y-3">
            <div className="glass p-4">
              <p className="label mb-3">Kalorien & Sport (7 Tage)</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={weekData} barSize={14} barGap={3}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                  <XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false}/>
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={30}/>
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill:'rgba(255,255,255,0.03)' }}/>
                  <Bar dataKey="calories" fill="#f59e0b" radius={[6,6,0,0]} name="kcal"/>
                  <Bar dataKey="burned"   fill="#10b981" radius={[6,6,0,0]} name="Verbrannt"/>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2">
                {[{c:'#f59e0b',l:'Gegessen'},{c:'#10b981',l:'Verbrannt'}].map((item)=>(
                  <span key={item.l} className="flex items-center gap-1.5 text-xs" style={{ color:'var(--text-3)' }}>
                    <span className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0" style={{ background:item.c }}/>
                    {item.l}
                  </span>
                ))}
              </div>
            </div>
            <div className="glass p-4">
              <p className="label mb-3">Eiweiß (7 Tage)</p>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={weekData} barSize={18}>
                  <XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill:'rgba(255,255,255,0.03)' }}/>
                  <Bar dataKey="protein" fill="#3b82f6" radius={[6,6,0,0]} name="Eiweiß (g)"/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="glass p-4">
              <p className="label mb-3">Zielerreichung (30 Tage)</p>
              <div className="flex flex-wrap gap-1.5">
                {last30.map((date)=>{
                  const s=getStatsForDate(date), hasData=s.totalCalories>0
                  return (
                    <div key={date} title={`${date}: ${Math.round(s.totalCalories)} kcal`}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold"
                      style={{ background: !hasData?'rgba(255,255,255,0.04)':s.goalMet?'rgba(16,185,129,0.2)':'rgba(239,68,68,0.15)', color:!hasData?'var(--text-3)':s.goalMet?'#10b981':'#ef4444', border:`1px solid ${!hasData?'rgba(255,255,255,0.06)':s.goalMet?'rgba(16,185,129,0.3)':'rgba(239,68,68,0.2)'}` }}>
                      {hasData?(s.goalMet?'✓':'✗'):'·'}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab==='weight' && (
          <div className="space-y-3">
            {currentWeight && (
              <div className="glass p-5 flex items-center gap-4">
                <div>
                  <p className="text-5xl font-black" style={{ color:'var(--text-1)' }}>{currentWeight}</p>
                  <p className="text-sm" style={{ color:'var(--text-3)' }}>kg aktuell</p>
                </div>
                <div className="flex-1"/>
                <div className="text-right">
                  {weightChange!==null && (
                    <>
                      <p className="text-2xl font-black" style={{ color:weightChange<=0?'#10b981':'#ef4444' }}>
                        {weightChange>0?'+':''}{weightChange} kg
                      </p>
                      <p className="text-xs" style={{ color:'var(--text-3)' }}>Veränderung</p>
                    </>
                  )}
                  {profile?.targetWeight && <p className="text-sm mt-1" style={{ color:'var(--text-3)' }}>Ziel: {profile.targetWeight} kg</p>}
                </div>
              </div>
            )}
            {weightData.length>1 && (
              <div className="glass p-4">
                <p className="label mb-3">Verlauf</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={weightData}>
                    <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                    <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false}/>
                    <YAxis domain={['auto','auto']} tick={axisStyle} axisLine={false} tickLine={false} width={32}/>
                    <Tooltip contentStyle={tooltipStyle}/>
                    <Line type="monotone" dataKey="weight" stroke="#f59e0b" strokeWidth={2.5} dot={{ r:4, fill:'#f59e0b', strokeWidth:0 }} name="kg"/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {showInput ? (
              <div className="glass p-4 space-y-3">
                <p className="label">Gewicht eintragen</p>
                <input autoFocus type="number" inputMode="decimal" step="0.1" value={newWeight}
                  onChange={(e)=>setNewWeight(e.target.value)}
                  style={{ ...inputStyle, textAlign:'center', fontSize:22, fontWeight:800 }} placeholder="75.5"/>
                <div className="flex gap-2">
                  <button onClick={()=>setShowInput(false)} className="btn-ghost flex-1 py-3 text-sm" style={{ minHeight:48 }}>Abbrechen</button>
                  <button onClick={addWeight} className="btn-gold flex-1 py-3 text-sm" style={{ minHeight:48 }}>Speichern</button>
                </div>
              </div>
            ) : (
              <button onClick={()=>setShowInput(true)} className="btn-gold w-full py-4 flex items-center justify-center gap-2" style={{ minHeight:52 }}>
                <Scale size={17}/>Gewicht eintragen
              </button>
            )}
            {weightHistory.length>0 && (
              <div className="glass">
                {weightHistory.slice(-8).reverse().map((entry,i)=>(
                  <div key={entry.date} className="flex items-center justify-between px-4 py-3.5"
                    style={{ borderTop:i>0?'1px solid var(--glass-border)':'none' }}>
                    <p className="text-sm" style={{ color:'var(--text-3)' }}>{entry.date.split('-').reverse().join('.')}</p>
                    <p className="text-sm font-black" style={{ color:'var(--text-1)' }}>{entry.weight} kg</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Body Tracking ── */}
        {activeTab==='body' && (
          <div className="space-y-3">
            {/* Disclaimer */}
            <div className="glass p-4" style={{ background:'rgba(245,158,11,0.06)', borderColor:'rgba(245,158,11,0.2)' }}>
              <p className="text-xs font-bold" style={{ color:'var(--gold)' }}>⚠️ KI-Schätzung · kein medizinischer Rat</p>
              <p className="text-xs mt-1" style={{ color:'var(--text-3)' }}>Claude AI analysiert Fotos visuell. Die Werte sind grobe Schätzungen und ersetzen keine medizinische Beurteilung.</p>
            </div>

            {/* Upload button */}
            <input ref={bodyFileRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => e.target.files?.[0] && analyzePhoto(e.target.files[0])} />
            <button onClick={() => bodyFileRef.current?.click()} disabled={bodyAnalyzing}
              className="w-full py-5 rounded-3xl flex items-center justify-center gap-3 glass-press disabled:opacity-50"
              style={{ background:'rgba(139,92,246,0.1)', border:'2px dashed rgba(139,92,246,0.3)' }}>
              {bodyAnalyzing
                ? <><Loader size={22} className="animate-spin" style={{ color:'#a78bfa' }}/><span className="font-bold" style={{ color:'var(--text-1)' }}>KI analysiert…</span></>
                : <><Camera size={24} style={{ color:'#a78bfa' }}/><span className="font-bold" style={{ color:'var(--text-1)' }}>Körperfoto aufnehmen + analysieren</span></>}
            </button>

            {/* Photo gallery with analysis */}
            {beforeAfterPhotos.length === 0 ? (
              <div className="glass p-8 text-center">
                <p className="text-3xl mb-2">💪</p>
                <p className="text-sm font-bold" style={{ color:'var(--text-2)' }}>Noch keine Körperfotos</p>
                <p className="text-xs mt-1" style={{ color:'var(--text-3)' }}>Füge dein erstes Foto hinzu um deinen Fortschritt zu tracken</p>
              </div>
            ) : (
              <>
                {/* Before/After Vergleich */}
                {beforeAfterPhotos.length >= 2 && (
                  <div className="glass p-4">
                    <p className="label mb-3">Vorher / Nachher Vergleich</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[beforeAfterPhotos[0], beforeAfterPhotos[beforeAfterPhotos.length - 1]].map((p, i) => (
                        <div key={p.id}>
                          <p className="text-xs font-bold mb-1.5 text-center" style={{ color: i===0 ? '#94a3b8' : 'var(--gold)' }}>
                            {i===0 ? 'Vorher' : 'Nachher'}
                          </p>
                          <img src={p.photo} alt="" className="w-full h-40 object-cover rounded-2xl" />
                          <p className="text-[10px] text-center mt-1" style={{ color:'var(--text-3)' }}>{p.date}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <p className="label px-1">Zeitstrahl</p>
                <div className="space-y-3">
                  {beforeAfterPhotos.slice().reverse().map((photo) => (
                    <div key={photo.id} className="glass overflow-hidden">
                      <div className="flex gap-3 p-4">
                        <img src={photo.photo} alt="" className="w-24 h-24 object-cover rounded-2xl flex-shrink-0" />
                        <div className="flex-1" style={{ minWidth:0 }}>
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-black" style={{ color:'var(--text-1)' }}>{photo.date.split('-').reverse().join('.')}</p>
                              {photo.weight && <p className="text-xs" style={{ color:'var(--gold)' }}>{photo.weight} kg</p>}
                            </div>
                            <button onClick={() => removeBeforeAfterPhoto(photo.id)} className="glass-press p-1 flex-shrink-0">
                              <X size={13} style={{ color:'var(--text-3)' }}/>
                            </button>
                          </div>
                          {photo.analysis ? (
                            <div className="mt-2 space-y-1">
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  { label:'KFA', val: photo.analysis.bodyFatRange, color:'#f59e0b' },
                                  { label:'Muskeltonus', val: photo.analysis.muscleTonus, color:'#10b981' },
                                  { label:'Level', val: photo.analysis.fitnessLevel, color:'#60a5fa' },
                                ].map((item) => (
                                  <span key={item.label} className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                                    style={{ background:`${item.color}15`, color:item.color }}>
                                    {item.label}: {item.val}
                                  </span>
                                ))}
                              </div>
                              <button onClick={() => setSelectedPhoto(photo.id === selectedPhoto ? null : photo.id)}
                                className="text-xs font-bold glass-press" style={{ color:'var(--text-3)' }}>
                                {selectedPhoto === photo.id ? '▲ Weniger' : '▼ Details'}
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs mt-2" style={{ color:'var(--text-3)' }}>Keine KI-Analyse</p>
                          )}
                        </div>
                      </div>

                      {/* Expanded analysis */}
                      {selectedPhoto === photo.id && photo.analysis && (
                        <div className="px-4 pb-4 space-y-2" style={{ borderTop:'1px solid var(--glass-border)' }}>
                          {photo.analysis.observations.length > 0 && (
                            <div>
                              <p className="label mt-3 mb-1.5">Beobachtungen</p>
                              {photo.analysis.observations.map((obs, i) => (
                                <p key={i} className="text-xs mb-1" style={{ color:'var(--text-2)' }}>• {obs}</p>
                              ))}
                            </div>
                          )}
                          {photo.analysis.recommendations.length > 0 && (
                            <div>
                              <p className="label mb-1.5">Empfehlungen</p>
                              {photo.analysis.recommendations.map((rec, i) => (
                                <p key={i} className="text-xs mb-1" style={{ color:'var(--text-2)' }}>→ {rec}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab==='photos' && (
          <div className="space-y-3">
            <div className="glass p-4" style={{ background:'rgba(139,92,246,0.06)', borderColor:'rgba(139,92,246,0.15)' }}>
              <p className="text-sm" style={{ color:'var(--text-2)' }}>Dokumentiere deinen Fortschritt mit Vorher/Nachher-Fotos.</p>
            </div>
            <label className="w-full py-4 rounded-3xl font-black text-base flex items-center justify-center gap-2 cursor-pointer glass-press transition-all"
              style={{ background:'var(--grad-purple)', color:'#fff', minHeight:52, boxShadow:'0 0 24px rgba(139,92,246,0.3)' }}>
              <Camera size={18}/>Foto hinzufügen
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload}/>
            </label>
            {beforeAfterPhotos.length>0 ? (
              <div className="grid grid-cols-2 gap-3">
                {beforeAfterPhotos.slice().reverse().map((photo)=>(
                  <div key={photo.id} className="glass overflow-hidden">
                    <img src={photo.photo} alt="" className="w-full h-44 object-cover"/>
                    <div className="px-3 py-2.5 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold" style={{ color:'var(--text-1)' }}>{photo.date.split('-').reverse().join('.')}</p>
                        {photo.weight && <p className="text-[10px]" style={{ color:'var(--text-3)' }}>{photo.weight} kg</p>}
                      </div>
                      <button onClick={()=>removeBeforeAfterPhoto(photo.id)} className="glass-press p-1">
                        <X size={13} style={{ color:'var(--text-3)' }}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass p-10 text-center">
                <p className="text-3xl mb-2">📸</p>
                <p className="text-sm" style={{ color:'var(--text-3)' }}>Noch keine Fotos</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
