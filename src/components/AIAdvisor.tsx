import { useState, useRef, useEffect, useMemo } from 'react'
import { Send, Loader, RefreshCw, Sparkles, Refrigerator, TrendingUp, ChevronRight, Zap, Sun, Heart, Brain, ChevronDown, ChevronUp } from 'lucide-react'
import { useStore } from '../store/useStore'
import {
  askKalo, generateDailyKaloQuestion, extractPersonalityInsights, generateWeeklyKaloReport,
  generateCoachInsights, generateMorningBriefing, analyzeFridge, getRecipesFromIngredients, getShoppingList,
  type CoachReport, type MorningBriefing,
} from '../utils/api'
import { computeTargets, buildMedicalSystemPrompt } from '../utils/medicalKnowledge'
import { formatDate, getLast7Days, getLast30Days, getDayName, imageToBase64 } from '../utils/calculations'
import toast from 'react-hot-toast'

const today = formatDate()

export default function AIAdvisor() {
  const [tab, setTab]                   = useState<'kalo'|'coach'|'report'|'fridge'>('kalo')
  const [input, setInput]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [showPersonality, setShowPersonality] = useState(false)
  const [reportLoading, setReportLoading]     = useState(false)
  const [weeklyReport, setWeeklyReport]       = useState('')
  const [dailyQuestion, setDailyQuestion]     = useState('')
  const [questionLoading, setQuestionLoading] = useState(false)

  // Fridge
  const [fridgeStep, setFridgeStep]           = useState<'scan'|'choose'|'result'>('scan')
  const [fridgeIngredients, setFridgeIngredients] = useState<string[]>([])
  const [fridgeResult, setFridgeResult]       = useState('')
  const [fridgeType, setFridgeType]           = useState<'recipe'|'shopping'|null>(null)
  const [fridgeLoading, setFridgeLoading]     = useState(false)
  const [fridgePreview, setFridgePreview]     = useState<string|null>(null)

  // Coach
  const [coachReport, setCoachReport]         = useState<CoachReport|null>(null)
  const [coachLoading, setCoachLoading]       = useState(false)
  const [morningBriefing, setMorningBriefing] = useState<MorningBriefing|null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [briefingDate, setBriefingDate]       = useState('')

  const fileRef   = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const kaloMessages      = useStore((s) => s.kaloMessages)
  const addKaloMessage    = useStore((s) => s.addKaloMessage)
  const clearKaloMsgs     = useStore((s) => s.clearKaloMessages)
  const userPersonality   = useStore((s) => s.userPersonality)
  const updatePersonality = useStore((s) => s.updatePersonality)
  const apiKeys           = useStore((s) => s.apiKeys)
  const profile           = useStore((s) => s.profile)
  const allFoodLogs       = useStore((s) => s.foodLogs)
  const allActivities     = useStore((s) => s.activityLogs)
  const weightHistory     = useStore((s) => s.weightHistory)
  const whoopData         = useStore((s) => s.whoopData)
  const coachingProfile   = useStore((s) => s.coachingProfile)

  const apiKey = apiKeys.anthropic || apiKeys.openai

  const todayCals = useMemo(() =>
    allFoodLogs.filter((l) => l.date === today).reduce((s, f) => s + (f.macros?.calories ?? 0), 0),
    [allFoodLogs])

  const target = useMemo(() => {
    if (!profile) return 2000
    const w = Number(profile.weight)||75, h = Number(profile.height)||175, a = Number(profile.age)||25
    const bmr = profile.gender==='male' ? 10*w+6.25*h-5*a+5 : 10*w+6.25*h-5*a-161
    const m: Record<string,number> = { sedentary:1.2, light:1.375, moderate:1.55, active:1.725, very_active:1.9 }
    return Math.round(bmr*(m[profile.activityLevel]??1.55))
  }, [profile])

  const cpContext = coachingProfile ? [
    `Ernährungstyp: ${coachingProfile.dietType}`,
    coachingProfile.favoriteFoods ? `Lieblingsessen: ${coachingProfile.favoriteFoods}` : '',
    coachingProfile.dislikedFoods ? `Mag nicht: ${coachingProfile.dislikedFoods}` : '',
    coachingProfile.allergies     ? `Allergien: ${coachingProfile.allergies}` : '',
    `Training: ${coachingProfile.trainingDaysPerWeek}×/Woche (${coachingProfile.sportTypes.join(', ')}), ${coachingProfile.trainingTime}, ${coachingProfile.trainingIntensity}`,
    `Schlaf: ${coachingProfile.sleepTime}–${coachingProfile.wakeTime}, Qualität: ${coachingProfile.sleepQualityRating}`,
    coachingProfile.sleepDisruptors ? `Schlafstörer: ${coachingProfile.sleepDisruptors}` : '',
    `Stress: ${coachingProfile.stressLevel}, Arbeit: ${coachingProfile.workType}`,
    coachingProfile.currentSupplements ? `Supplements: ${coachingProfile.currentSupplements}` : '',
    coachingProfile.healthLimitations  ? `Einschränkungen: ${coachingProfile.healthLimitations}` : '',
    `Disziplin: ${coachingProfile.disciplineLevel}`,
    coachingProfile.biggestChallenge ? `Größte Herausforderung: ${coachingProfile.biggestChallenge}` : '',
    coachingProfile.mainGoals.length  ? `Hauptziele: ${coachingProfile.mainGoals.join(', ')}` : '',
  ].filter(Boolean).join(' | ') : ''

  const context = [
    `${profile?.name}, Ziel: ${profile?.goal==='lose'?'Abnehmen':profile?.goal==='gain'?'Zunehmen':'Halten'}`,
    `Kalorienziel: ${target}, Heute: ${Math.round(todayCals)} kcal, Noch: ${Math.round(target-todayCals)} kcal`,
    cpContext,
  ].filter(Boolean).join(' · ')
  const medTargets = useMemo(() => profile ? computeTargets(profile, target) : null, [profile, target])
  const medSystem  = useMemo(() => buildMedicalSystemPrompt(profile??null, medTargets, target), [profile, medTargets, target])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [kaloMessages])

  // Daily question – once per day
  useEffect(() => {
    if (tab !== 'kalo' || !apiKey || !profile) return
    if (userPersonality.dailyQuestionDate === today) {
      setDailyQuestion(userPersonality.dailyQuestion)
    } else if (!questionLoading) {
      setQuestionLoading(true)
      generateDailyKaloQuestion(profile.name, userPersonality, context, apiKey)
        .then((q) => { setDailyQuestion(q); updatePersonality({ dailyQuestion: q, dailyQuestionDate: today }) })
        .catch(() => {})
        .finally(() => setQuestionLoading(false))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // Morning briefing – once per day when coach tab opens
  useEffect(() => {
    if (tab === 'coach' && apiKey && briefingDate !== today && !briefingLoading) {
      runMorningBriefing()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const send = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg) return
    if (!apiKey) { toast.error('API Key fehlt → Profil → API Keys'); return }
    if (!profile) { toast.error('Bitte erst Profil anlegen'); return }
    addKaloMessage({ role:'user', content:msg, timestamp:Date.now() })
    setInput('')
    setLoading(true)
    try {
      const reply = await askKalo(msg, profile, userPersonality, kaloMessages, context, apiKey)
      addKaloMessage({ role:'assistant', content:reply, timestamp:Date.now() })
      // Background personality extraction every 6 messages
      const newLen = kaloMessages.length + 2
      if (newLen >= 6 && newLen % 6 === 0) {
        const snap = [...kaloMessages, { role:'user' as const, content:msg, timestamp:0 }, { role:'assistant' as const, content:reply, timestamp:0 }]
        const curPersonality = userPersonality
        extractPersonalityInsights(snap, curPersonality, apiKey)
          .then((ins) => {
            const u: Partial<typeof curPersonality> = {}
            if (ins.favoriteFoods?.length)   u.favoriteFoods   = [...new Set([...curPersonality.favoriteFoods, ...ins.favoriteFoods])]
            if (ins.weaknesses?.length)       u.weaknesses      = [...new Set([...curPersonality.weaknesses, ...ins.weaknesses])]
            if (ins.hungerTimes?.length)      u.hungerTimes     = [...new Set([...curPersonality.hungerTimes, ...ins.hungerTimes])]
            if (ins.motivations?.length)      u.motivations     = [...new Set([...curPersonality.motivations, ...ins.motivations])]
            if (ins.successPatterns?.length)  u.successPatterns = [...new Set([...curPersonality.successPatterns, ...ins.successPatterns])]
            if (ins.failPatterns?.length)     u.failPatterns    = [...new Set([...curPersonality.failPatterns, ...ins.failPatterns])]
            if (ins.stressEatingPattern != null) u.stressEatingPattern = ins.stressEatingPattern
            if (Object.keys(u).length > 0) updatePersonality(u)
          })
          .catch(() => {})
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Fehler'
      addKaloMessage({ role:'assistant', content:`❌ ${err}`, timestamp:Date.now() })
      toast.error(err, { duration:5000 })
    }
    setLoading(false)
  }

  const buildWeekData = () =>
    getLast7Days().map((date) => {
      const foods  = allFoodLogs.filter((l) => l.date === date)
      const acts   = allActivities.filter((l) => l.date === date)
      const cals   = Math.round(foods.reduce((s, f) => s + (f.macros?.calories ?? 0), 0))
      const prot   = Math.round(foods.reduce((s, f) => s + (f.macros?.protein  ?? 0), 0))
      const burned = Math.round(acts.reduce((s, a) => s + a.caloriesBurned, 0))
      const sport  = acts.map((a) => `${a.sport.name} ${a.duration}min`).join(', ')
      const delta  = cals - target
      return `${date}: ${cals} kcal (${delta>=0?'+':''}${delta}), Protein ${prot}g, Verbrannt ${burned} kcal${sport?`, Sport: ${sport}`:''}`
    }).join('\n')

  const genReport = async () => {
    if (!apiKey || !profile) return
    setReportLoading(true)
    try {
      const goal = profile.goal==='lose'?'Abnehmen':profile.goal==='gain'?'Zunehmen':'Gewicht halten'
      const text = await generateWeeklyKaloReport(profile.name, goal, userPersonality, buildWeekData(), apiKey)
      setWeeklyReport(text)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Fehler', { duration:5000 }) }
    setReportLoading(false)
  }

  const buildCoachData = () => {
    const last7  = getLast7Days()
    const last30 = getLast30Days()
    const lines: string[] = ['=== Detaillierte Daten letzte 7 Tage ===']
    last7.forEach((date) => {
      const foods  = allFoodLogs.filter((l) => l.date === date)
      const acts   = allActivities.filter((l) => l.date === date)
      const cals   = Math.round(foods.reduce((s, f) => s + (f.macros?.calories ?? 0), 0))
      const prot   = Math.round(foods.reduce((s, f) => s + (f.macros?.protein  ?? 0), 0))
      const carbs  = Math.round(foods.reduce((s, f) => s + (f.macros?.carbs    ?? 0), 0))
      const fat    = Math.round(foods.reduce((s, f) => s + (f.macros?.fat      ?? 0), 0))
      const burned = Math.round(acts.reduce((s, a) => s + a.caloriesBurned, 0))
      const sport  = acts.map((a) => `${a.sport.name} ${a.duration}min`).join(', ')
      const delta  = cals - target
      const dow = new Date(date).toLocaleDateString('de-DE', { weekday:'long' })
      lines.push(`${dow} (${date}): ${cals} kcal (${delta>0?'+':''}${delta} vs Ziel), P ${prot}g, C ${carbs}g, F ${fat}g, Verbrannt ${burned} kcal${sport?`, Sport: ${sport}`:', kein Sport'}`)
    })
    lines.push('\n=== 30-Tage Wochentag-Muster ===')
    const byDow: Record<string,number[]> = {}
    last30.forEach((date) => {
      const foods = allFoodLogs.filter((l) => l.date === date)
      if (!foods.length) return
      const cals = foods.reduce((s, f) => s + (f.macros?.calories ?? 0), 0)
      const dow  = new Date(date).toLocaleDateString('de-DE', { weekday:'long' })
      if (!byDow[dow]) byDow[dow] = []
      byDow[dow].push(cals)
    })
    ;['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'].forEach((dow) => {
      const vals = byDow[dow]
      if (!vals?.length) return
      const avg   = Math.round(vals.reduce((a, b) => a+b, 0) / vals.length)
      const delta = avg - target
      lines.push(`${dow}: ⌀ ${avg} kcal (${delta>0?'+':''}${delta} vs Ziel, ${vals.length} Einträge)`)
    })
    const sportC: number[] = [], restC: number[] = []
    last30.forEach((date) => {
      const foods = allFoodLogs.filter((l) => l.date === date)
      if (!foods.length) return
      const cals = foods.reduce((s, f) => s + (f.macros?.calories ?? 0), 0)
      allActivities.filter((l) => l.date === date).length > 0 ? sportC.push(cals) : restC.push(cals)
    })
    if (sportC.length && restC.length) {
      lines.push(`\nSporttage ⌀: ${Math.round(sportC.reduce((a,b)=>a+b,0)/sportC.length)} kcal`)
      lines.push(`Ruhetage ⌀:  ${Math.round(restC.reduce((a,b)=>a+b,0)/restC.length)} kcal`)
    }
    if (weightHistory.length) lines.push(`\nGewicht: ${weightHistory.slice(-5).map((w)=>`${getDayName(w.date)} ${w.weight}kg`).join(' → ')}`)
    if (whoopData) lines.push(`\nWhoop: Recovery ${whoopData.recovery}%, Schlaf ${whoopData.sleepQuality}%, HRV ${whoopData.hrv}ms`)
    lines.push(`\nKalorienziel: ${target} kcal/Tag`)
    if (coachingProfile) {
      lines.push('\n=== Persönliches Coaching-Profil ===')
      lines.push(`Ernährung: ${coachingProfile.dietType}, ${coachingProfile.mealsPerDay} Mahlzeiten/Tag`)
      if (coachingProfile.favoriteFoods)   lines.push(`Lieblingsessen: ${coachingProfile.favoriteFoods}`)
      if (coachingProfile.allergies)       lines.push(`Allergien: ${coachingProfile.allergies}`)
      lines.push(`Training: ${coachingProfile.trainingDaysPerWeek}×/Woche (${coachingProfile.sportTypes.join(', ')}), ${coachingProfile.trainingIntensity}`)
      lines.push(`Schlaf: ${coachingProfile.sleepTime}–${coachingProfile.wakeTime}, Qualität: ${coachingProfile.sleepQualityRating}`)
      lines.push(`Stress: ${coachingProfile.stressLevel}, Arbeit: ${coachingProfile.workType}`)
      if (coachingProfile.currentSupplements) lines.push(`Supplements: ${coachingProfile.currentSupplements}`)
      if (coachingProfile.healthLimitations)  lines.push(`Einschränkungen: ${coachingProfile.healthLimitations}`)
      lines.push(`Disziplin: ${coachingProfile.disciplineLevel}`)
      if (coachingProfile.biggestChallenge)   lines.push(`Herausforderung: ${coachingProfile.biggestChallenge}`)
      if (coachingProfile.aiPersonalizationSummary) lines.push(`\nKI-Analyse: ${coachingProfile.aiPersonalizationSummary}`)
    }
    return lines.join('\n')
  }

  const runCoachAnalysis = async () => {
    if (!apiKey) { toast.error('API Key fehlt → Profil → API Keys'); return }
    setCoachLoading(true)
    try {
      const goal   = profile?.goal==='lose'?'Abnehmen':profile?.goal==='gain'?'Zunehmen':'Halten'
      const report = await generateCoachInsights(profile?.name??'Nutzer', goal, target, buildCoachData(), apiKey)
      setCoachReport(report)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Fehler', { duration:5000 }) }
    setCoachLoading(false)
  }

  const runMorningBriefing = async () => {
    if (!apiKey) return
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1)
    const yDate = yesterday.toISOString().split('T')[0]
    const foods = allFoodLogs.filter((l) => l.date === yDate)
    const acts  = allActivities.filter((l) => l.date === yDate)
    if (!foods.length && !acts.length) return
    const cals   = Math.round(foods.reduce((s, f) => s + (f.macros?.calories ?? 0), 0))
    const prot   = Math.round(foods.reduce((s, f) => s + (f.macros?.protein  ?? 0), 0))
    const carbs  = Math.round(foods.reduce((s, f) => s + (f.macros?.carbs    ?? 0), 0))
    const fat    = Math.round(foods.reduce((s, f) => s + (f.macros?.fat      ?? 0), 0))
    const burned = Math.round(acts.reduce((s, a) => s + a.caloriesBurned, 0))
    const sport  = acts.map((a) => `${a.sport.name} ${a.duration}min`).join(', ')
    const yData  = `Gestern (${yDate}): ${cals} kcal (${cals-target>=0?'+':''}${cals-target} vs Ziel ${target}), Protein ${prot}g (Ziel: ${medTargets?.proteinMin??'?'}–${medTargets?.proteinMax??'?'}g), Carbs ${carbs}g, Fett ${fat}g, Verbrannt ${burned} kcal${sport?`, Sport: ${sport}`:', kein Sport'}`
    setBriefingLoading(true)
    try {
      const b = await generateMorningBriefing(medSystem, yData, apiKey)
      setMorningBriefing(b); setBriefingDate(today)
    } catch { /* silent */ }
    setBriefingLoading(false)
  }

  const handleFridgePhoto = async (file: File) => {
    if (!apiKey) { toast.error('API Key fehlt'); return }
    setFridgeLoading(true); setFridgePreview(URL.createObjectURL(file))
    try {
      const r = await analyzeFridge(await imageToBase64(file), apiKey)
      setFridgeIngredients(r.ingredients); setFridgeStep('choose')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Fehler', { duration:5000 }) }
    setFridgeLoading(false)
  }

  const handleFridgeAction = async (type: 'recipe'|'shopping') => {
    if (!apiKey) return
    setFridgeLoading(true); setFridgeType(type)
    const goal = profile?.goal==='lose'?'Abnehmen':profile?.goal==='gain'?'Muskelaufbau':'Fitness'
    try {
      const text = type==='recipe'
        ? await getRecipesFromIngredients(fridgeIngredients, goal, apiKey)
        : await getShoppingList(fridgeIngredients, goal, apiKey)
      setFridgeResult(text); setFridgeStep('result')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Fehler', { duration:5000 }) }
    setFridgeLoading(false)
  }

  const INSIGHT_COLORS:  Record<string,string> = { success:'rgba(16,185,129,0.12)', warning:'rgba(74,140,92,0.1)',  info:'rgba(59,130,246,0.12)', tip:'rgba(139,92,246,0.12)' }
  const INSIGHT_BORDERS: Record<string,string> = { success:'rgba(16,185,129,0.25)', warning:'rgba(74,140,92,0.22)', info:'rgba(59,130,246,0.25)', tip:'rgba(139,92,246,0.25)' }

  const QUICK = [
    { label:'😊 Wie geht\'s?',  text:'Ich wollte kurz erzählen wie heute so war.' },
    { label:'💡 Was essen?',    text:'Was soll ich heute noch essen?' },
    { label:'🔥 Heißhunger',   text:'Ich habe gerade Heißhunger auf Süßes.' },
    { label:'💪 Protein-Tipp', text:'Ich komme nicht auf mein Protein-Ziel. Was kann ich machen?' },
    { label:'🏃 Nach Sport',   text:'Ich komme gerade vom Training – was soll ich essen?' },
    { label:'😔 Frustration',  text:'Ich bin frustriert, ich halte meine Ziele nicht ein.' },
  ]

  const TABS = [
    { id:'kalo'   as const, label:'🤖 Kalo'        },
    { id:'coach'  as const, label:'🧠 Coach'       },
    { id:'report' as const, label:'📊 Bericht'     },
    { id:'fridge' as const, label:'🧊 Kühlschrank' },
  ]

  const glassInput = { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(74,140,92,0.1)', borderRadius:20, color:'var(--text-1)', padding:'14px 18px', width:'100%', fontSize:15, fontWeight:500 } as const
  const firstName  = profile?.name?.split(' ')[0] ?? ''
  const hasPersonality = userPersonality.favoriteFoods.length + userPersonality.weaknesses.length + userPersonality.motivations.length > 0

  return (
    <div className="flex flex-col overflow-x-hidden" style={{ height:'100dvh', background:'var(--bg)', paddingBottom:'calc(110px + max(env(safe-area-inset-bottom),20px))' }}>

      {/* Header */}
      <div className="pt-safe px-5 pb-4 flex-shrink-0" style={{ background:'var(--bg)', borderBottom:'1px solid rgba(125,184,138,0.15)' }}>
        <h1 className="text-2xl font-black mb-3" style={{ color:'var(--text-1)' }}>
          {tab==='kalo'?'🤖 Kalo':tab==='coach'?'🧠 Coach':tab==='report'?'📊 Wochenbericht':'🧊 Kühlschrank'}
        </h1>
        <div className="flex gap-1.5 p-1.5 rounded-2xl" style={{ background:'rgba(74,140,92,0.06)', border:'1px solid rgba(74,140,92,0.08)' }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
              style={tab===t.id ? { background:'var(--grad-gold)', color:'#fff', boxShadow:'var(--shadow-gold)' } : { color:'var(--text-3)' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Kalo Chat ── */}
      {tab==='kalo' && (
        <>
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-3 space-y-3 scroll-pb">

            {/* Kalo kennt dich */}
            {hasPersonality && (
              <>
                <button onClick={() => setShowPersonality((v) => !v)}
                  className="glass w-full p-3 flex items-center justify-between"
                  style={{ background:'rgba(74,140,92,0.05)', borderColor:'rgba(74,140,92,0.15)' }}>
                  <div className="flex items-center gap-2">
                    <Brain size={14} style={{ color:'#7db88a' }}/>
                    <span className="text-xs font-black" style={{ color:'#7db88a' }}>Kalo kennt dich</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                      style={{ background:'rgba(74,140,92,0.15)', color:'#7db88a' }}>
                      {userPersonality.favoriteFoods.length + userPersonality.weaknesses.length + userPersonality.motivations.length} Fakten
                    </span>
                  </div>
                  {showPersonality ? <ChevronUp size={14} style={{ color:'var(--text-3)' }}/> : <ChevronDown size={14} style={{ color:'var(--text-3)' }}/>}
                </button>
                {showPersonality && (
                  <div className="glass p-4 space-y-3" style={{ background:'rgba(74,140,92,0.03)' }}>
                    {userPersonality.favoriteFoods.length > 0 && (
                      <div>
                        <p className="text-xs font-black mb-1.5" style={{ color:'#10b981' }}>💚 Lieblingsessen</p>
                        <div className="flex flex-wrap gap-1.5">
                          {userPersonality.favoriteFoods.map((f, i) => (
                            <span key={i} className="text-xs px-2 py-1 rounded-full"
                              style={{ background:'rgba(16,185,129,0.12)', color:'#10b981', border:'1px solid rgba(16,185,129,0.2)' }}>{f}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {userPersonality.weaknesses.length > 0 && (
                      <div>
                        <p className="text-xs font-black mb-1.5" style={{ color:'#f59e0b' }}>⚠️ Schwachstellen</p>
                        <div className="flex flex-wrap gap-1.5">
                          {userPersonality.weaknesses.map((w, i) => (
                            <span key={i} className="text-xs px-2 py-1 rounded-full"
                              style={{ background:'rgba(245,158,11,0.1)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.2)' }}>{w}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {userPersonality.motivations.length > 0 && (
                      <div>
                        <p className="text-xs font-black mb-1.5" style={{ color:'#3b82f6' }}>💙 Motivationen</p>
                        <div className="flex flex-wrap gap-1.5">
                          {userPersonality.motivations.map((m, i) => (
                            <span key={i} className="text-xs px-2 py-1 rounded-full"
                              style={{ background:'rgba(59,130,246,0.1)', color:'#3b82f6', border:'1px solid rgba(59,130,246,0.2)' }}>{m}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {userPersonality.stressEatingPattern && (
                      <p className="text-xs" style={{ color:'var(--text-3)' }}>⚡ Stress-Essen-Muster erkannt</p>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Daily question */}
            {(dailyQuestion || questionLoading) && (
              <div className="glass p-4" style={{ background:'rgba(251,191,36,0.06)', borderColor:'rgba(251,191,36,0.2)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Heart size={14} style={{ color:'#f59e0b' }}/>
                  <p className="text-xs font-black" style={{ color:'#f59e0b' }}>Kalo fragt dich heute</p>
                  {questionLoading && <Loader size={11} className="animate-spin ml-auto" style={{ color:'var(--text-3)' }}/>}
                </div>
                {dailyQuestion && (
                  <p className="text-sm font-semibold leading-relaxed" style={{ color:'var(--text-1)' }}>{dailyQuestion}</p>
                )}
              </div>
            )}

            {/* Empty state */}
            {kaloMessages.length === 0 && (
              <div>
                <div className="text-center py-4 mb-4">
                  <p className="text-5xl mb-2">🤖</p>
                  <p className="font-black text-lg" style={{ color:'var(--text-1)' }}>Hey {firstName}! 👋</p>
                  <p className="text-sm mt-1" style={{ color:'var(--text-3)' }}>Dein persönlicher Ernährungsbegleiter</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUICK.map((q) => (
                    <button key={q.label} onClick={() => send(q.text)}
                      className="glass glass-press rounded-2xl px-3.5 py-2.5 text-sm font-semibold"
                      style={{ color:'var(--text-1)' }}>{q.label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {kaloMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role==='user'?'justify-end':'justify-start'}`}>
                {msg.role==='assistant' && (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm mr-2 mt-1 flex-shrink-0"
                    style={{ background:'rgba(74,140,92,0.15)', border:'1px solid rgba(74,140,92,0.18)' }}>🤖</div>
                )}
                <div className={`max-w-[83%] px-4 py-3 text-sm leading-relaxed ${msg.role==='user'?'bubble-user':'bubble-ai'}`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background:'rgba(74,140,92,0.15)', border:'1px solid rgba(74,140,92,0.18)' }}>🤖</div>
                <div className="bubble-ai px-4 py-3 flex items-center gap-2">
                  <Loader size={13} className="animate-spin" style={{ color:'var(--text-3)' }}/>
                  <span className="text-sm" style={{ color:'var(--text-3)' }}>Kalo denkt nach…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Input bar */}
          <div className="flex-shrink-0 px-4 py-3" style={{ background:'var(--bg)', borderTop:'1px solid rgba(74,140,92,0.08)' }}>
            {kaloMessages.length > 0 && (
              <button onClick={clearKaloMsgs} className="flex items-center gap-1 text-xs mb-2 glass-press" style={{ color:'var(--text-3)' }}>
                <RefreshCw size={11}/>Chat leeren
              </button>
            )}
            <div className="flex items-center gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key==='Enter'&&!e.shiftKey&&send()}
                placeholder={`Erzähl mir, ${firstName || 'wie geht\'s'}…`}
                style={{ ...glassInput, flex:1 }}/>
              <button onClick={() => send()} disabled={!input.trim()||loading||!apiKey}
                className="btn-gold w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 disabled:opacity-40">
                <Send size={16}/>
              </button>
            </div>
            {!apiKey && <p className="text-xs mt-1.5" style={{ color:'#ef4444' }}>⚠️ API Key fehlt → Profil → API Keys</p>}
          </div>
        </>
      )}

      {/* ── Coach ── */}
      {tab==='coach' && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-4 space-y-3 scroll-pb">

          {/* Coaching profile summary */}
          {coachingProfile?.aiPersonalizationSummary && (
            <div className="glass p-4" style={{ background:'rgba(74,140,92,0.06)', borderColor:'rgba(74,140,92,0.2)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} style={{ color:'#4a8c5c' }}/>
                <p className="text-xs font-black tracking-wide" style={{ color:'#4a8c5c' }}>DEIN PERSÖNLICHES PROFIL</p>
              </div>
              <p className="text-sm leading-relaxed" style={{ color:'var(--text-1)' }}>{coachingProfile.aiPersonalizationSummary}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {coachingProfile.mainGoals.map((g) => (
                  <span key={g} className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                    style={{ background:'rgba(74,140,92,0.12)', color:'#7db88a', border:'1px solid rgba(74,140,92,0.2)' }}>
                    {g==='muscle'?'💪 Muskeln':g==='fat_loss'?'🔥 Fett verlieren':g==='performance'?'⚡ Performance':g==='sleep'?'😴 Schlaf':g==='health'?'🧬 Gesünder':g==='endurance'?'🏃 Ausdauer':g}
                  </span>
                ))}
                {coachingProfile.sportTypes.map((s) => (
                  <span key={s} className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                    style={{ background:'rgba(59,130,246,0.1)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.15)' }}>
                    {s==='strength'?'🏋️':s==='running'?'🏃':s==='cycling'?'🚴':s==='swimming'?'🏊':s==='yoga'?'🧘':s==='martial'?'🥊':'🎯'} {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recovery-based coaching card */}
          {coachingProfile && !coachingProfile.aiPersonalizationSummary && (
            <div className="glass p-4" style={{ background:'rgba(74,140,92,0.04)' }}>
              <p className="text-xs font-black mb-1" style={{ color:'#4a8c5c' }}>COACHING PROFIL</p>
              <p className="text-sm" style={{ color:'var(--text-2)' }}>
                {coachingProfile.trainingDaysPerWeek}× Training/Woche · {coachingProfile.dietType} · Schlaf {coachingProfile.sleepTime}–{coachingProfile.wakeTime}
              </p>
            </div>
          )}

          {(briefingLoading || morningBriefing) && (
            <div className="glass p-4" style={{ background:'rgba(251,191,36,0.06)', borderColor:'rgba(251,191,36,0.25)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Sun size={16} style={{ color:'#7db88a' }}/>
                <p className="text-xs font-black tracking-widest uppercase" style={{ color:'#7db88a' }}>Guten Morgen · Tagesbriefing</p>
                {briefingLoading && <Loader size={12} className="animate-spin ml-auto" style={{ color:'var(--text-3)' }}/>}
              </div>
              {briefingLoading && !morningBriefing && <p className="text-xs" style={{ color:'var(--text-3)' }}>Analysiere gestrige Daten…</p>}
              {morningBriefing && (
                <>
                  <p className="text-sm font-semibold mb-3 leading-relaxed" style={{ color:'var(--text-1)' }}>{morningBriefing.greeting}</p>
                  <div className="space-y-2.5">
                    {morningBriefing.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="text-xl flex-shrink-0 mt-0.5">{item.emoji}</span>
                        <div style={{ minWidth:0 }}>
                          <p className="text-xs font-black" style={{ color:'var(--text-1)' }}>{item.title}</p>
                          <p className="text-xs mt-0.5 leading-relaxed" style={{ color:'var(--text-2)' }}>{item.text}</p>
                          <p className="text-xs mt-0.5 font-semibold" style={{ color:'rgba(251,191,36,0.7)' }}>Quelle: {item.source}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {morningBriefing.supplementTip && (
                    <div className="mt-3 pt-3" style={{ borderTop:'1px solid rgba(74,140,92,0.08)' }}>
                      <p className="text-xs" style={{ color:'var(--text-3)' }}>💊 {morningBriefing.supplementTip}</p>
                    </div>
                  )}
                  {morningBriefing.todayFocus && (
                    <div className="mt-2 rounded-2xl px-3 py-2" style={{ background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.2)' }}>
                      <p className="text-xs font-black" style={{ color:'#7db88a' }}>🎯 Fokus heute: {morningBriefing.todayFocus}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {medTargets && profile && (
            <div className="glass p-4">
              <p className="label mb-3">📊 Deine Zielwerte (DGE 2023 · ISSN)</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label:'Protein',       value:`${medTargets.proteinMin}–${medTargets.proteinMax}g`, sub:'ISSN 2017', color:'#10b981' },
                  { label:'Wasser',        value:`${(medTargets.waterTarget/1000).toFixed(1)}L`,       sub:'DGE 2023', color:'#38bdf8' },
                  { label:'Ballaststoffe', value:`${medTargets.fiberTarget}g`,                         sub:'DGE 2023', color:'#8b5cf6' },
                  { label:'Max. Zucker',   value:`${medTargets.maxSugar}g`,                            sub:'WHO 2023', color:'#ef4444' },
                ].map((t) => (
                  <div key={t.label} className="rounded-2xl p-3" style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(74,140,92,0.08)' }}>
                    <p className="text-xs font-bold" style={{ color:t.color }}>{t.value}</p>
                    <p className="text-xs" style={{ color:'var(--text-1)' }}>{t.label}</p>
                    <p style={{ fontSize:10, color:'var(--text-3)' }}>{t.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="glass p-5" style={{ background:'rgba(74,140,92,0.05)', borderColor:'rgba(74,140,92,0.18)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-14 h-14 rounded-3xl flex items-center justify-center text-3xl flex-shrink-0"
                style={{ background:'rgba(74,140,92,0.1)', border:'1px solid rgba(74,140,92,0.18)' }}>🧠</div>
              <div>
                <p className="font-black" style={{ color:'var(--text-1)' }}>7-Tage-Analyse</p>
                <p className="text-xs" style={{ color:'var(--text-3)' }}>Muster · Wochentage · Sport-Essen-Zusammenhang</p>
              </div>
            </div>
            <button onClick={runCoachAnalysis} disabled={coachLoading||!apiKey}
              className="btn-gold w-full py-4 text-sm flex items-center justify-center gap-2 disabled:opacity-40" style={{ minHeight:50 }}>
              {coachLoading
                ? <><Loader size={16} className="animate-spin"/>Analysiere…</>
                : <><TrendingUp size={16}/>{coachReport?'Neu analysieren':'Jetzt analysieren'}</>}
            </button>
            {!apiKey && <p className="text-xs mt-2 text-center" style={{ color:'#ef4444' }}>⚠️ API Key fehlt → Profil → API Keys</p>}
          </div>

          {coachReport && (
            <>
              <div className="glass p-4">
                <p className="text-sm leading-relaxed" style={{ color:'var(--text-1)' }}>{coachReport.greeting}</p>
              </div>
              <div className="glass p-4 flex items-center gap-4">
                <div className="flex-shrink-0 relative w-16 h-16">
                  <svg width="64" height="64" style={{ transform:'rotate(-90deg)' }}>
                    <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(74,140,92,0.08)" strokeWidth="8"/>
                    <circle cx="32" cy="32" r="26" fill="none" stroke="#f59e0b" strokeWidth="8"
                      strokeDasharray={`${2*Math.PI*26*coachReport.weeklyScore/100} ${2*Math.PI*26}`} strokeLinecap="round"/>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-black" style={{ color:'var(--gold)' }}>{coachReport.weeklyScore}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-black" style={{ color:'var(--text-1)' }}>Wochen-Score</p>
                  <p className="text-xs mt-0.5" style={{ color:'var(--text-2)' }}>{coachReport.weekSummary}</p>
                </div>
              </div>
              <p className="label px-1">Insights dieser Woche</p>
              <div className="space-y-2">
                {coachReport.insights.map((ins, i) => (
                  <div key={i} className="glass p-4 flex items-start gap-3"
                    style={{ background:INSIGHT_COLORS[ins.type], borderColor:INSIGHT_BORDERS[ins.type] }}>
                    <span className="text-2xl flex-shrink-0 mt-0.5">{ins.emoji}</span>
                    <div style={{ minWidth:0 }}>
                      <p className="text-sm font-black" style={{ color:'var(--text-1)' }}>{ins.title}</p>
                      <p className="text-xs mt-1 leading-relaxed" style={{ color:'var(--text-2)' }}>{ins.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              {coachReport.patterns?.length > 0 && (
                <>
                  <p className="label px-1">Erkannte Verhaltensmuster</p>
                  <div className="space-y-2">
                    {coachReport.patterns.map((p, i) => (
                      <div key={i} className="glass p-4 flex items-start gap-3"
                        style={{ background:'rgba(139,92,246,0.08)', borderColor:'rgba(139,92,246,0.2)' }}>
                        <span className="text-2xl flex-shrink-0 mt-0.5">{p.emoji}</span>
                        <div style={{ minWidth:0 }}>
                          <p className="text-sm font-black" style={{ color:'var(--text-1)' }}>{p.title}</p>
                          <p className="text-xs mt-1 leading-relaxed" style={{ color:'var(--text-2)' }}>{p.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {coachReport.weeklyChallenge && (
                <div className="glass p-4 flex items-start gap-3"
                  style={{ background:'rgba(74,140,92,0.06)', borderColor:'rgba(74,140,92,0.25)' }}>
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background:'rgba(74,140,92,0.15)', border:'1px solid rgba(74,140,92,0.18)' }}>
                    <Zap size={18} style={{ color:'#4a8c5c' }}/>
                  </div>
                  <div style={{ minWidth:0 }}>
                    <p className="text-sm font-black" style={{ color:'var(--gold)' }}>Deine Challenge</p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color:'var(--text-1)' }}>{coachReport.weeklyChallenge}</p>
                  </div>
                </div>
              )}
              <div className="glass p-4" style={{ background:'rgba(59,130,246,0.08)', borderColor:'rgba(59,130,246,0.2)' }}>
                <p className="label mb-1.5">Fokus nächste Woche</p>
                <p className="text-sm" style={{ color:'var(--text-1)' }}>{coachReport.focus}</p>
              </div>
              <button onClick={() => setTab('kalo')} className="glass glass-press w-full p-4 flex items-center gap-3 text-left">
                <span className="text-xl flex-shrink-0">💬</span>
                <div className="flex-1" style={{ minWidth:0 }}>
                  <p className="text-sm font-black" style={{ color:'var(--text-1)' }}>Kalo direkt fragen</p>
                  <p className="text-xs" style={{ color:'var(--text-3)' }}>Weitere Fragen im Chat stellen</p>
                </div>
                <ChevronRight size={15} style={{ color:'var(--text-3)', flexShrink:0 }}/>
              </button>
            </>
          )}

          {!coachReport && !coachLoading && (
            <div className="glass p-8 text-center">
              <p className="text-3xl mb-2">🔍</p>
              <p className="text-sm font-bold mb-1" style={{ color:'var(--text-1)' }}>Noch keine Analyse</p>
              <p className="text-xs" style={{ color:'var(--text-3)' }}>Tippe auf „Jetzt analysieren" um deine Daten auszuwerten</p>
            </div>
          )}
        </div>
      )}

      {/* ── Wochenbericht ── */}
      {tab==='report' && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-4 space-y-3 scroll-pb">
          <div className="glass p-5" style={{ background:'rgba(74,140,92,0.05)', borderColor:'rgba(74,140,92,0.18)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-14 h-14 rounded-3xl flex items-center justify-center text-3xl flex-shrink-0"
                style={{ background:'rgba(74,140,92,0.1)', border:'1px solid rgba(74,140,92,0.18)' }}>📊</div>
              <div>
                <p className="font-black" style={{ color:'var(--text-1)' }}>Kalo's Wochenbericht</p>
                <p className="text-xs" style={{ color:'var(--text-3)' }}>Persönliche Auswertung der letzten 7 Tage</p>
              </div>
            </div>
            <button onClick={genReport} disabled={reportLoading||!apiKey}
              className="btn-gold w-full py-4 text-sm flex items-center justify-center gap-2 disabled:opacity-40" style={{ minHeight:50 }}>
              {reportLoading
                ? <><Loader size={16} className="animate-spin"/>Kalo schreibt deinen Bericht…</>
                : <><Sparkles size={16}/>{weeklyReport?'Neu generieren':'Wochenbericht erstellen'}</>}
            </button>
            {!apiKey && <p className="text-xs mt-2 text-center" style={{ color:'#ef4444' }}>⚠️ API Key fehlt</p>}
          </div>

          {weeklyReport && (
            <div className="glass p-5">
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color:'var(--text-1)' }}>{weeklyReport}</p>
            </div>
          )}

          {!weeklyReport && !reportLoading && (
            <div className="glass p-8 text-center">
              <p className="text-3xl mb-2">📝</p>
              <p className="text-sm font-bold mb-1" style={{ color:'var(--text-1)' }}>Kein Bericht vorhanden</p>
              <p className="text-xs" style={{ color:'var(--text-3)' }}>Kalo wertet deine letzten 7 Tage aus und gibt dir persönliches Feedback – abgestimmt auf das, was er über dich gelernt hat.</p>
            </div>
          )}

          {(userPersonality.favoriteFoods.length > 0 || userPersonality.weaknesses.length > 0 || userPersonality.successPatterns.length > 0) && (
            <div className="glass p-4">
              <p className="label mb-3">🧠 Was Kalo über dich gelernt hat</p>
              <div className="space-y-3">
                {userPersonality.favoriteFoods.length > 0 && (
                  <div>
                    <p className="text-xs font-bold mb-1" style={{ color:'#10b981' }}>Lieblingsessen</p>
                    <p className="text-sm" style={{ color:'var(--text-2)' }}>{userPersonality.favoriteFoods.join(', ')}</p>
                  </div>
                )}
                {userPersonality.weaknesses.length > 0 && (
                  <div>
                    <p className="text-xs font-bold mb-1" style={{ color:'#f59e0b' }}>Bereiche zum Arbeiten</p>
                    <p className="text-sm" style={{ color:'var(--text-2)' }}>{userPersonality.weaknesses.join(', ')}</p>
                  </div>
                )}
                {userPersonality.successPatterns.length > 0 && (
                  <div>
                    <p className="text-xs font-bold mb-1" style={{ color:'#3b82f6' }}>Was dir hilft</p>
                    <p className="text-sm" style={{ color:'var(--text-2)' }}>{userPersonality.successPatterns.join(', ')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Fridge ── */}
      {tab==='fridge' && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-4 space-y-3 scroll-pb">
          {fridgeStep==='scan' && (
            <>
              <div className="glass p-4" style={{ background:'rgba(56,189,248,0.06)', borderColor:'rgba(56,189,248,0.15)' }}>
                <p className="text-sm font-bold mb-2" style={{ color:'var(--text-1)' }}>🧊 Wie funktioniert's:</p>
                <ol className="text-sm space-y-1" style={{ color:'var(--text-2)' }}>
                  <li>1. Foto vom geöffneten Kühlschrank</li>
                  <li>2. KI erkennt automatisch alle Produkte</li>
                  <li>3. Rezept vorschlagen oder Einkaufsliste</li>
                </ol>
              </div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFridgePhoto(e.target.files[0])}/>
              <button onClick={() => fileRef.current?.click()} disabled={fridgeLoading}
                className="w-full py-10 rounded-3xl flex flex-col items-center gap-3 glass-press disabled:opacity-50"
                style={{ border:'2px dashed rgba(56,189,248,0.3)', background:'rgba(56,189,248,0.04)' }}>
                {fridgeLoading
                  ? <><Loader size={32} className="animate-spin" style={{ color:'#38bdf8' }}/><span style={{ color:'var(--text-2)' }}>KI analysiert…</span></>
                  : <><Refrigerator size={40} style={{ color:'#38bdf8' }}/><span className="font-bold" style={{ color:'var(--text-1)' }}>Kühlschrank fotografieren</span></>}
              </button>
              {!apiKey && <p className="text-center text-xs" style={{ color:'#ef4444' }}>⚠️ API Key fehlt</p>}
            </>
          )}
          {fridgeStep==='choose' && (
            <>
              {fridgePreview && <img src={fridgePreview} alt="" className="w-full h-40 object-cover rounded-2xl"/>}
              <div className="glass p-4">
                <p className="label mb-3">🔍 Erkannte Zutaten ({fridgeIngredients.length})</p>
                <div className="flex flex-wrap gap-2">
                  {fridgeIngredients.map((ing, i) => (
                    <span key={i} className="rounded-2xl px-3 py-1 text-sm font-medium"
                      style={{ background:'rgba(56,189,248,0.1)', border:'1px solid rgba(56,189,248,0.2)', color:'#38bdf8' }}>{ing}</span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { type:'recipe' as const, icon:'🍳', label:'Rezept vorschlagen' },
                  { type:'shopping' as const, icon:'🛒', label:'Einkaufsliste' },
                ]).map((opt) => (
                  <button key={opt.type} onClick={() => handleFridgeAction(opt.type)} disabled={fridgeLoading}
                    className="glass glass-press p-5 text-center disabled:opacity-50">
                    <p className="text-3xl mb-2">{opt.icon}</p>
                    <p className="font-bold text-sm" style={{ color:'var(--text-1)' }}>{opt.label}</p>
                  </button>
                ))}
              </div>
              {fridgeLoading && <p className="text-center text-sm flex items-center justify-center gap-2" style={{ color:'var(--text-3)' }}><Loader size={14} className="animate-spin"/>KI denkt nach…</p>}
              <button onClick={() => { setFridgeStep('scan'); setFridgePreview(null); setFridgeIngredients([]) }}
                className="w-full text-sm glass-press py-2" style={{ color:'var(--text-3)' }}>Neu starten</button>
            </>
          )}
          {fridgeStep==='result' && (
            <>
              <div className="glass p-4">
                <p className="label mb-3">{fridgeType==='recipe'?'🍳 Rezeptvorschläge':'🛒 Einkaufsliste'}</p>
                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed" style={{ color:'var(--text-2)' }}>{fridgeResult}</pre>
              </div>
              <button onClick={() => { setFridgeStep('scan'); setFridgePreview(null); setFridgeIngredients([]); setFridgeResult('') }}
                className="btn-gold w-full py-4 text-sm" style={{ minHeight:50 }}>Neuer Scan</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
