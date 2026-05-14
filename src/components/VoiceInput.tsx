import { useState } from 'react'
import { Mic, MicOff, Loader } from 'lucide-react'
import { useVoice } from '../hooks/useVoice'
import { useStore } from '../store/useStore'
import { parseVoiceInput } from '../utils/api'
import { formatDate, uid } from '../utils/calculations'
import { FOOD_DATABASE, BRANDED_PRODUCTS, calculateMacros } from '../data/foodDatabase'
import { SPORTS_DATABASE, calculateCaloriesBurned } from '../data/sportsDatabase'
import type { MealType } from '../types'
import toast from 'react-hot-toast'

const today = formatDate()

interface Props {
  /** Which meal to add food to by default */
  defaultMealType?: MealType
  onDone?: () => void
}

export default function VoiceInput({ defaultMealType = 'snack', onDone }: Props) {
  const [processing, setProcessing] = useState(false)
  const [lastText, setLastText]     = useState('')
  const { listening, startListening, stopListening, isSupported } = useVoice()
  const apiKeys       = useStore((s) => s.apiKeys)
  const addFoodLog    = useStore((s) => s.addFoodLog)
  const addActivityLog= useStore((s) => s.addActivityLog)
  const addWater      = useStore((s) => s.addWater)
  const profile       = useStore((s) => s.profile)

  const handleResult = async (text: string) => {
    setLastText(text)
    const apiKey = apiKeys.anthropic || apiKeys.openai
    if (!apiKey) {
      toast.error('API Key fehlt → Profil → API Keys')
      return
    }
    setProcessing(true)
    try {
      const result = await parseVoiceInput(text, apiKey)

      if (result.type === 'food' && result.items?.length) {
        for (const item of result.items) {
          // Try to find in DB first, else use AI values
          const found = [...FOOD_DATABASE, ...BRANDED_PRODUCTS].find(
            (f) => f.name.toLowerCase().includes(item.name.toLowerCase()) ||
                   item.name.toLowerCase().includes(f.name.toLowerCase().split(' ')[0])
          )
          const macros = found
            ? calculateMacros(found, item.amount)
            : { calories: item.calories, protein: item.protein, fat: item.fat, carbs: item.carbs }
          const foodItem = found ?? {
            id: uid(), name: item.name, category: 'Spracheingabe',
            macros: { calories: item.calories, protein: item.protein, fat: item.fat, carbs: item.carbs },
          }
          addFoodLog({ id: uid(), date: today, mealType: result.mealType ?? defaultMealType, foodItem, amount: item.amount, macros, timestamp: Date.now() })
        }
        const total = result.items.reduce((s, i) => s + i.calories, 0)
        toast.success(`🎙️ ${result.items.map((i) => i.name).join(', ')} eingetragen! (${Math.round(total)} kcal)`)
        onDone?.()

      } else if (result.type === 'water' && result.amount) {
        addWater(today, result.amount)
        toast.success(`💧 ${result.amount}ml Wasser eingetragen!`)
        onDone?.()

      } else if (result.type === 'sport' && result.sport) {
        const { name, duration, caloriesBurned } = result.sport
        const sport = SPORTS_DATABASE.find(
          (s) => s.name.toLowerCase().includes(name.toLowerCase()) ||
                 name.toLowerCase().includes(s.name.toLowerCase())
        ) ?? { id: uid(), name, icon: '🏃', metLight: 5, metMedium: 7, metIntense: 10, category: 'Sonstiges' }
        const weight = Number(profile?.weight) || 75
        const cal = calculateCaloriesBurned(weight, duration, sport.metMedium) || caloriesBurned
        addActivityLog({ id: uid(), date: today, sport, duration, intensity: 'medium', caloriesBurned: cal, timestamp: Date.now() })
        toast.success(`🎙️ ${name}, ${duration} Min – ${cal} kcal eingetragen!`)
        onDone?.()

      } else {
        toast.error(`Konnte nicht verstehen: "${text.slice(0, 50)}"`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler', { duration: 5000 })
    }
    setProcessing(false)
  }

  if (!isSupported) return null

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={() => listening ? stopListening() : startListening(handleResult, (err) => toast.error(err))}
        disabled={processing}
        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg disabled:opacity-60 ${
          listening
            ? 'bg-red-500 scale-110 shadow-red-200'
            : processing
              ? 'bg-blue-400'
              : 'bg-blue-500 active:scale-95'
        }`}
      >
        {processing
          ? <Loader size={26} className="text-white animate-spin" />
          : listening
            ? <MicOff size={26} className="text-white" />
            : <Mic size={26} className="text-white" />}
      </button>

      {listening && (
        <div className="flex items-center gap-1.5 bg-red-50 rounded-2xl px-4 py-2">
          <span className="w-2 h-2 bg-red-500 rounded-full anim-pulse" />
          <span className="text-xs font-bold text-red-600">Höre zu… Tippe zum Stoppen</span>
        </div>
      )}

      {!listening && !processing && (
        <p className="text-xs text-slate-400 text-center">
          z.B. „Ich habe Hähnchen mit Reis gegessen"<br />oder „30 Minuten gelaufen"
        </p>
      )}

      {lastText && !listening && (
        <div className="bg-slate-50 dark:bg-[#1e1e1e] rounded-2xl px-3 py-2 max-w-[280px]">
          <p className="text-xs text-slate-500 italic text-center">„{lastText}"</p>
        </div>
      )}
    </div>
  )
}
