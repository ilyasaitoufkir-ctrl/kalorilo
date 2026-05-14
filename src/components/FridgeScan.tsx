import { useState, useRef } from 'react'
import { Camera, ShoppingCart, ChefHat, Loader } from 'lucide-react'
import { useStore } from '../store/useStore'
import { analyzeFridge, getRecipesFromIngredients, getShoppingList } from '../utils/api'
import { imageToBase64 } from '../utils/calculations'
import toast from 'react-hot-toast'

export default function FridgeScan() {
  const [step, setStep] = useState<'scan' | 'choose' | 'result'>('scan')
  const [ingredients, setIngredients] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [resultType, setResultType] = useState<'recipe' | 'shopping' | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const apiKeys = useStore((s) => s.apiKeys)
  const profile = useStore((s) => s.profile)

  const goal = profile?.goal === 'lose' ? 'Abnehmen' : profile?.goal === 'gain' ? 'Muskelaufbau' : 'Fitness'

  const handlePhoto = async (file: File) => {
    setLoading(true)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    try {
      const b64 = await imageToBase64(file)
      const res = await analyzeFridge(b64, apiKeys.anthropic)
      setIngredients(res.ingredients)
      setStep('choose')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
      console.error('[FridgeScan]', e)
      toast.error(msg, { duration: 5000 })
    }
    setLoading(false)
  }

  const handleRecipes = async () => {
    setLoading(true)
    setResultType('recipe')
    try {
      const text = await getRecipesFromIngredients(ingredients, goal, apiKeys.anthropic)
      setResult(text)
      setStep('result')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
      console.error('[Recipes]', e)
      toast.error(msg, { duration: 5000 })
    }
    setLoading(false)
  }

  const handleShopping = async () => {
    setLoading(true)
    setResultType('shopping')
    try {
      const text = await getShoppingList(ingredients, goal, apiKeys.anthropic)
      setResult(text)
      setStep('result')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
      console.error('[Shopping]', e)
      toast.error(msg, { duration: 5000 })
    }
    setLoading(false)
  }

  const reset = () => {
    setStep('scan'); setIngredients([]); setResult(''); setResultType(null); setPreviewUrl(null)
  }

  return (
    <div className="pb-24 animate-fade-in">
      <div className="gradient-blue px-4 pt-12 pb-6 safe-top">
        <h1 className="text-white text-2xl font-bold">🧊 Kühlschrank-Scan</h1>
        <p className="text-blue-100 text-sm mt-1">KI erkennt deine Zutaten & schlägt Rezepte vor</p>
      </div>

      <div className="px-4 py-6">
        {step === 'scan' && (
          <div>
            <div className="bg-blue-50 rounded-2xl p-4 mb-6 text-sm text-blue-800">
              <p className="font-semibold mb-1">So funktioniert's:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-700">
                <li>Foto vom geöffneten Kühlschrank machen</li>
                <li>KI erkennt automatisch alle Produkte</li>
                <li>Wähle: Rezept vorschlagen oder Einkaufsliste</li>
              </ol>
            </div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              className="w-full py-6 border-2 border-dashed border-blue-200 rounded-3xl text-blue-500 font-medium flex flex-col items-center gap-3 disabled:opacity-50"
            >
              {loading ? (
                <><Loader size={32} className="animate-spin" /><span>KI analysiert…</span></>
              ) : (
                <><Camera size={40} /><span className="text-lg font-semibold">Kühlschrank fotografieren</span><span className="text-sm text-gray-400">Tippe hier um die Kamera zu öffnen</span></>
              )}
            </button>
            {!apiKeys.anthropic && (
              <p className="text-center text-xs text-red-500 mt-3">⚠️ Anthropic API Key fehlt</p>
            )}
          </div>
        )}

        {step === 'choose' && (
          <div>
            {previewUrl && (
              <div className="mb-4 relative">
                <img src={previewUrl} alt="Kühlschrank" className="w-full h-40 object-cover rounded-2xl" />
              </div>
            )}
            <div className="card p-4 mb-4">
              <h3 className="font-semibold text-gray-800 mb-3">🔍 Erkannte Zutaten ({ingredients.length})</h3>
              <div className="flex flex-wrap gap-2">
                {ingredients.map((ing, i) => (
                  <span key={i} className="bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-full">{ing}</span>
                ))}
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Was soll ich tun?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleRecipes}
                disabled={loading}
                className="card p-5 text-center card-pressed disabled:opacity-50"
              >
                <ChefHat size={32} className="text-orange-500 mx-auto mb-2" />
                <div className="font-semibold text-gray-800 text-sm">Rezept</div>
                <div className="text-xs text-gray-400 mt-1">Passende Rezepte aus deinen Zutaten</div>
              </button>
              <button
                onClick={handleShopping}
                disabled={loading}
                className="card p-5 text-center card-pressed disabled:opacity-50"
              >
                <ShoppingCart size={32} className="text-green-500 mx-auto mb-2" />
                <div className="font-semibold text-gray-800 text-sm">Einkaufsliste</div>
                <div className="text-xs text-gray-400 mt-1">Was fehlt für dein Ziel: {goal}</div>
              </button>
            </div>
            {loading && (
              <div className="text-center mt-4 text-sm text-gray-500 flex items-center justify-center gap-2">
                <Loader size={16} className="animate-spin" /> KI denkt nach…
              </div>
            )}
            <button onClick={reset} className="w-full mt-4 py-2 text-sm text-gray-400">Neu starten</button>
          </div>
        )}

        {step === 'result' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              {resultType === 'recipe' ? <ChefHat size={20} className="text-orange-500" /> : <ShoppingCart size={20} className="text-green-500" />}
              <h3 className="font-semibold text-gray-800">
                {resultType === 'recipe' ? '🍳 Rezeptvorschläge' : '🛒 Einkaufsliste'}
              </h3>
            </div>
            <div className="card p-4 bg-gray-50">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{result}</pre>
            </div>
            <button
              onClick={reset}
              className="w-full mt-4 py-3 gradient-blue rounded-2xl text-white font-semibold text-sm"
            >
              Neuer Scan
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
