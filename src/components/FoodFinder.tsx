import { useState, useEffect, useRef, useMemo } from 'react'
import { X, Navigation2, Loader2, RefreshCw } from 'lucide-react'
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
  amenity: string        // restaurant | cafe | fast_food | juice_bar
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
    case 'salad':    return c.includes('salad')    || n.includes('salad')    || n.includes('bowl')   || t.includes('salat')
    case 'sushi':    return c.includes('sushi')    || c.includes('japanese')
    case 'smoothie': return c.includes('juice')    || n.includes('smoothie') || n.includes('juice')  || n.includes('saft')
    case 'vegan':    return t.includes('vegan')    || c.includes('vegan')    || c.includes('vegetarian')
    case 'protein':  return r.healthScore >= 7     && !c.includes('pizza')   && !c.includes('burger')
    case 'wrap':     return c.includes('kebab')    || c.includes('turkish')  || n.includes('wrap')   || n.includes('burrito')
    case 'asian':    return c.includes('japanese') || c.includes('thai')     || c.includes('chinese')|| c.includes('vietnamese') || c.includes('sushi')
    default:         return true
  }
}

// ── Health scoring ────────────────────────────────────────────────────────

function scoreRestaurant(name: string, tags: Record<string, string>): { score: number; label: string; htags: string[] } {
  const c       = (tags.cuisine ?? tags.amenity ?? '').toLowerCase()
  const n       = name.toLowerCase()
  const isVegan = tags['diet:vegan'] === 'yes'      || c.includes('vegan')
  const isVeg   = tags['diet:vegetarian'] === 'yes' || c.includes('vegetarian')

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

// ── Amenity label ─────────────────────────────────────────────────────────

function amenityLabel(amenity: string, cuisine: string): string {
  const c = cuisine.toLowerCase()
  if (c.includes('sushi') || c.includes('japanese')) return '🐟 Sushi'
  if (c.includes('thai'))        return '🍜 Thai'
  if (c.includes('vietnamese'))  return '🍜 Vietnamesisch'
  if (c.includes('indian'))      return '🍛 Indisch'
  if (c.includes('pizza'))       return '🍕 Pizzeria'
  if (c.includes('burger'))      return '🍔 Burger'
  if (c.includes('kebab') || c.includes('turkish')) return '🥙 Döner'
  if (c.includes('chinese'))     return '🥡 Chinesisch'
  if (c.includes('vegan') || c.includes('vegetarian')) return '🌱 Vegan/Veggie'
  if (c.includes('sandwich'))    return '🥪 Sandwich'
  if (c.includes('juice'))       return '🥤 Juice Bar'
  if (c.includes('salad'))       return '🥗 Salat'
  if (amenity === 'cafe')        return '☕ Café'
  if (amenity === 'fast_food')   return '🍟 Fast Food'
  if (amenity === 'juice_bar')   return '🥤 Juice Bar'
  if (cuisine)                   return '🍽 ' + cuisine.charAt(0).toUpperCase() + cuisine.slice(1)
  return '🍽 Restaurant'
}

// ── Distance ──────────────────────────────────────────────────────────────

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

// ── Overpass fetch (mirror fallback) ─────────────────────────────────────

const MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
]

