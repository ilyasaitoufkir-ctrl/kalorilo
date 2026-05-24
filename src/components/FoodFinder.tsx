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
  healthScore: number    // 1–10
  healthLabel: string
  healthTags: string[]
  distance: number       // metres
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
    case 'salad':    return c.includes('salad')   || n.includes('salad')  || n.includes('bowl')
    case 'sushi':    return c.includes('sushi')   || c.includes('japanese')
    case 'smoothie': return c.includes('juice')   || n.includes('smoothie') || n.includes('juice') || n.includes('saft')
    case 'vegan':    return t.includes('vegan')   || c.includes('vegan')
    case 'protein':  return r.healthScore >= 7    && !c.includes('pizza') && !c.includes('burger')
    case 'wrap':     return c.includes('kebab')   || c.includes('wrap')   || n.includes('wrap')   || n.includes('burrito')
    case 'asian':    return c.includes('japanese')|| c.includes('thai')   || c.includes('chinese')|| c.includes('vietnamese') || c.includes('sushi')
    default:         return true
  }
}

// ── Rule-based health scoring ─────────────────────────────────────────────

function scoreRestaurant(tags: Record<string, string>): { score: number; label: string; tags: string[] } {
  const c = (tags.cuisine ?? '').toLowerCase()
  const n = (tags.name   ?? '').toLowerCase()
  const isVegan = tags['diet:vegan']        === 'yes' || c.includes('vegan')
  const isVeg   = tags['diet:vegetarian']   === 'yes' || c.includes('vegetarian')

  let score = 5
  const hTags: string[] = []

  if      (c.includes('sushi') || c.includes('japanese')) { score = 8; hTags.push('🐟 Sushi') }
  else if (c.includes('thai'))                             { score = 7; hTags.push('🍜 Thai') }
  else if (c.includes('vietnamese'))                       { score = 7; hTags.push('🍜 Vietnamesisch') }
  else if (c.includes('mediterranean') || c.includes('greek')) { score = 7; hTags.push('🫒 Mediterran') }
  else if (c.includes('indian'))                           { score = 6; hTags.push('🍛 Indisch') }
  else if (c.includes('burger')  || c.includes('american'))  { score = 3; hTags.push('🍔 Burger') }
  else if (c.includes('pizza'))                            { score = 4; hTags.push('🍕 Pizza') }
  else if (c.includes('kebab')   || c.includes('turkish')) { score = 5; hTags.push('🥙 Döner') }
  else if (c.includes('sandwich'))                         { score = 6; hTags.push('🥪 Sandwich') }

  if (n.includes('salad') || n.includes('bowl') || n.includes('fresh'))
    { score = Math.max(score, 8); hTags.push('🥗 Salat') }
  if (n.includes('smoothie') || n.includes('juice') || n.includes('saft') || c.includes('juice_bar'))
    { score = Math.max(score, 9); hTags.push('🥤 Smoothie') }
  if (n.includes('fit') || n.includes('health') || n.includes('lean') || n.includes('clean') || n.includes('vitalküche'))
    { score = Math.max(score, 8); hTags.push('💪 Fitness') }
  if (n.includes('wrap') || n.includes('burrito'))
    { score = Math.max(score, 6); hTags.push('🥙 Wrap') }
  if (isVegan)  { score = Math.max(score, 8); hTags.push('🌱 Vegan') }
  if (isVeg)    { score = Math.max(score, 7); hTags.push('🌱 Veggie') }
  if (n.includes('mcdonalds') || n.includes("mcdonald's") || n.includes('burger king') || n.includes('kfc'))
    { score = 2 }

  const label = score >= 8 ? '✅ Sehr gesund'
    : score >= 6 ? '👍 Gesund'
    : score >= 4 ? '⚠️ Mittel'
    : '❌ Ungesund'

  return { score, label, tags: hTags }
}

function scoreColor(s: number) {
  return s >= 8 ? '#10b981' : s >= 6 ? '#f59e0b' : s >= 4 ? '#f97316' : '#ef4444'
}

// ── Distance helpers ──────────────────────────────────────────────────────

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

