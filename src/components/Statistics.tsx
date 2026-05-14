import { useState } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Scale, Camera, X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { getLast7Days, getLast30Days, formatDate, getDayName, uid, imageFileToDataUrl } from '../utils/calculations'
import toast from 'react-hot-toast'

export default function Statistics() {
  const [activeTab, setActiveTab] = useState<'week' | 'weight' | 'photos'>('week')
  const [newWeight, setNewWeight] = useState('')
  const [showWeightInput, setShowWeightInput] = useState(false)
  const weightHistory = useStore((s) => s.weightHistory)
  const addWeightEntry = useStore((s) => s.addWeightEntry)
  const profile = useStore((s) => s.profile)
  const getStatsForDate = useStore((s) => s.getStatsForDate)
  const beforeAfterPhotos = useStore((s) => s.beforeAfterPhotos)
  const addBeforeAfterPhoto = useStore((s) => s.addBeforeAfterPhoto)
  const removeBeforeAfterPhoto = useStore((s) => s.removeBeforeAfterPhoto)
  const today = formatDate()
  const last7 = getLast7Days()
  const last30 = getLast30Days()

  const weekData = last7.map((date) => {
    const s = getStatsForDate(date)
    return { day: getDayName(date), calories: Math.round(s.totalCalories), burned: Math.round(s.caloriesBurned), protein: Math.round(s.totalProtein) }
  })

  const weightData = weightHistory.slice(-30).map((w) => ({
    date: w.date.slice(5), weight: w.weight,
  }))

  const totalDays = last30.filter((d) => getStatsForDate(d).totalCalories > 0).length
  const goalDays = last30.filter((d) => getStatsForDate(d).goalMet).length
  const avgCalories = totalDays > 0
    ? Math.round(last7.reduce((s, d) => s + getStatsForDate(d).totalCalories, 0) / 7)
    : 0

  const addWeight = () => {
    const w = parseFloat(newWeight)
    if (!w || w < 30 || w > 300) { toast.error('Ungültiges Gewicht'); return }
    addWeightEntry({ date: today, weight: w })
    toast.success(`${w} kg eingetragen!`)
    setNewWeight('')
    setShowWeightInput(false)
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await imageFileToDataUrl(file)
    addBeforeAfterPhoto({ id: uid(), date: today, photo: url, weight: profile?.weight, note: '' })
    toast.success('Foto gespeichert!')
  }

  const currentWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weight : profile?.weight
  const startWeight = weightHistory.length > 0 ? weightHistory[0].weight : profile?.weight
  const weightChange = currentWeight && startWeight ? Math.round((currentWeight - startWeight) * 10) / 10 : null

  return (
    <div className="pb-24 animate-fade-in">
      <div className="gradient-orange px-4 pt-12 pb-6 safe-top">
        <h1 className="text-white text-2xl font-bold mb-1">Statistiken</h1>
        <p className="text-orange-100 text-sm">Dein Fortschritt im Überblick</p>
        <div className="grid grid-cols-3 gap-3 mt-3">
          {[
            { label: 'Ø Kalorien', value: `${avgCalories}`, unit: 'kcal' },
            { label: 'Ziel erreicht', value: `${goalDays}`, unit: 'Tage' },
            { label: 'Eingetragen', value: `${totalDays}`, unit: 'Tage' },
          ].map((s) => (
            <div key={s.label} className="bg-white/20 rounded-2xl p-3 text-center">
              <div className="text-white text-xl font-bold">{s.value}</div>
              <div className="text-orange-100 text-xs">{s.unit}</div>
              <div className="text-orange-200 text-xs">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 mb-4">
          {(['week', 'weight', 'photos'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition ${activeTab === t ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500'}`}
            >
              {{ week: '📊 Woche', weight: '⚖️ Gewicht', photos: '📸 Fotos' }[t]}
            </button>
          ))}
        </div>

        {/* Weekly Charts */}
        {activeTab === 'week' && (
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Kalorien (7 Tage)</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={weekData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip formatter={(v) => [`${v} kcal`]} />
                  <Bar dataKey="calories" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="burned" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded-sm inline-block" />Gegessen</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-sm inline-block" />Verbrannt</span>
              </div>
            </div>

            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Eiweiß (7 Tage)</h3>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={weekData}>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip formatter={(v) => [`${v}g`]} />
                  <Bar dataKey="protein" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Zielerreichung letzte 30 Tage</h3>
              <div className="flex flex-wrap gap-1">
                {last30.map((date) => {
                  const s = getStatsForDate(date)
                  const hasData = s.totalCalories > 0
                  const met = s.goalMet
                  return (
                    <div
                      key={date}
                      title={`${date}: ${Math.round(s.totalCalories)} kcal`}
                      className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center ${
                        !hasData ? 'bg-gray-100' : met ? 'bg-green-400' : 'bg-red-200'
                      }`}
                    >
                      {hasData ? (met ? '✓' : '✗') : '·'}
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-4 mt-2 text-xs text-gray-400">
                <span><span className="text-green-500">✓</span> Ziel erreicht</span>
                <span><span className="text-red-400">✗</span> Nicht erreicht</span>
              </div>
            </div>
          </div>
        )}

        {/* Weight */}
        {activeTab === 'weight' && (
          <div className="space-y-4">
            {currentWeight && (
              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-3xl font-bold text-gray-800">{currentWeight} kg</div>
                    <div className="text-sm text-gray-400">Aktuelles Gewicht</div>
                  </div>
                  <div className="text-right">
                    {weightChange !== null && (
                      <div className={`text-xl font-bold ${weightChange <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {weightChange > 0 ? '+' : ''}{weightChange} kg
                      </div>
                    )}
                    {profile?.targetWeight && (
                      <div className="text-sm text-gray-400">Ziel: {profile.targetWeight} kg</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {weightData.length > 1 && (
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Gewichtsverlauf</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={weightData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                    />
                    <Tooltip formatter={(v) => [`${v} kg`]} />
                    <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {showWeightInput ? (
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Gewicht eintragen</h3>
                <div className="flex gap-2">
                  <input
                    type="number" step="0.1" value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    placeholder="z.B. 75.5"
                    className="flex-1 px-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-200"
                    autoFocus
                  />
                  <span className="self-center text-gray-500 text-sm">kg</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setShowWeightInput(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500">Abbrechen</button>
                  <button onClick={addWeight} className="flex-1 py-2.5 gradient-blue rounded-xl text-white font-semibold text-sm">Speichern</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowWeightInput(true)}
                className="w-full py-4 gradient-blue rounded-2xl text-white font-semibold flex items-center justify-center gap-2">
                <Scale size={18} /> Gewicht eintragen
              </button>
            )}

            {weightHistory.length > 0 && (
              <div className="card divide-y divide-gray-50">
                {weightHistory.slice(-10).reverse().map((entry) => (
                  <div key={entry.date} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-gray-500">{entry.date.split('-').reverse().join('.')}</span>
                    <span className="text-sm font-semibold text-gray-800">{entry.weight} kg</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Photos */}
        {activeTab === 'photos' && (
          <div className="space-y-4">
            <div className="bg-purple-50 rounded-2xl p-4 text-sm text-purple-700">
              Dokumentiere deinen Fortschritt mit Vorher/Nachher-Fotos.
            </div>
            <label className="w-full py-4 gradient-purple rounded-2xl text-white font-semibold flex items-center justify-center gap-2 cursor-pointer">
              <Camera size={18} />
              Foto hinzufügen
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
            </label>
            {beforeAfterPhotos.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {beforeAfterPhotos.slice().reverse().map((photo) => (
                  <div key={photo.id} className="relative card overflow-hidden">
                    <img src={photo.photo} alt="" className="w-full h-40 object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 flex items-center justify-between">
                      <div>
                        <div className="text-white text-xs">{photo.date.split('-').reverse().join('.')}</div>
                        {photo.weight && <div className="text-white/70 text-xs">{photo.weight} kg</div>}
                      </div>
                      <button onClick={() => removeBeforeAfterPhoto(photo.id)} className="text-white/70 p-1">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                <div className="text-3xl mb-2">📸</div>
                Noch keine Fotos
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
