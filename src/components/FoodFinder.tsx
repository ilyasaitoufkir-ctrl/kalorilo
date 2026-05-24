import { useState, useEffect, useRef, useMemo } from 'react'
import { X, Navigation2, Loader2, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useStore } from '../store/useStore'
import toast from 'react-hot-toast'

// ── Types ─────────────────────────────────────────────────────────────────

interface Restaurant {
  id: string
  name: string
  lat: number
  lng: number
  cuisine: string
  address?: string
  openingHours?: string
  website?: string
  healthScore: number
  healthLabel: string
  healthTags: string[]
  distance: number
}

// ── Category filters ──────────────────────────────────────────────────────

const CATS = [
  { id: 'all',      emoji: '🍽', label: 'Alle'         },
  { id: 'salad',    emoji: '🥗', label: 'Salat'        },
  { id: 'sushi',    emoji: '🐟', label: 'Sushi'        },
  { id: 'smoothie', emoji: '🥤', label: 'Smoothies'    },
  { id: 'vegan',    emoji: '🌱', label: 'Vegan'        },
  { id: 'protein',  emoji: '💪', label: 'High Protein' },
  { id: 'wrap',     emoji: '🥙', label: 'Wraps'        },
  { id: 'asian',    emoji: '🍜', label: 'Asiatisch'    },
]

function matchCat(r: Restaurant, cat: string): boolean {
  if (cat === 'all') return true
  const c = r.cuisine.toLowerCase()
  const n = r.name.toLowerCase()
  const t = r.healthTags.join(' ').toLowerCase()
  switch (cat) {
    case 'salad':    return c.includes('salad')    || n.includes('salad')   || n.includes('bowl')    || t.includes('salat')
    case 'sushi':    return c.includes('sushi')    || c.includes('japanese')
    case 'smoothie': return c.includes('juice')    || n.includes('smoothie')|| n.includes('juice')   || n.includes('saft')
    case 'vegan':    return t.includes('vegan')    || c.includes('vegan')   || c.includes('vegetarian')
    case 'protein':  return r.healthScore >= 7     && !c.includes('pizza')  && !c.includes('burger')
    case 'wrap':     return c.includes('kebab')    || c.includes('turkish') || n.includes('wrap')    || n.includes('burrito')
    case 'asian':    return c.includes('japanese') || c.includes('thai')    || c.includes('chinese') || c.includes('vietnamese') || c.includes('sushi')
    default:         return true
  }
}

// ── Health scoring ────────────────────────────────────────────────────────

function scoreRestaurant(name: string, tags: Record<string, string>): { score: number; label: string; htags: string[] } {
  const c      = (tags.cuisine ?? tags.amenity ?? '').toLowerCase()
  const n      = name.toLowerCase()
  const isVegan = tags['diet:vegan'] === 'yes'       || c.includes('vegan')
  const isVeg   = tags['diet:vegetarian'] === 'yes'  || c.includes('vegetarian')

  let score = 5
  const htags: string[] = []

  if      (c.includes('sushi') || c.includes('japanese'))       { score = 8; htags.push('🐟 Sushi') }
  else if (c.includes('thai'))                                   { score = 7; htags.push('🍜 Thai') }
  else if (c.includes('vietnamese'))                             { score = 7; htags.push('🍜 Vietnamesisch') }
  else if (c.includes('mediterranean') || c.includes('greek'))  { score = 7; htags.push('🫒 Mediterran') }
  else if (c.includes('indian'))                                 { score = 6; htags.push('🍛 Indisch') }
  else if (c.includes('burger') || c.includes('american'))      { score = 3; htags.push('🍔 Burger') }
  else if (c.includes('pizza'))                                  { score = 4; htags.push('🍕 Pizza') }
  else if (c.includes('kebab') || c.includes('turkish'))        { score = 5; htags.push('🥙 Döner') }
  else if (c.includes('sandwich'))                               { score = 6; htags.push('🥪 Sandwich') }
  else if (c.includes('juice_bar') || c.includes('juice bar'))  { score = 9; htags.push('🥤 Juice Bar') }
  else if (c.includes('salad'))                                  { score = 8; htags.push('🥗 Salat') }

  if (n.includes('salad') || n.includes('bowl') || n.includes('fresh'))
    { score = Math.max(score, 8); if (!htags.some(t => t.includes('Salat'))) htags.push('🥗 Salat') }
  if (n.includes('smoothie') || n.includes('juice') || n.includes('saft'))
    { score = Math.max(score, 9); htags.push('🥤 Smoothie') }
  if (n.includes('fit') || n.includes('health') || n.includes('lean') || n.includes('clean'))
    { score = Math.max(score, 8); htags.push('💪 Fitness') }
  if (n.includes('wrap') || n.includes('burrito'))
    { score = Math.max(score, 6); htags.push('🥙 Wrap') }
  if (isVegan) { score = Math.max(score, 9); if (!htags.includes('🌱 Vegan'))  htags.push('🌱 Vegan') }
  if (isVeg)   { score = Math.max(score, 7); if (!htags.includes('🌱 Veggie')) htags.push('🌱 Veggie') }
  if (n.includes('mcdonalds') || n.includes("mcdonald's") || n.includes('burger king') || n.includes('kfc')) { score = 2 }

  const label = score >= 8 ? '✅ Sehr gesund' : score >= 6 ? '👍 Gesund' : score >= 4 ? '⚠️ Mittel' : '❌ Ungesund'
  return { score, label, htags: [...new Set(htags)] }
}