function fmtDist(m: number) {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`
}

// ── Overpass API ──────────────────────────────────────────────────────────

async function fetchNearby(lat: number, lng: number, radius: number): Promise<Restaurant[]> {
  const q = `[out:json][timeout:20];(node[amenity=restaurant](around:${radius},${lat},${lng});node[amenity=cafe](around:${radius},${lat},${lng});node[amenity=fast_food](around:${radius},${lat},${lng}););out body;`
  const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: q })
  if (!res.ok) throw new Error('Overpass API Fehler')
  const data = await res.json()
  return (data.elements as any[])
    .filter(el => el.tags?.name)
    .map(el => {
      const { score, label, tags } = scoreRestaurant(el.tags)
      return {
        id: String(el.id),
        name: el.tags.name,
        lat: el.lat,
        lng: el.lon,
        cuisine: el.tags.cuisine ?? el.tags.amenity ?? '',
        address: el.tags['addr:street']
          ? `${el.tags['addr:street']} ${el.tags['addr:housenumber'] ?? ''}`.trim()
          : undefined,
        openingHours: el.tags.opening_hours,
        website: el.tags.website ?? el.tags['contact:website'],
        healthScore: score,
        healthLabel: label,
        healthTags: tags,
        distance: haversineM(lat, lng, el.lat, el.lon),
      } satisfies Restaurant
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 50)
}

// ── AI tip (Claude) ───────────────────────────────────────────────────────

async function getAiTip(restaurants: Restaurant[], goal: string, apiKey: string): Promise<string> {
  const top5 = restaurants
    .slice(0, 5)
    .map(r => `${r.name} (${r.cuisine || 'Restaurant'}, Gesund-Score: ${r.healthScore}/10)`)
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
        content: `Mein Ernährungsziel: ${goal}. Umliegende Restaurants: ${top5}. Gib eine persönliche Empfehlung in 2 Sätzen auf Deutsch. Nenne konkrete Restaurantnamen. Nur den Text, ohne Einleitung.`,
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
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [pos, setPos]         = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [gpsErr, setGpsErr]   = useState<string | null>(null)
  const [apiErr, setApiErr]   = useState<string | null>(null)
  const [cat, setCat]         = useState('all')
  const [radius, setRadius]   = useState(1000)
  const [selected, setSelected] = useState<Restaurant | null>(null)
  const [listOpen, setListOpen] = useState(true)
  const [aiTip, setAiTip]    = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const apiKey = useStore(s => s.apiKeys.anthropic)
  const profile = useStore(s => s.profile)
  const goalLabel = profile?.goal === 'lose' ? 'Gewicht verlieren' : profile?.goal === 'gain' ? 'Muskeln aufbauen' : 'Gewicht halten'

  // Map refs (imperative Leaflet, not react-leaflet)
  const mapDivRef      = useRef<HTMLDivElement>(null)
  const mapRef         = useRef<L.Map | null>(null)
  const userDotRef     = useRef<L.Marker | null>(null)
  const markerLayerRef = useRef<L.LayerGroup | null>(null)

  const filtered = useMemo(() => restaurants.filter(r => matchCat(r, cat)), [restaurants, cat])

  // ── Step 1: get GPS position ────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) { setGpsErr('GPS nicht verfügbar'); setLoading(false); return }
    navigator.geolocation.getCurrentPosition(
      pos => setPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => {
        const msgs: Record<number, string> = {
          1: 'GPS-Zugriff verweigert – bitte Berechtigung erteilen.',
          2: 'GPS nicht verfügbar.',
          3: 'GPS-Zeitüberschreitung – bitte ins Freie gehen.',
        }
        setGpsErr(msgs[err.code] ?? 'GPS-Fehler')
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }, [])

  // ── Step 2: load restaurants when position or radius changes ────────────
  useEffect(() => {
    if (!pos) return
    setLoading(true)
    setApiErr(null)
    setAiTip('')
    fetchNearby(pos.lat, pos.lng, radius)
      .then(r => { setRestaurants(r); setLoading(false) })
      .catch(() => { setApiErr('Restaurants konnten nicht geladen werden.'); setLoading(false) })
  }, [pos?.lat, pos?.lng, radius])

  // ── Init Leaflet map once ───────────────────────────────────────────────
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

  // ── Update user position dot on map ────────────────────────────────────
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

  // ── Redraw restaurant pins when filter or data changes ──────────────────
  useEffect(() => {
    const layer = markerLayerRef.current
    if (!mapRef.current || !layer) return
    layer.clearLayers()
    filtered.forEach(r => {
      const color = scoreColor(r.healthScore)
      const isSelected = r.id === selected?.id
      const icon = L.divIcon({
        html: `
          <div style="
            position:relative;
            width:${isSelected ? 40 : 32}px;
            height:${isSelected ? 40 : 32}px;
          ">
            <div style="
              width:100%;height:100%;
              background:${color};
              border:${isSelected ? '3px' : '2px'} solid #fff;
              border-radius:50% 50% 50% 0;
              transform:rotate(-45deg);
              box-shadow:0 3px 12px rgba(0,0,0,0.5)${isSelected ? ',0 0 0 4px ' + color + '40' : ''};
              display:flex;align-items:center;justify-content:center;
            ">
              <div style="transform:rotate(45deg);font-size:${isSelected ? 16 : 13}px">
                ${r.healthScore >= 8 ? '🥗' : r.healthScore >= 6 ? '🍽' : r.healthScore >= 4 ? '🍟' : '🍔'}
              </div>
            </div>
          </div>
        `,
        iconSize: [isSelected ? 40 : 32, isSelected ? 40 : 32],
        iconAnchor: [isSelected ? 20 : 16, isSelected ? 40 : 32],
        className: '',
      })
      L.marker([r.lat, r.lng], { icon })
        .addTo(layer)
        .on('click', () => {
          setSelected(r)
          setListOpen(true)
          mapRef.current?.setView([r.lat, r.lng], 17, { animate: true, duration: 0.5 })
        })
    })
  }, [filtered, selected])

  // ── AI recommendation ───────────────────────────────────────────────────
  const loadAiTip = async () => {
    if (!apiKey?.trim()) { toast.error('Kein Anthropic API Key hinterlegt (Profil → API Keys)'); return }
    if (restaurants.length === 0) return
    setAiLoading(true)
    try {
      const tip = await getAiTip(restaurants.filter(r => matchCat(r, cat)).slice(0, 8), goalLabel, apiKey)
      setAiTip(tip)
    } catch { toast.error('KI-Analyse fehlgeschlagen') }
    finally { setAiLoading(false) }
  }

  const openNav = (r: Restaurant) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`, '_blank')
  }

  const reload = () => {
    if (!pos) return
    setLoading(true)
    setApiErr(null)
    setAiTip('')
    fetchNearby(pos.lat, pos.lng, radius)
      .then(r => { setRestaurants(r); setLoading(false) })
      .catch(() => { setApiErr('Laden fehlgeschlagen'); setLoading(false) })
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: '#000' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 14px)',
          paddingBottom: 10,
          background: 'rgba(0,0,0,0.94)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #1a1a1a',
        }}>
        <div>
          <h2 className="font-black text-lg" style={{ color: '#fff' }}>📍 Food in der Nähe</h2>
          <p style={{ fontSize: 11, color: '#555', marginTop: 1 }}>
            {loading ? 'Suche Restaurants…'
              : gpsErr ? gpsErr
              : `${filtered.length} von ${restaurants.length} Restaurants`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!loading && pos && (
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

      {/* ── Category filter bar ── */}
      <div className="flex gap-2 px-4 py-2.5 overflow-x-auto" style={{ scrollbarWidth: 'none', background: '#0a0a0a', borderBottom: '1px solid #141414' }}>
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
      <div className="relative" style={{ flex: listOpen ? '0 0 42%' : '1', minHeight: 200, transition: 'flex 0.3s ease' }}>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}>
            <Loader2 size={32} style={{ color: '#10b981' }} className="animate-spin" />
            <p style={{ color: '#888', fontSize: 14 }}>
              {pos ? 'Lade Restaurants…' : 'GPS wird ermittelt…'}
            </p>
          </div>
        )}

        {/* GPS / API error overlay */}
        {(gpsErr || apiErr) && !loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-8"
            style={{ background: '#080808' }}>
            <span style={{ fontSize: 48 }}>📡</span>
            <p className="text-center font-bold text-sm" style={{ color: '#ef4444', lineHeight: 1.5 }}>
              {gpsErr ?? apiErr}
            </p>
            {apiErr && pos && (
              <button onClick={reload} className="btn-gold px-6 py-3 text-sm">
                Erneut versuchen
              </button>
            )}
          </div>
        )}

        <div ref={mapDivRef} style={{ width: '100%', height: '100%' }} />

        {/* Map zoom controls */}
        <div className="absolute right-3 bottom-3 flex flex-col gap-1.5 z-10">
          {[
            { label: '+', onClick: () => mapRef.current?.zoomIn() },
            { label: '–', onClick: () => mapRef.current?.zoomOut() },
          ].map(btn => (
            <button key={btn.label} onClick={btn.onClick}
              className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-base"
              style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', backdropFilter: 'blur(8px)' }}>
              {btn.label}
            </button>
          ))}
          {pos && (
            <button onClick={() => mapRef.current?.setView([pos.lat, pos.lng], 15, { animate: true })}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(59,130,246,0.8)', border: '1px solid rgba(59,130,246,0.4)', backdropFilter: 'blur(8px)', fontSize: 18 }}>
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
              : <>✨ KI-Empfehlung für mein Ziel ({goalLabel})</>}
          </button>
        </div>
      )}

      {/* ── Bottom restaurant list ── */}
      <div style={{ background: '#0a0a0a', borderTop: '1px solid #141414', display: 'flex', flexDirection: 'column', flex: listOpen ? '1' : '0 0 48px', minHeight: 48, overflow: 'hidden', transition: 'flex 0.3s ease' }}>

        {/* Sheet toggle handle */}
        <button className="flex items-center justify-between px-4 py-3 w-full flex-shrink-0"
          onClick={() => setListOpen(v => !v)}>
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm" style={{ color: '#fff' }}>
              {filtered.length > 0
                ? `${filtered.length} Restaurant${filtered.length === 1 ? '' : 's'} in der Nähe`
                : 'Keine Restaurants in dieser Kategorie'}
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

        {/* Scrollable list */}
        <div className="overflow-y-auto flex-1" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>

          {/* Selected restaurant detail card */}
          {selected && listOpen && (
            <div className="mx-4 mb-3 glass rounded-2xl overflow-hidden"
              style={{ background: 'rgba(16,185,129,0.04)', border: `1px solid ${scoreColor(selected.healthScore)}30` }}>
              <div className="flex items-start gap-3 p-4">
                <div className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
                  style={{ background: `${scoreColor(selected.healthScore)}18`, border: `1.5px solid ${scoreColor(selected.healthScore)}40` }}>
                  <p style={{ fontSize: 16, fontWeight: 900, color: scoreColor(selected.healthScore), lineHeight: 1 }}>{selected.healthScore}</p>
                  <p style={{ fontSize: 8, color: scoreColor(selected.healthScore), fontWeight: 700 }}>/10</p>
                </div>
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <p className="font-black text-base truncate" style={{ color: '#fff' }}>{selected.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: scoreColor(selected.healthScore) }}>{selected.healthLabel}</p>
                  {selected.address && <p className="text-xs mt-1" style={{ color: '#555' }}>{selected.address}</p>}
                  {selected.openingHours && (
                    <p className="text-xs mt-1" style={{ color: '#555' }}>
                      🕐 {selected.openingHours.split(';')[0]}
                    </p>
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

          {/* Restaurant list items */}
          {filtered.map((r, i) => (
            <div key={r.id}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer active:opacity-70"
              style={{
                borderTop: i > 0 ? '1px solid #141414' : 'none',
                background: selected?.id === r.id ? 'rgba(16,185,129,0.04)' : 'transparent',
              }}
              onClick={() => {
                setSelected(r === selected ? null : r)
                if (r !== selected) mapRef.current?.setView([r.lat, r.lng], 17, { animate: true })
              }}>

              {/* Score badge */}
              <div className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
                style={{ background: `${scoreColor(r.healthScore)}18`, border: `1.5px solid ${scoreColor(r.healthScore)}35` }}>
                <p style={{ fontSize: 15, fontWeight: 900, color: scoreColor(r.healthScore), lineHeight: 1 }}>{r.healthScore}</p>
                <p style={{ fontSize: 7, color: scoreColor(r.healthScore), fontWeight: 700 }}>/10</p>
              </div>

              {/* Info */}
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

              {/* Navigate button */}
              <button
                onClick={e => { e.stopPropagation(); openNav(r) }}
                className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }}>
                <Navigation2 size={15} />
              </button>
            </div>
          ))}

          {filtered.length === 0 && !loading && (
            <div className="py-10 text-center px-6">
              <p style={{ fontSize: 36, marginBottom: 8 }}>🔍</p>
              <p style={{ color: '#555', fontSize: 14 }}>Keine Restaurants für diese Kategorie in {radius < 1000 ? `${radius}m` : `${radius / 1000}km`} Umkreis</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
