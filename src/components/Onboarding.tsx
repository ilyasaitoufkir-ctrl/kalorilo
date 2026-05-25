import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { Gender, ActivityLevel, Goal, UserProfile } from '../types'

const ACTIVITY: { value: ActivityLevel; emoji: string; label: string; desc: string }[] = [
  { value:'sedentary',   emoji:'🛋️', label:'Sitzend',      desc:'Kaum Bewegung' },
  { value:'light',       emoji:'🚶', label:'Leicht aktiv', desc:'1–3x Sport/Woche' },
  { value:'moderate',    emoji:'🏃', label:'Moderat',      desc:'3–5x Sport/Woche' },
  { value:'active',      emoji:'⚡', label:'Sehr aktiv',   desc:'6–7x Sport/Woche' },
  { value:'very_active', emoji:'🏋️', label:'Sportler',     desc:'Täglich intensiv' },
]

export default function Onboarding() {
  const setProfile = useStore((s) => s.setProfile)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    name:'', age:'', weight:'', height:'',
    gender:'male' as Gender,
    activityLevel:'moderate' as ActivityLevel,
    goal:'lose' as Goal,
    targetWeight:'', targetWeeks:'12',
  })

  const steps = [
    { title:'Willkommen! 👋',    sub:'Lass uns loslegen' },
    { title:'Dein Körper',       sub:'Für genaue Berechnungen' },
    { title:'Aktivitätslevel',   sub:'Wie aktiv bist du?' },
    { title:'Dein Ziel',         sub:'Was möchtest du erreichen?' },
  ]

  const isValid = () => {
    if (step===0) return form.name.trim().length>0
    if (step===1) return form.age && form.weight && form.height
    if (step===2) return true
    if (step===3) return form.targetWeight && form.targetWeeks
    return true
  }

  const finish = () => {
    setProfile({
      name:form.name, age:parseInt(form.age), weight:parseFloat(form.weight), height:parseInt(form.height),
      gender:form.gender, activityLevel:form.activityLevel, goal:form.goal,
      targetWeight:parseFloat(form.targetWeight)||parseFloat(form.weight), targetWeeks:parseInt(form.targetWeeks),
    } as UserProfile)
  }

  const inputStyle = { background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:18, color:'#f1f5f9', padding:'16px', width:'100%', fontSize:16, fontWeight:600, outline:'none' } as const

  return (
    <div className="h-dvh flex flex-col overflow-y-auto overflow-x-hidden" style={{ background:'var(--bg)' }}>
      {/* Background orb */}
      <div className="fixed" style={{ top:-100, left:'50%', transform:'translateX(-50%)', width:500, height:500, background:'radial-gradient(circle,rgba(245,158,11,0.06) 0%,transparent 70%)', pointerEvents:'none', zIndex:0 }}/>

      <div className="flex flex-col justify-between flex-1 relative z-10 px-6 pt-safe pb-safe">
        {/* Logo */}
        <div className="text-center pt-10 pb-6">
          <div className="text-6xl mb-3">🥗</div>
          <h1 className="text-3xl font-black tracking-tight" style={{ color:'#f1f5f9' }}>Kalorilo</h1>
          <p className="text-sm mt-1" style={{ color:'#475569' }}>Dein smarter Ernährungsbegleiter</p>
        </div>

        {/* Card */}
        <div className="rounded-3xl p-6 flex-1 flex flex-col"
          style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(20px)' }}>

          {/* Progress */}
          <div className="flex gap-1.5 mb-6">
            {steps.map((_,i)=>(
              <div key={i} className="flex-1 h-1.5 rounded-full transition-all duration-400"
                style={{ background: i<=step ? 'var(--grad-gold)' : 'rgba(255,255,255,0.06)' }}/>
            ))}
          </div>

          <h2 className="text-xl font-black mb-1" style={{ color:'#f1f5f9' }}>{steps[step].title}</h2>
          <p className="text-sm mb-6" style={{ color:'#475569' }}>{steps[step].sub}</p>

          <div className="flex-1 space-y-3">
            {step===0 && (
              <input autoFocus value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}
                onKeyDown={(e)=>e.key==='Enter'&&form.name.trim()&&setStep(1)}
                style={inputStyle} placeholder="Dein Name"/>
            )}

            {step===1 && (
              <>
                <div className="flex gap-2">
                  {(['male','female'] as Gender[]).map((g)=>(
                    <button key={g} onClick={()=>setForm({...form,gender:g})}
                      className="flex-1 py-4 rounded-2xl font-bold transition-all"
                      style={form.gender===g ? { background:'var(--grad-gold)',color:'#fff' } : { background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'#94a3b8' }}>
                      {g==='male'?'♂ Mann':'♀ Frau'}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[{l:'Alter',k:'age',p:'25'},{l:'Gewicht kg',k:'weight',p:'75'},{l:'Größe cm',k:'height',p:'175'}].map((f)=>(
                    <div key={f.k}>
                      <p className="text-xs font-bold mb-1.5" style={{ color:'#475569' }}>{f.l}</p>
                      <input type="number" inputMode="decimal" value={(form as any)[f.k]} onChange={(e)=>setForm({...form,[f.k]:e.target.value})}
                        style={{ ...inputStyle, textAlign:'center', padding:'12px 8px' }} placeholder={f.p}/>
                    </div>
                  ))}
                </div>
              </>
            )}

            {step===2 && (
              <div className="space-y-2">
                {ACTIVITY.map((a)=>(
                  <button key={a.value} onClick={()=>setForm({...form,activityLevel:a.value})}
                    className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all"
                    style={form.activityLevel===a.value
                      ? { background:'var(--gold-dim)', border:'1px solid rgba(245,158,11,0.3)' }
                      : { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }
                    }>
                    <span className="text-xl">{a.emoji}</span>
                    <div>
                      <p className="text-sm font-bold" style={{ color:'#f1f5f9' }}>{a.label}</p>
                      <p className="text-xs" style={{ color:'#475569' }}>{a.desc}</p>
                    </div>
                    {form.activityLevel===a.value && <span className="ml-auto" style={{ color:'var(--gold)' }}>✓</span>}
                  </button>
                ))}
              </div>
            )}

            {step===3 && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {([['lose','📉','Abnehmen'],['maintain','➡️','Halten'],['gain','📈','Zunehmen']] as [Goal,string,string][]).map(([g,emoji,label])=>(
                    <button key={g} onClick={()=>setForm({...form,goal:g})}
                      className="py-4 rounded-2xl text-center transition-all"
                      style={form.goal===g
                        ? { background:'var(--gold-dim)', border:'1px solid rgba(245,158,11,0.3)' }
                        : { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }
                      }>
                      <p className="text-2xl mb-1">{emoji}</p>
                      <p className="text-xs font-bold" style={{ color:'#f1f5f9' }}>{label}</p>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs font-bold mb-1.5" style={{ color:'#475569' }}>Zielgewicht (kg)</p>
                    <input type="number" inputMode="decimal" value={form.targetWeight} onChange={(e)=>setForm({...form,targetWeight:e.target.value})}
                      style={inputStyle} placeholder="70"/>
                  </div>
                  <div>
                    <p className="text-xs font-bold mb-1.5" style={{ color:'#475569' }}>In Wochen</p>
                    <input type="number" inputMode="numeric" value={form.targetWeeks} onChange={(e)=>setForm({...form,targetWeeks:e.target.value})}
                      style={inputStyle} placeholder="12"/>
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => { if (!isValid()) return; if (step<steps.length-1) setStep(step+1); else finish() }}
            disabled={!isValid()}
            className="mt-6 w-full py-5 rounded-3xl font-black text-lg flex items-center justify-center gap-2 disabled:opacity-30 transition-all"
            style={{ background:'var(--grad-gold)', color:'#fff', boxShadow:'var(--shadow-gold)', minHeight:60 }}>
            {step<steps.length-1 ? <><span>Weiter</span><ChevronRight size={20}/></> : <span>Los geht's! 🚀</span>}
          </button>
        </div>

        <p className="text-center text-xs py-4" style={{ color:'#334155' }}>Daten werden nur lokal gespeichert</p>
      </div>
    </div>
  )
}
