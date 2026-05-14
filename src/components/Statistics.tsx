import { useState, useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Scale, Camera, X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { getLast7Days, getLast30Days, formatDate, getDayName, uid, imageFileToDataUrl } from '../utils/calculations'
import toast from 'react-hot-toast'

const today = formatDate()


export default function Statistics() {
  const [activeTab, setActiveTab] = useState<'week'|'weight'|'photos'>('week')
  const [newWeight, setNewWeight] = useState('')
  const [showInput, setShowInput] = useState(false)
  const weightHistory       = useStore((s) => s.weightHistory)
  const addWeightEntry      = useStore((s) => s.addWeightEntry)
  const profile             = useStore((s) => s.profile)
  const foodLogs            = useStore((s) => s.foodLogs)
  const activityLogs        = useStore((s) => s.activityLogs)
  const beforeAfterPhotos   = useStore((s) => s.beforeAfterPhotos)
  const addBeforeAfterPhoto = useStore((s) => s.addBeforeAfterPhoto)
  const removeBeforeAfterPhoto = useStore((s) => s.removeBeforeAfterPhoto)

  const getStatsForDate = useStore((s) => s.getStatsForDate)
  const last7  = useMemo(() => getLast7Days(), [])
  const last30 = useMemo(() => getLast30Days(), [])

  const weekData = useMemo(() => last7.map((date) => {
    const calories = foodLogs.filter((l) => l.date === date).reduce((s, f) => s + (f.macros?.calories ?? 0), 0)
    const burned   = activityLogs.filter((l) => l.date === date).reduce((s, a) => s + a.caloriesBurned, 0)
    const protein  = foodLogs.filter((l) => l.date === date).reduce((s, f) => s + (f.macros?.protein ?? 0), 0)
    return { day: getDayName(date), calories: Math.round(calories), burned: Math.round(burned), protein: Math.round(protein) }
  }), [foodLogs, activityLogs, last7])

  const weightData = useMemo(() => weightHistory.slice(-30).map((w) => ({ date: w.date.slice(5), weight: w.weight })), [weightHistory])

  const totalDays = useMemo(() => last30.filter((d) => foodLogs.some((l) => l.date === d)).length, [last30, foodLogs])
  const goalDays  = useMemo(() => last30.filter((d) => getStatsForDate(d).goalMet).length, [last30, getStatsForDate])
  const avgCals   = useMemo(() => {
    const days = last7.filter((d) => foodLogs.some((l) => l.date === d))
    if (!days.length) return 0
    return Math.round(days.reduce((s, d) => s + foodLogs.filter((l) => l.date === d).reduce((s2, f) => s2 + (f.macros?.calories ?? 0), 0), 0) / days.length)
  }, [last7, foodLogs])

  const streak = useMemo(() => {
    const target = (() => {
      if (!profile) return 2000
      const w = Number(profile.weight)||75, h = Number(profile.height)||175, a = Number(profile.age)||25
      const bmr = profile.gender === 'male' ? 10*w+6.25*h-5*a+5 : 10*w+6.25*h-5*a-161
      const m: Record<string,number> = { sedentary:1.2,light:1.375,moderate:1.55,active:1.725,very_active:1.9 }
      return Math.round(bmr * (m[profile.activityLevel]??1.55))
    })()
    let count = 0
    const d = new Date()
    for (let i = 0; i < 365; i++) {
      const ds = d.toISOString().split('T')[0]
      const cals = foodLogs.filter((l) => l.date === ds).reduce((s, f) => s + (f.macros?.calories ?? 0), 0)
      const brnd = activityLogs.filter((l) => l.date === ds).reduce((s, a) => s + a.caloriesBurned, 0)
      if (cals > 0 && Math.abs((cals - brnd) - target) <= 200) count++
      else if (i > 0) break
      d.setDate(d.getDate() - 1)
    }
    return count
  }, [foodLogs, activityLogs, profile])

  const currentWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length-1].weight : profile?.weight
  const startWeight   = weightHistory.length > 0 ? weightHistory[0].weight : profile?.weight
  const weightChange  = (currentWeight && startWeight) ? Math.round((currentWeight - startWeight)*10)/10 : null

  const addWeight = () => {
    const w = parseFloat(newWeight)
    if (!w || w < 30 || w > 300) { toast.error('Ungültiges Gewicht'); return }
    addWeightEntry({ date: today, weight: w })
    toast.success(`${w} kg eingetragen! ✅`)
    setNewWeight(''); setShowInput(false)
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const url = await imageFileToDataUrl(file)
    addBeforeAfterPhoto({ id: uid(), date: today, photo: url, weight: profile?.weight })
    toast.success('Foto gespeichert! 📸')
  }

  const TABS = [{ id: 'week' as const, label: '📊 Woche' }, { id: 'weight' as const, label: '⚖️ Gewicht' }, { id: 'photos' as const, label: '📸 Fotos' }]

  return (
    <div className="pb-nav anim-fade">
      {/* Header */}
      <div className="grad-orange px-5 pt-safe pb-6 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/5" />
        <h1 className="text-white text-2xl font-black mb-3">Statistiken</h1>
        <div className="grid grid-cols-3 gap-2">
          {[{ v: `${avgCals}`, u: 'kcal/Tag', l: 'Ø Kalorien' }, { v: `${goalDays}`, u: 'Tage', l: 'Ziel erreicht' }, { v: `${totalDays}`, u: 'Tage', l: 'Eingetragen' }].map((s) => (
            <div key={s.l} className="bg-white/20 rounded-2xl p-3 text-center">
              <p className="text-white text-xl font-black">{s.v}</p>
              <p className="text-orange-100 text-[10px]">{s.u}</p>
              <p className="text-orange-200 text-[10px]">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* Streak Hero */}
        <div className="card p-5 mb-3 flex items-center gap-4">
          <div className="w-16 h-16 bg-orange-50 rounded-3xl flex items-center justify-center text-4xl">
            {streak > 0 ? '🔥' : '💤'}
          </div>
          <div>
            <p className="text-4xl font-black text-orange-500">{streak}</p>
            <p className="text-sm font-bold text-slate-700">{streak === 1 ? 'Tag' : 'Tage'} Streak</p>
            <p className="text-xs text-slate-400">{streak > 0 ? 'Weiter so! 🎉' : 'Starte heute!'}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 bg-slate-100 rounded-2xl p-1 mb-4">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === t.id ? 'bg-white text-orange-500 shadow-sm' : 'text-slate-500'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Weekly Charts */}
        {activeTab === 'week' && (
          <div className="space-y-3">
            <div className="card p-4">
              <p className="text-sm font-bold text-slate-700 mb-3">Kalorien & Sport (7 Tage)</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={weekData} barSize={16} barGap={4}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: '600' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }} />
                  <Bar dataKey="calories" fill="#3b82f6" radius={[6,6,0,0]} name="Kcal" />
                  <Bar dataKey="burned"   fill="#10b981" radius={[6,6,0,0]} name="Verbrannt" />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-blue-500 rounded-sm inline-block" />Gegessen</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-green-500 rounded-sm inline-block" />Verbrannt</span>
              </div>
            </div>

            <div className="card p-4">
              <p className="text-sm font-bold text-slate-700 mb-3">Eiweiß (7 Tage)</p>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={weekData} barSize={20}>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: '600' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }} />
                  <Bar dataKey="protein" fill="#8b5cf6" radius={[6,6,0,0]} name="Eiweiß (g)" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 30-day grid */}
            <div className="card p-4">
              <p className="text-sm font-bold text-slate-700 mb-3">Zielerreichung (30 Tage)</p>
              <div className="flex flex-wrap gap-1.5">
                {last30.map((date) => {
                  const s = getStatsForDate(date)
                  const hasData = s.totalCalories > 0
                  return (
                    <div key={date} title={`${date}: ${Math.round(s.totalCalories)} kcal`}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all ${!hasData ? 'bg-slate-100 text-slate-300' : s.goalMet ? 'bg-green-400 text-white' : 'bg-red-200 text-red-600'}`}>
                      {hasData ? (s.goalMet ? '✓' : '✗') : '·'}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Weight */}
        {activeTab === 'weight' && (
          <div className="space-y-3">
            {currentWeight && (
              <div className="card p-4 flex items-center gap-4">
                <div>
                  <p className="text-4xl font-black text-slate-900">{currentWeight}</p>
                  <p className="text-sm text-slate-400">kg aktuell</p>
                </div>
                <div className="flex-1" />
                <div className="text-right">
                  {weightChange !== null && (
                    <>
                      <p className={`text-xl font-black ${weightChange <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {weightChange > 0 ? '+' : ''}{weightChange} kg
                      </p>
                      <p className="text-xs text-slate-400">Veränderung</p>
                    </>
                  )}
                  {profile?.targetWeight && (
                    <p className="text-sm text-slate-500 mt-1">Ziel: {profile.targetWeight} kg</p>
                  )}
                </div>
              </div>
            )}

            {weightData.length > 1 && (
              <div className="card p-4">
                <p className="text-sm font-bold text-slate-700 mb-3">Verlauf</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={weightData}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis domain={['auto','auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }} />
                    <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} name="kg" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {showInput ? (
              <div className="card p-4">
                <p className="text-sm font-bold text-slate-700 mb-3">Gewicht eintragen</p>
                <div className="flex items-center gap-2 bg-slate-50 rounded-2xl px-4 py-3 mb-3">
                  <input autoFocus type="number" step="0.1" value={newWeight} onChange={(e) => setNewWeight(e.target.value)}
                    className="flex-1 text-xl font-black bg-transparent outline-none text-slate-800" placeholder="75.5" />
                  <span className="text-slate-400 font-medium">kg</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowInput(false)} className="flex-1 py-3 bg-slate-100 rounded-2xl text-sm font-bold text-slate-600">Abbrechen</button>
                  <button onClick={addWeight} className="flex-1 py-3 bg-blue-500 rounded-2xl text-sm font-bold text-white">Speichern</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowInput(true)} className="w-full py-4 bg-blue-500 rounded-3xl text-white font-black text-base flex items-center justify-center gap-2">
                <Scale size={18} />Gewicht eintragen
              </button>
            )}

            {weightHistory.length > 0 && (
              <div className="card divide-y divide-slate-50">
                {weightHistory.slice(-8).reverse().map((entry) => (
                  <div key={entry.date} className="flex items-center justify-between px-4 py-3">
                    <p className="text-sm text-slate-500">{entry.date.split('-').reverse().join('.')}</p>
                    <p className="text-sm font-black text-slate-800">{entry.weight} kg</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Photos */}
        {activeTab === 'photos' && (
          <div className="space-y-3">
            <div className="bg-purple-50 rounded-2xl p-4">
              <p className="text-sm text-purple-700 font-medium">Dokumentiere deinen Körper-Fortschritt mit Vorher/Nachher-Fotos.</p>
            </div>
            <label className="w-full py-4 bg-purple-500 rounded-3xl text-white font-black text-base flex items-center justify-center gap-2 cursor-pointer active:bg-purple-600 transition">
              <Camera size={18} />Foto hinzufügen
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
            </label>
            {beforeAfterPhotos.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {beforeAfterPhotos.slice().reverse().map((photo) => (
                  <div key={photo.id} className="card overflow-hidden">
                    <img src={photo.photo} alt="" className="w-full h-44 object-cover" />
                    <div className="px-3 py-2 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-700">{photo.date.split('-').reverse().join('.')}</p>
                        {photo.weight && <p className="text-[10px] text-slate-400">{photo.weight} kg</p>}
                      </div>
                      <button onClick={() => removeBeforeAfterPhoto(photo.id)} className="text-slate-300 active:text-red-400 p-1"><X size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card p-8 text-center">
                <p className="text-3xl mb-2">📸</p>
                <p className="text-sm text-slate-400">Noch keine Fotos</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