async function fetchNearby(lat: number, lng: number, radius: number): Promise<{ restaurants: Restaurant[]; rawCount: number }> {
  const query = `[out:json][timeout:25];(node["amenity"="restaurant"](around:${radius},${lat},${lng});node["amenity"="cafe"](around:${radius},${lat},${lng});node["amenity"="fast_food"](around:${radius},${lat},${lng});node["amenity"="juice_bar"](around:${radius},${lat},${lng}););out body;`

  let res: Response | null = null
  let lastErr = ''
  for (const base of MIRRORS) {
    try {
      res = await fetch(`${base}?data=${encodeURIComponent(query)}`)
      if (res.ok) break
      lastErr = `HTTP ${res.status}`
    } catch (e) {
      lastErr = `Netzwerkfehler: ${e}`
    }
  }
  if (!res || !res.ok) throw new Error(lastErr || 'Server nicht erreichbar')

  const data = await res.json()
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
        cuisine:      el.tags.cuisine ?? '',
        amenity:      el.tags.amenity ?? 'restaurant',
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

// ── AI tip ────────────────────────────────────────────────────────────────

async function getAiTip(restaurants: Restaurant[], goal: string, apiKey: string): Promise<string> {
  const top5 = restaurants.slice(0, 5)
    .map(r => `${r.name} (${r.cuisine || r.amenity}, Score: ${r.healthScore}/10)`)
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

// ── Navigation (Apple Maps on iOS, Google Maps otherwise) ─────────────────

function openNav(r: Restaurant) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  if (isIOS) {
    window.open(`maps://maps.apple.com/?daddr=${r.lat},${r.lng}&dirflg=w`, '_blank')
  } else {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`, '_blank')
  }
}

// ── Opening hours: extract today's hours ──────────────────────────────────

function todayHours(oh: string): string {
  // Return first segment for brevity; full parsing would need a library
  const first = oh.split(';')[0].trim()
  return first.length > 40 ? first.slice(0, 40) + '…' : first
}

// ── Component ─────────────────────────────────────────────────────────────

const RADII = [250, 500, 1000, 2000, 5000]

interface Props { onClose: () => void }

export default function FoodFinder({ onClose }: Props) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [pos, setPos]           = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading]   = useState(true)
  const [gpsErr, setGpsErr]     = useState<string | null>(null)
  const [apiErr, setApiErr]     = useState<string | null>(null)
  const [debugLog, setDebugLog] = useState<string[]>([])
  const [rawCount, setRawCount] = useState<number | null>(null)
  const [cat, setCat]           = useState('all')
  const [radius, setRadius]     = useState(1000)
  const [selected, setSelected] = useState<Restaurant | null>(null)
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
      setGpsErr('GPS nicht verfügbar auf diesem Gerät.')
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
          1: 'Standort-Berechtigung verweigert.',
          2: 'Position nicht verfügbar.',
          3: 'GPS-Zeitüberschreitung.',
        }
        const msg = msgs[err.code] ?? `GPS Fehler ${err.code}`
        addLog('GPS FEHLER: ' + msg)
        setGpsErr(msg)
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
    )
  }, [])

  // ── Fetch restaurants ──────────────────────────────────────────────────
  useEffect(() => {
    if (!pos) return
    setLoading(true); setApiErr(null); setAiTip(''); setRawCount(null)
    addLog(`Suche Restaurants: r=${radius}m`)
    fetchNearby(pos.lat, pos.lng, radius)
      .then(({ restaurants: r, rawCount: rc }) => {
        addLog(`OK: ${rc} Elemente → ${r.length} Restaurants`)
        setRawCount(rc); setRestaurants(r); setLoading(false)
      })
      .catch(e => {
        const msg = e instanceof Error ? e.message : String(e)
        addLog('FEHLER: ' + msg)
        setApiErr(msg); setLoading(false)
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

  // ── Pins ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const layer = markerLayerRef.current
    if (!mapRef.current || !layer) return
    layer.clearLayers()
    filtered.forEach(r => {
      const color = scoreColor(r.healthScore)
      const isSel = r.id === selected?.id
      const sz    = isSel ? 42 : 34
      const icon  = L.divIcon({
        html: `
          <div style="position:relative;width:${sz}px;height:${sz}px">
            <div style="
              width:100%;height:100%;background:${color};
              border:${isSel ? '3px' : '2px'} solid #fff;
              border-radius:50% 50% 50% 0;transform:rotate(-45deg);
              box-shadow:0 3px 12px rgba(0,0,0,0.5)${isSel ? ',0 0 0 5px ' + color + '50' : ''};
              display:flex;align-items:center;justify-content:center;">
              <div style="transform:rotate(45deg);font-size:${isSel ? 17 : 14}px">
                ${r.healthScore >= 8 ? '🥗' : r.healthScore >= 6 ? '🍽' : r.healthScore >= 4 ? '🍟' : '🍔'}
              </div>
            </div>
          </div>`,
        iconSize: [sz, sz], iconAnchor: [sz / 2, sz], className: '',
      })
      L.marker([r.lat, r.lng], { icon }).addTo(layer).on('click', () => {
        setSelected(prev => prev?.id === r.id ? null : r)
        mapRef.current?.setView([r.lat, r.lng], 17, { animate: true, duration: 0.5 })
      })
    })
  }, [filtered, selected])

  // ── AI tip ─────────────────────────────────────────────────────────────
  const loadAiTip = async () => {
    if (!apiKey?.trim()) { toast.error('Kein Anthropic API Key (Profil → API Keys)'); return }
    setAiLoading(true)
    try { setAiTip(await getAiTip(filtered.slice(0, 8), goalLabel, apiKey)) }
    catch { toast.error('KI-Analyse fehlgeschlagen') }
    finally { setAiLoading(false) }
  }

  const reload = () => {
    if (!pos) return
    setLoading(true); setApiErr(null); setAiTip(''); setRawCount(null)
    fetchNearby(pos.lat, pos.lng, radius)
      .then(({ restaurants: r, rawCount: rc }) => { setRawCount(rc); setRestaurants(r); setLoading(false) })
      .catch(e => { setApiErr(e instanceof Error ? e.message : String(e)); setLoading(false) })
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: '#000' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 14px)', paddingBottom: 10,
          background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #1c1c1c' }}>
        <div>
          <h2 className="font-black text-lg" style={{ color: '#fff', letterSpacing: -0.5 }}>📍 Food in der Nähe</h2>
          <p style={{ fontSize: 11, color: '#555', marginTop: 1 }}>
            {loading
              ? (pos ? 'Lade Restaurants…' : 'GPS wird ermittelt…')
              : gpsErr  ? '❌ ' + gpsErr
              : apiErr  ? '❌ ' + apiErr
              : `${filtered.length} Restaurant${filtered.length === 1 ? '' : 's'} gefunden`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowDebug(v => !v)}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: showDebug ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)',
              border: showDebug ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(255,255,255,0.08)',
              fontSize: 14 }}>
            🔍
          </button>
          {!loading && pos && !gpsErr && (
            <button onClick={reload}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <RefreshCw size={15} style={{ color: '#666' }} />
            </button>
          )}
          <button onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <X size={18} style={{ color: '#888' }} />
          </button>
        </div>
      </div>

      {/* ── Debug panel ── */}
      {showDebug && (
        <div className="px-4 py-3" style={{ background: '#0c0c0c', borderBottom: '1px solid #1a1a1a' }}>
          <p className="text-xs font-black mb-2" style={{ color: '#f59e0b' }}>🔍 Debug</p>
          <p className="text-xs font-mono mb-1" style={{ color: pos ? '#10b981' : '#ef4444' }}>
            GPS: {pos ? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` : gpsErr ?? 'warte…'}
          </p>
          {rawCount !== null && (
            <p className="text-xs font-mono mb-1" style={{ color: '#60a5fa' }}>
              Overpass: {rawCount} Elemente → {restaurants.length} Restaurants
            </p>
          )}
          {apiErr && <p className="text-xs font-mono mb-1" style={{ color: '#ef4444' }}>{apiErr}</p>}
          {debugLog.map((l, i) => <p key={i} className="text-xs font-mono" style={{ color: '#444' }}>{l}</p>)}
        </div>
      )}

      {/* ── Radius chips ── */}
      <div className="px-4 py-3" style={{ background: '#0a0a0a', borderBottom: '1px solid #141414' }}>
        <p className="text-xs font-bold mb-2" style={{ color: '#444', textTransform: 'uppercase', letterSpacing: 1 }}>Umkreis</p>
        <div className="flex gap-2">
          {RADII.map(r => (
            <button key={r} onClick={() => setRadius(r)}
              className="flex-1 py-2 rounded-2xl text-xs font-black transition-all"
              style={radius === r
                ? { background: 'rgba(245,158,11,0.18)', border: '1.5px solid rgba(245,158,11,0.5)', color: '#f59e0b', boxShadow: '0 0 12px rgba(245,158,11,0.15)' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#444' }}>
              {r < 1000 ? `${r}m` : `${r / 1000}km`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Category chips ── */}
      <div className="flex gap-2 px-4 py-2.5 overflow-x-auto"
        style={{ scrollbarWidth: 'none', background: '#0a0a0a', borderBottom: '1px solid #141414' }}>
        {CATS.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold"
            style={cat === c.id
              ? { background: 'rgba(16,185,129,0.15)', border: '1.5px solid rgba(16,185,129,0.4)', color: '#10b981' }
              : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#444' }}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {/* ── Map (fixed ~40% height) ── */}
      <div className="relative flex-shrink-0" style={{ height: '38%', minHeight: 180 }}>

        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
            style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(4px)' }}>
            <Loader2 size={30} style={{ color: '#10b981' }} className="animate-spin" />
            <p style={{ color: '#777', fontSize: 14 }}>{pos ? 'Lade Restaurants…' : 'GPS wird ermittelt…'}</p>
          </div>
        )}

        {(gpsErr || apiErr) && !loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-8"
            style={{ background: '#060606' }}>
            <span style={{ fontSize: 44 }}>{gpsErr ? '📡' : '⚠️'}</span>
            <p className="text-center font-bold text-sm" style={{ color: '#ef4444', lineHeight: 1.6 }}>
              {gpsErr ?? apiErr}
            </p>
            {gpsErr && <p className="text-center text-xs" style={{ color: '#444', lineHeight: 1.6 }}>Standort-Berechtigung im Browser erlauben.</p>}
            {apiErr && <button onClick={reload} className="btn-gold px-6 py-2.5 text-sm rounded-2xl">Erneut versuchen</button>}
          </div>
        )}

        <div ref={mapDivRef} style={{ width: '100%', height: '100%' }} />

        {/* GPS badge */}
        {pos && !loading && (
          <div className="absolute top-2 left-2 z-10 px-2.5 py-1 rounded-xl text-xs font-mono"
            style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(16,185,129,0.3)',
              color: '#10b981', backdropFilter: 'blur(8px)' }}>
            📍 {pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}
          </div>
        )}

        {/* Zoom controls */}
        <div className="absolute right-2 bottom-2 flex flex-col gap-1.5 z-10">
          {[{ l: '+', fn: () => mapRef.current?.zoomIn() }, { l: '–', fn: () => mapRef.current?.zoomOut() }].map(b => (
            <button key={b.l} onClick={b.fn}
              className="w-9 h-9 rounded-xl flex items-center justify-center font-black"
              style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', backdropFilter: 'blur(8px)', fontSize: 18 }}>
              {b.l}
            </button>
          ))}
          {pos && (
            <button onClick={() => mapRef.current?.setView([pos.lat, pos.lng], 15, { animate: true })}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(59,130,246,0.85)', border: '1px solid rgba(59,130,246,0.4)', backdropFilter: 'blur(8px)', fontSize: 17 }}>
              🎯
            </button>
          )}
        </div>
      </div>

      {/* ── AI tip ── */}
      {aiTip ? (
        <div className="px-4 py-2.5 flex-shrink-0" style={{ background: '#0a0a0a', borderTop: '1px solid #141414' }}>
          <div className="rounded-2xl px-4 py-3 flex items-start gap-3"
            style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)' }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
            <p style={{ fontSize: 12, color: '#ccc', lineHeight: 1.6, flex: 1 }}>{aiTip}</p>
            <button onClick={() => setAiTip('')} style={{ color: '#444', flexShrink: 0 }}><X size={14} /></button>
          </div>
        </div>
      ) : filtered.length > 0 && !loading && (
        <div className="px-4 py-2 flex-shrink-0" style={{ background: '#0a0a0a', borderTop: '1px solid #141414' }}>
          <button onClick={loadAiTip} disabled={aiLoading}
            className="w-full py-2.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}>
            {aiLoading ? <><Loader2 size={14} className="animate-spin" />Analysiere…</> : <>✨ KI-Empfehlung ({goalLabel})</>}
          </button>
        </div>
      )}

      {/* ── Restaurant list ── */}
      <div className="flex-1 overflow-y-auto" style={{ background: '#080808', borderTop: '1px solid #141414' }}>

        {/* Count header */}
        {!loading && !gpsErr && !apiErr && (
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid #111', position: 'sticky', top: 0, background: '#080808', zIndex: 5 }}>
            <p className="font-black text-sm" style={{ color: '#fff' }}>
              {filtered.length > 0
                ? `${filtered.length} Restaurant${filtered.length === 1 ? '' : 's'} gefunden`
                : 'Keine Ergebnisse'}
            </p>
            <p className="text-xs" style={{ color: '#333' }}>
              Sortiert nach Entfernung
            </p>
          </div>
        )}

        {/* Cards */}
        <div className="px-3 py-2 space-y-2.5"
          style={{ paddingBottom: 'calc(max(env(safe-area-inset-bottom), 20px) + 32px)' }}>
          {filtered.map(r => {
            const color  = scoreColor(r.healthScore)
            const isSel  = selected?.id === r.id
            const catLbl = amenityLabel(r.amenity, r.cuisine)
            return (
              <div
                key={r.id}
                onClick={() => {
                  setSelected(prev => prev?.id === r.id ? null : r)
                  mapRef.current?.setView([r.lat, r.lng], 17, { animate: true })
                }}
                style={{
                  background:    isSel ? 'rgba(16,185,129,0.06)' : '#111',
                  border:        `1px solid ${isSel ? 'rgba(16,185,129,0.25)' : '#1c1c1c'}`,
                  borderRadius:  20,
                  overflow:      'hidden',
                  transition:    'border-color 0.2s',
                  cursor:        'pointer',
                }}>

                {/* Card top row */}
                <div className="flex items-start gap-3 p-4 pb-3">

                  {/* Score badge */}
                  <div className="flex flex-col items-center justify-center rounded-2xl flex-shrink-0"
                    style={{ width: 52, height: 52, background: `${color}18`, border: `2px solid ${color}40` }}>
                    <p style={{ fontSize: 17, fontWeight: 900, color, lineHeight: 1 }}>{r.healthScore}</p>
                    <p style={{ fontSize: 9, fontWeight: 700, color, opacity: 0.7 }}>/10</p>
                  </div>

                  {/* Info */}
                  <div className="flex-1" style={{ minWidth: 0 }}>
                    <p className="font-black truncate" style={{ fontSize: 16, color: '#fff', letterSpacing: -0.3 }}>
                      {r.name}
                    </p>

                    {/* Meta row */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.06)', color: '#888', border: '1px solid rgba(255,255,255,0.07)' }}>
                        {catLbl}
                      </span>
                      <span className="text-xs font-bold" style={{ color: color }}>
                        {r.healthLabel}
                      </span>
                    </div>

                    {/* Distance + address */}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs font-black" style={{ color: '#60a5fa' }}>
                        📍 {fmtDist(r.distance)}
                      </span>
                      {r.address && (
                        <span className="text-xs truncate" style={{ color: '#444' }}>{r.address}</span>
                      )}
                    </div>

                    {/* Opening hours */}
                    {r.openingHours && (
                      <p className="text-xs mt-1" style={{ color: '#555' }}>
                        🕐 {todayHours(r.openingHours)}
                      </p>
                    )}

                    {/* Health tags */}
                    {r.healthTags.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {r.healthTags.slice(0, 3).map(t => (
                          <span key={t} className="text-xs px-1.5 py-0.5 rounded-lg"
                            style={{ background: `${color}15`, color, border: `1px solid ${color}25`, fontSize: 10 }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Navigation button */}
                <div className="px-4 pb-4">
                  <button
                    onClick={e => { e.stopPropagation(); openNav(r) }}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl font-bold text-sm"
                    style={{ height: 44, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa' }}>
                    <Navigation2 size={16} />
                    Navigation starten
                  </button>
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && !loading && !gpsErr && !apiErr && (
            <div className="py-12 text-center">
              <p style={{ fontSize: 40, marginBottom: 10 }}>🔍</p>
              <p style={{ color: '#555', fontSize: 15, fontWeight: 700 }}>Keine Restaurants gefunden</p>
              <p className="mt-1" style={{ color: '#333', fontSize: 13 }}>
                Versuche einen größeren Umkreis.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
