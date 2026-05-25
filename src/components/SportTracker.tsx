import { useState, useMemo, useEffect, useRef } from 'react'
import { Trash2, X, Play, Square, Plus } from 'lucide-react'
import { useStore } from '../store/useStore'
import { SPORTS_DATABASE, calculateCaloriesBurned, SPORT_CATEGORIES, kettlebellFactor, KETTLEBELL_WEIGHTS } from '../data/sportsDatabase'
import { formatDate, uid } from '../utils/calculations'
import { useRunTracker } from '../hooks/useRunTracker'
import RunStartScreen from './RunStartScreen'
import RunActiveScreen from './RunActiveScreen'
import RunSummary from './RunSummary'
import RunHistory from './RunHistory'
import type { ActivityLog, Intensity, SportActivity, RunSession } from '../types'
import toast from 'react-hot-toast'

const today = formatDate()

// ── Timer sub-component ────────────────────────────────────────────────────
function Timer({ onStop }: { onStop: (s: number) => void }) {
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(true)
  const ref = useRef<ReturnType<typeof setInterval>|null>(null)

  useEffect(() => {
    if (running) ref.current = setInterval(()=>setSeconds((s)=>s+1), 1000)
    else if (ref.current) clearInterval(ref.current)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [running])

  const fmt = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

  return (
    <div className="glass p-6 text-center">
      <p className="label mb-2">Aktive Zeit</p>
      <p className="text-6xl font-black font-mono tracking-tight mb-5" style={{ color:'var(--text-1)' }}>{fmt(seconds)}</p>
      <div className="flex gap-3 justify-center">
        <button onClick={()=>setRunning(!running)}
          className="glass-press px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2"
          style={{ background:running?'rgba(245,158,11,0.1)':'rgba(16,185,129,0.1)', color:running?'#f59e0b':'#10b981', border:`1px solid ${running?'rgba(245,158,11,0.2)':'rgba(16,185,129,0.2)'}` }}>
          {running ? <><Square size={15}/>Pause</> : <><Play size={15}/>Weiter</>}
        </button>
        <button onClick={()=>{ setRunning(false); onStop(seconds) }}
          className="btn-gold px-6 py-3 text-sm">Fertig ✓</button>
      </div>
    </div>
  )
}

// ── Activity add sheet ─────────────────────────────────────────────────────
function AddSheet({ onClose }: { onClose: ()=>void }) {
  const [sport, setSport]       = useState<SportActivity|null>(null)
  const [duration, setDuration] = useState('30')
  const [intensity, setIntensity] = useState<Intensity>('medium')
  const [steps, setSteps]       = useState('')
  const [timerMode, setTimerMode]   = useState(false)
  const [activeCategory, setActiveCategory] = useState<string|null>(null)
  const [kbWeight, setKbWeight]     = useState(16)
  const addActivityLog = useStore((s)=>s.addActivityLog)
  const profile        = useStore((s)=>s.profile)
  const weight = Number(profile?.weight)||75

  const getMET = (sp: SportActivity, i: Intensity) =>
    i==='light' ? sp.metLight : i==='medium' ? sp.metMedium : sp.metIntense

  const baseCalories = sport ? calculateCaloriesBurned(weight, parseInt(duration)||0, getMET(sport, intensity)) : 0
  const calories = sport?.kettlebell
    ? Math.round(baseCalories * kettlebellFactor(kbWeight))
    : baseCalories

  const save = () => {
    if (!sport) return
    const dur = parseInt(duration)||0
    const baseCal = calculateCaloriesBurned(weight, dur, getMET(sport, intensity))
    const finalCal = sport.kettlebell ? Math.round(baseCal * kettlebellFactor(kbWeight)) : baseCal
    const log: ActivityLog = { id:uid(), date:today, sport, duration:dur, intensity, caloriesBurned:finalCal, steps:steps?parseInt(steps):undefined, timestamp:Date.now() }
    addActivityLog(log)
    toast.success(`${sport.icon} ${sport.name} – ${finalCal} kcal verbrannt!`)
    onClose()
  }

  const filtered = activeCategory ? SPORTS_DATABASE.filter((s)=>s.category===activeCategory) : SPORTS_DATABASE
  const INTENSITY: { id:Intensity; label:string; color:string }[] = [
    { id:'light',   label:'🟢 Leicht',  color:'#10b981' },
    { id:'medium',  label:'🟡 Mittel',  color:'#f59e0b' },
    { id:'intense', label:'🔴 Intensiv',color:'#ef4444' },
  ]

  return (
    <div className="fixed inset-0 z-[110] flex items-end" onClick={onClose}>
      <div className="sheet-overlay absolute inset-0"/>
      <div className="sheet-bg relative w-full max-w-[430px] mx-auto max-h-[93dvh] overflow-hidden flex flex-col anim-up"
        onClick={(e)=>e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1"><div className="sheet-handle"/></div>
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-lg font-black" style={{ color:'var(--text-1)' }}>{sport ? sport.name : 'Sportart wählen'}</h2>
          <button onClick={onClose} className="glass-sm glass-press w-10 h-10 flex items-center justify-center">
            <X size={17} style={{ color:'var(--text-2)' }}/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 space-y-3" style={{ paddingBottom:'calc(max(env(safe-area-inset-bottom),20px) + 48px)' }}>
          {!sport ? (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth:'none' }}>
                <button onClick={()=>setActiveCategory(null)}
                  className="flex-shrink-0 glass-press rounded-2xl px-3 py-2 text-xs font-bold whitespace-nowrap transition-all"
                  style={!activeCategory ? { background:'var(--gold-dim)', border:'1px solid rgba(245,158,11,0.3)', color:'var(--gold)' }
                    : { background:'var(--glass)', border:'1px solid var(--glass-border)', color:'var(--text-2)' }}>
                  Alle
                </button>
                {SPORT_CATEGORIES.map((cat)=>(
                  <button key={cat} onClick={()=>setActiveCategory(cat)}
                    className="flex-shrink-0 glass-press rounded-2xl px-3 py-2 text-xs font-bold whitespace-nowrap transition-all"
                    style={activeCategory===cat ? { background:'var(--gold-dim)', border:'1px solid rgba(245,158,11,0.3)', color:'var(--gold)' }
                      : { background:'var(--glass)', border:'1px solid var(--glass-border)', color:'var(--text-2)' }}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {filtered.map((s)=>(
                  <button key={s.id} onClick={()=>setSport(s)}
                    className="glass glass-press p-3.5 flex flex-col items-center gap-1.5">
                    <span className="text-3xl">{s.icon}</span>
                    <p className="text-xs font-bold text-center leading-tight" style={{ color:'var(--text-1)' }}>{s.name}</p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="glass p-4 flex items-center gap-3"
                style={{ background:'rgba(245,158,11,0.05)', borderColor:'rgba(245,158,11,0.15)' }}>
                <span className="text-4xl">{sport.icon}</span>
                <div className="flex-1">
                  <p className="font-black" style={{ color:'var(--text-1)' }}>{sport.name}</p>
                  <p className="text-xs" style={{ color:'var(--text-3)' }}>{sport.category}</p>
                </div>
                <button onClick={()=>setSport(null)} className="glass-press p-1">
                  <X size={16} style={{ color:'var(--text-3)' }}/>
                </button>
              </div>

              {timerMode ? <Timer onStop={(s)=>{ setTimerMode(false); setDuration(String(Math.max(1,Math.round(s/60)))) }}/> : (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="label">Dauer (Min)</p>
                      <button onClick={()=>setTimerMode(true)}
                        className="glass-press text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1"
                        style={{ background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', color:'#60a5fa' }}>
                        <Play size={11}/>Timer
                      </button>
                    </div>
                    <div className="flex gap-2 mb-2">
                      {[15,30,45,60,90].map((min)=>(
                        <button key={min} onClick={()=>setDuration(String(min))}
                          className="flex-1 py-3 rounded-2xl text-sm font-bold glass-press transition-all"
                          style={duration===String(min)
                            ? { background:'var(--grad-gold)', color:'#fff' }
                            : { background:'var(--glass)', border:'1px solid var(--glass-border)', color:'var(--text-2)' }
                          }>{min}</button>
                      ))}
                    </div>
                    <input type="number" inputMode="numeric" value={duration} onChange={(e)=>setDuration(e.target.value)}
                      style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, color:'var(--text-1)', padding:'12px 16px', width:'100%', textAlign:'center', fontSize:18, fontWeight:800 }} />
                  </div>

                  <div>
                    <p className="label mb-2">Intensität</p>
                    <div className="flex gap-2">
                      {INTENSITY.map((int)=>(
                        <button key={int.id} onClick={()=>setIntensity(int.id)}
                          className="flex-1 py-3 rounded-2xl text-xs font-bold glass-press transition-all"
                          style={intensity===int.id
                            ? { background:`${int.color}18`, border:`1px solid ${int.color}40`, color:int.color }
                            : { background:'var(--glass)', border:'1px solid var(--glass-border)', color:'var(--text-3)' }
                          }>{int.label}</button>
                      ))}
                    </div>
                  </div>

                  {sport?.kettlebell && (
                    <div>
                      <p className="label mb-2">
                        Kettlebell Gewicht
                        <span className="ml-2 text-xs font-bold" style={{ color:'var(--gold)', textTransform:'none', letterSpacing:0 }}>
                          {kbWeight}kg · Faktor ×{kettlebellFactor(kbWeight).toFixed(2)}
                        </span>
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {KETTLEBELL_WEIGHTS.map((kg) => (
                          <button key={kg} onClick={() => setKbWeight(kg)}
                            className="flex-1 py-3 rounded-2xl text-sm font-bold glass-press transition-all"
                            style={kbWeight === kg
                              ? { background:'var(--grad-gold)', color:'#000', minWidth:44 }
                              : { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'var(--text-2)', minWidth:44 }
                            }>{kg}kg</button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="label mb-2">Schritte <span style={{ color:'var(--text-3)', fontWeight:400, textTransform:'none', letterSpacing:0 }}>(optional)</span></p>
                    <input type="number" inputMode="numeric" value={steps} onChange={(e)=>setSteps(e.target.value)}
                      placeholder="z.B. 8000"
                      style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, color:'var(--text-1)', padding:'12px 16px', width:'100%', fontSize:14, fontWeight:600 }} />
                  </div>
                </>
              )}

              <div className="glass p-5 text-center" style={{ background:'rgba(16,185,129,0.05)', borderColor:'rgba(16,185,129,0.15)' }}>
                <p className="label mb-1">Geschätzte Verbrennung</p>
                <p className="text-5xl font-black" style={{ color:'#10b981' }}>{calories}</p>
                <p className="text-sm mt-1" style={{ color:'var(--text-3)' }}>kcal</p>
              </div>

              <button onClick={save} className="btn-gold w-full py-4 text-base" style={{ minHeight:54 }}>
                Aktivität speichern
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main SportTracker ──────────────────────────────────────────────────────
type SportTab = 'activities' | 'runs'

export default function SportTracker() {
  const [tab, setTab]               = useState<SportTab>('activities')
  const [showAdd, setShowAdd]       = useState(false)
  const [showRunStart, setShowRunStart] = useState(false)
  const [runGoal, setRunGoal]       = useState<{ type: 'distance' | 'time'; value: number } | undefined>()
  const [savedSession, setSavedSession] = useState<RunSession | null>(null)

  const allActivityLogs  = useStore(s => s.activityLogs)
  const removeActivityLog = useStore(s => s.removeActivityLog)
  const addActivityLog   = useStore(s => s.addActivityLog)
  const addRunSession    = useStore(s => s.addRunSession)
  const profile          = useStore(s => s.profile)
  const weight           = Number(profile?.weight) || 75

  const activityLogs  = useMemo(() => allActivityLogs.filter(l => l.date === today), [allActivityLogs])
  const totalBurned   = useMemo(() => activityLogs.reduce((s, a) => s + a.caloriesBurned, 0), [activityLogs])
  const totalDuration = useMemo(() => activityLogs.reduce((s, a) => s + a.duration, 0), [activityLogs])

  const run = useRunTracker(weight)

  // When run finishes, build a RunSession and show summary
  const handleRunFinish = () => {
    run.finish()
    if (run.distance < 0.05) {
      toast.error('Lauf zu kurz – mindestens 50 m erforderlich.')
      run.reset()
      return
    }
    const bestPace = run.splits.length > 0 ? Math.min(...run.splits.map(s => s.pace)) : run.avgPace
    const logId = uid()

    // Save as ActivityLog so calories appear in dashboard
    const runningActivity = SPORTS_DATABASE.find(s => s.name === 'Laufen') ?? {
      id: 'run', name: 'Laufen', icon: '🏃', metLight: 7, metMedium: 9.8, metIntense: 12.8, category: 'Ausdauer',
    }
    addActivityLog({
      id: logId,
      date: today,
      sport: runningActivity,
      duration: Math.round(run.elapsed / 60),
      intensity: 'medium',
      caloriesBurned: run.calories,
      timestamp: Date.now(),
    })

    const session: RunSession = {
      id: uid(),
      date: today,
      startTime: Date.now() - run.elapsed * 1000,
      endTime: Date.now(),
      duration: run.elapsed,
      distance: run.distance,
      route: run.route,
      splits: run.splits,
      kmMarkers: run.kmMarkers,
      avgPace: run.avgPace,
      bestPace,
      elevationGain: run.elevationGain,
      caloriesBurned: run.calories,
      activityLogId: logId,
    }
    addRunSession(session)
    setSavedSession(session)
  }

  const handleSummaryDone = () => {
    setSavedSession(null)
    run.reset()
    setTab('runs')
  }

  // ── Render: run start screen ──
  if (showRunStart) {
    return (
      <RunStartScreen
        onCancel={() => setShowRunStart(false)}
        onStart={(goal) => {
          setRunGoal(goal)
          setShowRunStart(false)
          run.start()
        }}
      />
    )
  }

  // ── Render: fullscreen during run ──
  if (run.status === 'running' || run.status === 'paused') {
    return (
      <RunActiveScreen
        run={{ ...run, finish: handleRunFinish }}
        goal={runGoal}
      />
    )
  }

  // ── Render: post-run summary ──
  if (savedSession) {
    return <RunSummary session={savedSession} onDone={handleSummaryDone} />
  }

  // ── Render: normal sport tab ──
  return (
    <div className="h-dvh overflow-y-auto overflow-x-hidden pb-nav anim-fade" style={{ background:'var(--bg)' }}>

      {/* Header */}
      <div className="pt-safe px-5 pb-5 relative overflow-hidden"
        style={{ background:'#000', borderBottom:'1px solid #1a1a1a' }}>
        <div className="absolute" style={{ top:-40,right:-40,width:200,height:200, background:'radial-gradient(circle,rgba(16,185,129,0.08),transparent 70%)', pointerEvents:'none' }}/>
        <h1 className="text-2xl font-black mb-1 relative" style={{ color:'var(--text-1)' }}>Sport & Aktivität</h1>
        <p className="text-sm relative" style={{ color:'var(--text-3)' }}>Heute verbrannt</p>
        <p className="text-5xl font-black mt-1 relative" style={{ color:'#10b981' }}>
          {totalBurned} <span className="text-xl font-semibold" style={{ color:'var(--text-3)' }}>kcal</span>
        </p>
        {totalDuration > 0 && (
          <p className="text-sm mt-1 relative" style={{ color:'var(--text-3)' }}>
            ⏱ {totalDuration} Min · {activityLogs.length} Aktivitäten
          </p>
        )}
      </div>

      {/* ── BIG Run Start Button ── */}
      <div className="px-4 pt-4">
        <button
          onClick={() => setShowRunStart(true)}
          className="w-full flex items-center justify-center gap-3 rounded-3xl font-black text-lg"
          style={{
            paddingTop: 20, paddingBottom: 20,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            boxShadow: '0 8px 32px rgba(16,185,129,0.35)',
            color: '#fff',
            border: 'none',
          }}>
          <span style={{ fontSize: 28 }}>🏃</span>
          Lauf starten
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 px-4 pt-4">
        {([['activities', 'Aktivitäten'], ['runs', 'Läufe 🗺']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all"
            style={tab === id
              ? { background:'var(--gold-dim)', border:'1px solid rgba(245,158,11,0.3)', color:'var(--gold)' }
              : { background:'var(--glass)', border:'1px solid var(--glass-border)', color:'var(--text-3)' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-4 py-4 space-y-3">
        {tab === 'activities' ? (
          <>
            {activityLogs.length > 0 ? (
              <div className="glass">
                {activityLogs.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 p-4" style={{ borderTop:'1px solid var(--glass-border)' }}>
                    <span className="text-2xl flex-shrink-0">{log.sport.icon}</span>
                    <div className="flex-1" style={{ minWidth:0 }}>
                      <p className="text-sm font-black" style={{ color:'var(--text-1)' }}>{log.sport.name}</p>
                      <p className="text-xs" style={{ color:'var(--text-3)' }}>{log.duration} Min · {{ light:'🟢',medium:'🟡',intense:'🔴' }[log.intensity]}</p>
                    </div>
                    <p className="text-sm font-black flex-shrink-0 mr-2" style={{ color:'#10b981' }}>{log.caloriesBurned} kcal</p>
                    <button onClick={()=>removeActivityLog(log.id)} className="glass-press p-1 flex-shrink-0">
                      <Trash2 size={14} style={{ color:'var(--text-3)' }}/>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass p-10 text-center">
                <p className="text-4xl mb-3">💪</p>
                <p className="text-sm font-bold" style={{ color:'var(--text-2)' }}>Noch keine Aktivitäten heute</p>
              </div>
            )}

            <button onClick={() => setShowAdd(true)} className="btn-gold w-full py-4 text-base flex items-center justify-center gap-2" style={{ minHeight:54 }}>
              <Plus size={20}/>Aktivität hinzufügen
            </button>
          </>
        ) : (
          <RunHistory />
        )}
      </div>

      {showAdd && <AddSheet onClose={() => setShowAdd(false)} />}
    </div>
  )
}