function scoreColor(s: number) {
  return s >= 8 ? '#10b981' : s >= 6 ? '#f59e0b' : s >= 4 ? '#f97316' : '#ef4444'
}

// ── Haversine ─────────────────────────────────────────────────────────────

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180
  const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

function fmtDist(m: number) {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`
}

// ── Overpass GET (kein CORS-Problem) ─────────────────────────────────────

async function fetchNearby(lat: number, lng: number, radius: number): Promise<{ restaurants: Restaurant[]; rawCount: number }> {
  const query = `[out:json][timeout:25];(node["amenity"="restaurant"](around:${radius},${lat},${lng});node["amenity"="cafe"](around:${radius},${lat},${lng});node["amenity"="fast_food"](around:${radius},${lat},${lng}););out body;`
  const url   = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`

  console.log('[FoodFinder] Overpass GET →', url)

  const res = await fetch(url)
  console.log('[FoodFinder] Overpass status:', res.status)

  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`)

  const data = await res.json()
  console.log('[FoodFinder] Overpass elements:', data.elements?.length ?? 0)

  const rawCount = (data.elements ?? []).length

  const restaurants: Restaurant[] = (data.elements as any[])
    .filter(el => el.tags?.name)
    .map(el => {
      const { score, label, htags } = scoreRestaurant(el.tags.name, el.tags)
      return {
        id:           String(el.id),
        name:         el.tags.name,
        lat:          el.lat,
        lng:          el.lon,
        cuisine:      el.tags.cuisine ?? el.tags.amenity ?? '',
        address:      el.tags['addr:street']
                        ? `${el.tags['addr:street']} ${el.tags['addr:housenumber'] ?? ''}`.trim()
                        : undefined,
        openingHours: el.tags.opening_hours,
        website:      el.tags.website ?? el.tags['contact:website'],
        healthScore:  score,
        healthLabel:  label,
        healthTags:   htags,
        distance:     haversineM(lat, lng, el.lat, el.lon),
      } satisfies Restaurant
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 60)

  return { restaurants, rawCount }
}

// ── AI tip (Claude) ───────────────────────────────────────────────────────

async function getAiTip(restaurants: Restaurant[], goal: string, apiKey: string): Promise<string> {
  const top5 = restaurants.slice(0, 5)
    .map(r => `${r.name} (${r.cuisine || 'Restaurant'}, Score: ${r.healthScore}/10)`)
    .join(', ')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 180,
      messages: [{
        role: 'user',
        content: `Mein Ziel: ${goal}. Restaurants: ${top5}. Gib eine Empfehlung in 2 Sätzen auf Deutsch. Nur Text, keine Einleitung.`,
      }],
    }),
  })
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

// ── Component ─────────────────────────────────────────────────────────────

const RADII = [500, 1000, 2000, 5000]

interface Props { onClose: () => void }

export default function FoodFinder({ onClose }: Props) {
  // Core data
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [pos, setPos]           = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading]   = useState(true)

  // Debug state — visible in the app
  const [debugLog, setDebugLog] = useState<string[]>([])
  const [gpsErr, setGpsErr]     = useState<string | null>(null)
  const [apiErr, setApiErr]     = useState<string | null>(null)
  const [rawCount, setRawCount] = useState<number | null>(null)

  // UI
  const [cat, setCat]           = useState('all')
  const [radius, setRadius]     = useState(1000)
  const [selected, setSelected] = useState<Restaurant | null>(null)
  const [listOpen, setListOpen] = useState(true)
  const [aiTip, setAiTip]       = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [showDebug, setShowDebug] = useState(false)

  const apiKey   = useStore(s => s.apiKeys.anthropic)
  const profile  = useStore(s => s.profile)
  const goalLabel = profile?.goal === 'lose' ? 'Gewicht verlieren'
    : profile?.goal === 'gain' ? 'Muskeln aufbauen' : 'Gewicht halten'

  const mapDivRef      = useRef<HTMLDivElement>(null)
  const mapRef         = useRef<L.Map | null>(null)
  const userDotRef     = useRef<L.Marker | null>(null)
  const markerLayerRef = useRef<L.LayerGroup | null>(null)

  const filtered = useMemo(() => restaurants.filter(r => matchCat(r, cat)), [restaurants, cat])

  const addLog = (msg: string) => {
    console.log('[FoodFinder]', msg)
    setDebugLog(prev => [...prev.slice(-9), msg])
  }

  // ── GPS ────────────────────────────────────────────────────────────────
  useEffect(() => {
    addLog('GPS anfordern…')
    if (!navigator.geolocation) {
      const msg = 'navigator.geolocation nicht verfügbar'
      addLog('FEHLER: ' + msg)
      setGpsErr(msg)
      setLoading(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      gp => {
        const { latitude: lat, longitude: lng, accuracy } = gp.coords
        addLog(`GPS OK: ${lat.toFixed(5)}, ${lng.toFixed(5)} (±${Math.round(accuracy)}m)`)
        setPos({ lat, lng })
      },
      err => {
        const msgs: Record<number, string> = {
          1: 'Zugriff verweigert – Standort-Berechtigung erteilen.',
          2: 'Position nicht verfügbar.',
          3: 'Zeitüberschreitung – ins Freie gehen.',
        }
        const msg = msgs[err.code] ?? `GPS Fehler Code ${err.code}`
        addLog('GPS FEHLER: ' + msg)
        setGpsErr(msg)
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
    )
  }, [])

  // ── Load restaurants ───────────────────────────────────────────────────
  useEffect(() => {
    if (!pos) return
    setLoading(true)
    setApiErr(null)
    setAiTip('')
    setRawCount(null)
    addLog(`Overpass anfragen: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}, r=${radius}m`)

    fetchNearby(pos.lat, pos.lng, radius)
      .then(({ restaurants: r, rawCount: rc }) => {
        addLog(`Overpass OK: ${rc} Elemente → ${r.length} mit Namen`)
        setRawCount(rc)
        setRestaurants(r)
        setLoading(false)
        if (r.length === 0) addLog('Keine Restaurants mit Namen gefunden!')
      })
      .catch(e => {
        const msg = e instanceof Error ? e.message : String(e)
        addLog('API FEHLER: ' + msg)
        setApiErr(msg)
        setLoading(false)
      })
  }, [pos?.lat, pos?.lng, radius])

  // ── Leaflet map ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return
    const map = L.map(mapDivRef.current, { zoomControl: false, attributionControl: false })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20, subdomains: 'abcd',
    }).addTo(map)
    markerLayerRef.current = L.layerGroup().addTo(map)
    map.setView([48.1351, 11.582], 15)
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null; markerLayerRef.current = null }
  }, [])

  // ── User dot ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !pos) return
    const icon = L.divIcon({
      html: `<div style="width:18px;height:18px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 6px rgba(59,130,246,0.25)"></div>`,
      iconSize: [18, 18], iconAnchor: [9, 9], className: '',
    })
    if (userDotRef.current) {
      userDotRef.current.setLatLng([pos.lat, pos.lng])
    } else {
      userDotRef.current = L.marker([pos.lat, pos.lng], { icon, zIndexOffset: 2000 }).addTo(mapRef.current)
      mapRef.current.setView([pos.lat, pos.lng], 15)
    }
  }, [pos])

  // ── Restaurant pins ────────────────────────────────────────────────────
  useEffect(() => {
    const layer = markerLayerRef.current
    if (!mapRef.current || !layer) return
    layer.clearLayers()
    filtered.forEach(r => {
      const color = scoreColor(r.healthScore)
      const isSel = r.id === selected?.id
      const sz    = isSel ? 40 : 32
      const icon  = L.divIcon({
        html: `
          <div style="position:relative;width:${sz}px;height:${sz}px">
            <div style="
              width:100%;height:100%;background:${color};
              border:${isSel ? '3px' : '2px'} solid #fff;
              border-radius:50% 50% 50% 0;transform:rotate(-45deg);
              box-shadow:0 3px 12px rgba(0,0,0,0.5)${isSel ? ',0 0 0 4px ' + color + '40' : ''};
              display:flex;align-items:center;justify-content:center;">
              <div style="transform:rotate(45deg);font-size:${isSel ? 16 : 13}px">
                ${r.healthScore >= 8 ? '🥗' : r.healthScore >= 6 ? '🍽' : r.healthScore >= 4 ? '🍟' : '🍔'}
              </div>
            </div>
          </div>`,
        iconSize: [sz, sz], iconAnchor: [sz / 2, sz], className: '',
      })
      L.marker([r.lat, r.lng], { icon }).addTo(layer).on('click', () => {
        setSelected(r); setListOpen(true)
        mapRef.current?.setView([r.lat, r.lng], 17, { animate: true, duration: 0.5 })
      })
    })
  }, [filtered, selected])

  // ── AI tip ─────────────────────────────────────────────────────────────
  const loadAiTip = async () => {
    if (!apiKey?.trim()) { toast.error('Kein Anthropic API Key (Profil → API Keys)'); return }
    if (restaurants.length === 0) return
    setAiLoading(true)
    try {
      const tip = await getAiTip(filtered.slice(0, 8), goalLabel, apiKey)
      setAiTip(tip)
    } catch { toast.error('KI-Analyse fehlgeschlagen') }
    finally { setAiLoading(false) }
  }

  const openNav = (r: Restaurant) =>
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`, '_blank')

  const reload = () => {
    if (!pos) return
    setLoading(true); setApiErr(null); setAiTip(''); setRawCount(null)
    addLog(`Reload: r=${radius}m`)
    fetchNearby(pos.lat, pos.lng, radius)
      .then(({ restaurants: r, rawCount: rc }) => {
        addLog(`Reload OK: ${rc} → ${r.length}`)
        setRawCount(rc); setRestaurants(r); setLoading(false)
      })
      .catch(e => { setApiErr(e instanceof Error ? e.message : String(e)); setLoading(false) })
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: '#000' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 14px)', paddingBottom: 10,
          background: 'rgba(0,0,0,0.94)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1a1a1a' }}>
        <div>
          <h2 className="font-black text-lg" style={{ color: '#fff' }}>📍 Food in der Nähe</h2>
          <p style={{ fontSize: 11, color: '#555', marginTop: 1 }}>
            {loading
              ? (pos ? 'Lade Restaurants…' : 'GPS wird ermittelt…')
              : gpsErr  ? '❌ ' + gpsErr
              : apiErr  ? '❌ ' + apiErr
              : `${filtered.length} von ${restaurants.length} Restaurants`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Debug toggle */}
          <button onClick={() => setShowDebug(v => !v)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black"
            style={{ background: showDebug ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)',
              border: showDebug ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.08)',
              color: showDebug ? '#f59e0b' : '#666' }}>
            🔍
          </button>
          {!loading && pos && !gpsErr && (
            <button onClick={reload}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <RefreshCw size={16} style={{ color: '#666' }} />
            </button>
          )}
          <button onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <X size={18} style={{ color: '#999' }} />
          </button>
        </div>
      </div>

      {/* ── Debug panel ── */}
      {showDebug && (
        <div className="px-4 py-3" style={{ background: '#0d0d0d', borderBottom: '1px solid #1a1a1a' }}>
          <p className="text-xs font-black mb-2" style={{ color: '#f59e0b' }}>🔍 Debug</p>
          <div className="space-y-0.5">
            <p className="text-xs font-mono" style={{ color: pos ? '#10b981' : '#ef4444' }}>
              GPS: {pos ? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` : gpsErr ?? 'warte…'}
            </p>
            {rawCount !== null && (
              <p className="text-xs font-mono" style={{ color: '#60a5fa' }}>
                Overpass: {rawCount} Elemente → {restaurants.length} Restaurants
              </p>
            )}
            {apiErr && (
              <p className="text-xs font-mono" style={{ color: '#ef4444' }}>API: {apiErr}</p>
            )}
            <div className="mt-2 space-y-0.5">
              {debugLog.map((l, i) => (
                <p key={i} className="text-xs font-mono" style={{ color: '#555' }}>{l}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Radius selector ── */}
      <div className="flex gap-2 px-4 py-2.5" style={{ background: '#0a0a0a', borderBottom: '1px solid #141414' }}>
        <span style={{ fontSize: 12, color: '#555', fontWeight: 700, lineHeight: '28px', flexShrink: 0 }}>Umkreis:</span>
        {RADII.map(r => (
          <button key={r} onClick={() => setRadius(r)}
            className="flex-1 py-1.5 rounded-xl text-xs font-bold glass-press"
            style={radius === r
              ? { background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }
              : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#555' }}>
            {r < 1000 ? `${r}m` : `${r / 1000}km`}
          </button>
        ))}
      </div>

      {/* ── Category filter ── */}
      <div className="flex gap-2 px-4 py-2.5 overflow-x-auto"
        style={{ scrollbarWidth: 'none', background: '#0a0a0a', borderBottom: '1px solid #141414' }}>
        {CATS.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold glass-press"
            style={cat === c.id
              ? { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }
              : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#555' }}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {/* ── Map ── */}
      <div className="relative"
        style={{ flex: listOpen ? '0 0 42%' : '1', minHeight: 200, transition: 'flex 0.3s ease' }}>

        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}>
            <Loader2 size={32} style={{ color: '#10b981' }} className="animate-spin" />
            <p style={{ color: '#888', fontSize: 14 }}>
              {pos ? 'Lade Restaurants…' : 'GPS wird ermittelt…'}
            </p>
            {pos && (
              <p style={{ color: '#444', fontSize: 11, fontFamily: 'monospace' }}>
                {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
              </p>
            )}
          </div>
        )}

        {(gpsErr || apiErr) && !loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-8"
            style={{ background: '#080808' }}>
            <span style={{ fontSize: 48 }}>{gpsErr ? '📡' : '⚠️'}</span>
            <p className="text-center font-bold text-sm" style={{ color: '#ef4444', lineHeight: 1.6 }}>
              {gpsErr ?? apiErr}
            </p>
            {gpsErr && (
              <p className="text-center text-xs" style={{ color: '#555', lineHeight: 1.6 }}>
                Standort-Berechtigung im Browser erlauben, dann neu laden.
              </p>
            )}
            {apiErr && (
              <button onClick={reload} className="btn-gold px-6 py-3 text-sm rounded-2xl">
                Erneut versuchen
              </button>
            )}
          </div>
        )}

        <div ref={mapDivRef} style={{ width: '100%', height: '100%' }} />

        {/* GPS-Koordinaten Badge (immer sichtbar wenn pos bekannt) */}
        {pos && !loading && (
          <div className="absolute top-2 left-3 z-10 px-2.5 py-1 rounded-xl text-xs font-mono"
            style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(16,185,129,0.3)',
              color: '#10b981', backdropFilter: 'blur(6px)' }}>
            📍 {pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}
          </div>
        )}

        {/* Zoom controls */}
        <div className="absolute right-3 bottom-3 flex flex-col gap-1.5 z-10">
          {[
            { label: '+', fn: () => mapRef.current?.zoomIn()  },
            { label: '–', fn: () => mapRef.current?.zoomOut() },
          ].map(btn => (
            <button key={btn.label} onClick={btn.fn}
              className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-base"
              style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', backdropFilter: 'blur(8px)' }}>
              {btn.label}
            </button>
          ))}
          {pos && (
            <button onClick={() => mapRef.current?.setView([pos.lat, pos.lng], 15, { animate: true })}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(59,130,246,0.8)', border: '1px solid rgba(59,130,246,0.4)',
                backdropFilter: 'blur(8px)', fontSize: 18 }}>
              🎯
            </button>
          )}
        </div>
      </div>

      {/* ── AI tip ── */}
      {aiTip ? (
        <div className="px-4 py-2.5" style={{ background: '#0a0a0a', borderTop: '1px solid #141414' }}>
          <div className="glass px-4 py-3 flex items-start gap-3"
            style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.15)' }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
            <p style={{ fontSize: 12, color: '#ccc', lineHeight: 1.6 }}>{aiTip}</p>
            <button onClick={() => setAiTip('')} style={{ color: '#444', flexShrink: 0, paddingTop: 2 }}>
              <X size={14} />
            </button>
          </div>
        </div>
      ) : restaurants.length > 0 && !loading && (
        <div className="px-4 py-2" style={{ background: '#0a0a0a', borderTop: '1px solid #141414' }}>
          <button onClick={loadAiTip} disabled={aiLoading}
            className="w-full py-2.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}>
            {aiLoading
              ? <><Loader2 size={14} className="animate-spin" />KI analysiert…</>
              : <>✨ KI-Empfehlung ({goalLabel})</>}
          </button>
        </div>
      )}

      {/* ── Bottom list ── */}
      <div style={{
        background: '#0a0a0a', borderTop: '1px solid #141414',
        display: 'flex', flexDirection: 'column',
        flex: listOpen ? '1' : '0 0 48px', minHeight: 48,
        overflow: 'hidden', transition: 'flex 0.3s ease',
      }}>
        <button className="flex items-center justify-between px-4 py-3 w-full flex-shrink-0"
          onClick={() => setListOpen(v => !v)}>
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm" style={{ color: '#fff' }}>
              {filtered.length > 0
                ? `${filtered.length} Restaurant${filtered.length === 1 ? '' : 's'} in der Nähe`
                : loading ? 'Lade…' : 'Keine Restaurants gefunden'}
            </p>
            {!loading && restaurants.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-black"
                style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                {restaurants.length}
              </span>
            )}
          </div>
          {listOpen
            ? <ChevronDown size={18} style={{ color: '#555' }} />
            : <ChevronUp   size={18} style={{ color: '#555' }} />}
        </button>

        <div className="overflow-y-auto flex-1"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>

          {selected && listOpen && (
            <div className="mx-4 mb-3 glass rounded-2xl overflow-hidden"
              style={{ background: 'rgba(16,185,129,0.04)', border: `1px solid ${scoreColor(selected.healthScore)}30` }}>
              <div className="flex items-start gap-3 p-4">
                <div className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
                  style={{ background: `${scoreColor(selected.healthScore)}18`, border: `1.5px solid ${scoreColor(selected.healthScore)}40` }}>
                  <p style={{ fontSize: 16, fontWeight: 900, color: scoreColor(selected.healthScore), lineHeight: 1 }}>{selected.healthScore}</p>
                  <p style={{ fontSize: 8, fontWeight: 700, color: scoreColor(selected.healthScore) }}>/10</p>
                </div>
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <p className="font-black text-base truncate" style={{ color: '#fff' }}>{selected.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: scoreColor(selected.healthScore) }}>{selected.healthLabel}</p>
                  {selected.cuisine && <p className="text-xs mt-0.5" style={{ color: '#666' }}>{selected.cuisine}</p>}
                  {selected.address && <p className="text-xs mt-1" style={{ color: '#555' }}>{selected.address}</p>}
                  {selected.openingHours && (
                    <p className="text-xs mt-1" style={{ color: '#555' }}>🕐 {selected.openingHours.split(';')[0]}</p>
                  )}
                  {selected.healthTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selected.healthTags.map(t => (
                        <span key={t} className="px-2 py-0.5 rounded-full text-xs"
                          style={{ background: 'rgba(255,255,255,0.06)', color: '#aaa', border: '1px solid rgba(255,255,255,0.08)' }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 px-4 pb-4">
                <button onClick={() => openNav(selected)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 font-bold text-sm"
                  style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' }}>
                  <Navigation2 size={16} />Navigation
                </button>
                {selected.website && (
                  <button onClick={() => window.open(selected.website, '_blank')}
                    className="flex items-center justify-center gap-2 rounded-2xl py-3 px-5 font-bold text-sm"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#aaa' }}>
                    🌐 Web
                  </button>
                )}
                <button onClick={() => setSelected(null)}
                  className="flex items-center justify-center rounded-2xl px-3"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#555' }}>
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {filtered.map((r, i) => (
            <div key={r.id}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer active:opacity-70"
              style={{
                borderTop:  i > 0 ? '1px solid #141414' : 'none',
                background: selected?.id === r.id ? 'rgba(16,185,129,0.04)' : 'transparent',
              }}
              onClick={() => {
                setSelected(r === selected ? null : r)
                if (r !== selected) mapRef.current?.setView([r.lat, r.lng], 17, { animate: true })
              }}>
              <div className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
                style={{ background: `${scoreColor(r.healthScore)}18`, border: `1.5px solid ${scoreColor(r.healthScore)}35` }}>
                <p style={{ fontSize: 15, fontWeight: 900, color: scoreColor(r.healthScore), lineHeight: 1 }}>{r.healthScore}</p>
                <p style={{ fontSize: 7, fontWeight: 700, color: scoreColor(r.healthScore) }}>/10</p>
              </div>
              <div className="flex-1" style={{ minWidth: 0 }}>
                <p className="font-black text-sm truncate" style={{ color: '#fff' }}>{r.name}</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: '#555' }}>
                  {r.healthLabel} · <span style={{ color: '#777' }}>{fmtDist(r.distance)}</span>
                  {r.cuisine && <> · {r.cuisine}</>}
                </p>
                {r.healthTags.length > 0 && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: '#444' }}>
                    {r.healthTags.slice(0, 3).join(' ')}
                  </p>
                )}
              </div>
              <button
                onClick={e => { e.stopPropagation(); openNav(r) }}
                className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }}>
                <Navigation2 size={15} />
              </button>
            </div>
          ))}

          {filtered.length === 0 && !loading && !gpsErr && !apiErr && (
            <div className="py-10 text-center px-6">
              <p style={{ fontSize: 36, marginBottom: 8 }}>🔍</p>
              <p style={{ color: '#555', fontSize: 14 }}>
                Keine Restaurants im {radius < 1000 ? `${radius}m` : `${radius / 1000}km`} Umkreis.
              </p>
              <p className="mt-1" style={{ color: '#444', fontSize: 12 }}>Größeren Umkreis versuchen.</p>
              <button onClick={() => setShowDebug(true)} className="mt-3 text-xs px-3 py-1.5 rounded-xl"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}>
                🔍 Debug anzeigen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
