import { useState, useEffect, useRef } from 'react'
import { Play, X, Target, Clock, MapPin } from 'lucide-react'
import { useStore } from '../store/useStore'

// ── Weather helpers ──────────────────────────────────────────────────────────

interface WeatherData { temp: number; code: number; wind: number }

function weatherEmoji(code: number) {
  if (code === 0)          return '☀️'
  if (code <= 3)           return '⛅'
  if (code <= 48)          return '🌫️'
  if (code <= 55)          return '🌦️'
  if (code <= 65)          return '🌧️'
  if (code <= 77)          return '❄️'
  if (code <= 82)          return '🌦️'
  return '⛈️'
}

function weatherLabel(code: number) {
  if (code === 0)          return 'Sonnig'
  if (code <= 3)           return 'Teilweise bewölkt'
  if (code <= 48)          return 'Nebelig'
  if (code <= 55)          return 'Leichter Regen'
  if (code <= 65)          return 'Regen'
  if (code <= 77)          return 'Schneefall'
  if (code <= 82)          return 'Regenschauer'
  return 'Gewitter'
}

// ── GPS signal bar component ─────────────────────────────────────────────────

function GpsSignalBars({ accuracy }: { accuracy: number | null }) {
  const bars = accuracy === null ? 0
    : accuracy < 5  ? 4
    : accuracy < 12 ? 3
    : accuracy < 20 ? 2
    : accuracy < 35 ? 1 : 0

  const label = accuracy === null ? 'Suche GPS…'
    : accuracy < 5  ? 'Exzellent'
    : accuracy < 12 ? 'Sehr gut'
    : accuracy < 20 ? 'Gut – bereit!'
    : accuracy < 35 ? 'Schwach – warte kurz'
    : 'Zu ungenau – bitte warten'

  const color = bars >= 3 ? '#10b981' : bars === 2 ? '#4a8c5c' : bars === 1 ? '#f97316' : '#ef4444'

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Big animated bars */}
      <div className="flex items-end gap-2">
        {[1, 2, 3, 4].map((b) => (
          <div key={b} style={{
            width: 14,
            height: 8 + b * 10,
            borderRadius: 4,
            background: b <= bars ? color : 'rgba(255,255,255,0.1)',
            transition: 'background 0.5s ease',
            boxShadow: b <= bars ? `0 0 8px ${color}60` : 'none',
          }} />
        ))}
      </div>
      <div className="text-center">
        <p style={{ fontSize: 17, fontWeight: 800, color, letterSpacing: -0.3 }}>{label}</p>
        {accuracy !== null
          ? <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>±{Math.round(accuracy)} m Genauigkeit</p>
          : <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>Bitte ins Freie gehen</p>}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  onStart: (goal?: { type: 'distance' | 'time'; value: number }) => void
  onCancel: () => void
}

export default function RunStartScreen({ onStart, onCancel }: Props) {
  const [accuracy, setAccuracy]   = useState<number | null>(null)
  const [gpsError, setGpsError]   = useState<string | null>(null)
  const [weather, setWeather]     = useState<WeatherData | null>(null)
  const [goalType, setGoalType]   = useState<'none' | 'distance' | 'time'>('none')
  const [goalValue, setGoalValue] = useState('')
  const watchRef = useRef<number | null>(null)
  const fetchedWeather = useRef(false)
  const profile = useStore((s) => s.profile)

  // ── GPS watcher (accuracy only – no tracking) ──────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError('GPS nicht verfügbar auf diesem Gerät')
      return
    }
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setAccuracy(pos.coords.accuracy)
        setGpsError(null)
        // Fetch weather once we have a fix
        if (!fetchedWeather.current) {
          fetchedWeather.current = true
          const { latitude: lat, longitude: lon } = pos.coords
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,weathercode,windspeed_10m&wind_speed_unit=kmh&forecast_days=1`)
            .then((r) => r.json())
            .then((d) => {
              if (d.current) setWeather({ temp: Math.round(d.current.temperature_2m), code: d.current.weathercode, wind: Math.round(d.current.windspeed_10m) })
            })
            .catch(() => {})
        }
      },
      (err) => {
        const msgs: Record<number, string> = {
          1: 'Standort-Berechtigung verweigert',
          2: 'Position nicht verfügbar',
          3: 'GPS-Zeitüberschreitung',
        }
        setGpsError(msgs[err.code] ?? 'GPS-Fehler')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current)
    }
  }, [])

  const gpsReady  = accuracy !== null && accuracy < 35 && !gpsError
  const gpsGood   = accuracy !== null && accuracy < 20

  const handleStart = () => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current)
    const val = parseFloat(goalValue)
    if (goalType !== 'none' && val > 0) {
      onStart({ type: goalType, value: val })
    } else {
      onStart()
    }
  }

  const tips = [
    '💡 Lauf mindestens 20 Min für maximalen Fettabbau',
    '💡 Aufwärmen verhindert Verletzungen',
    '💡 Trinke vorher 300–500ml Wasser',
    '💡 Atemrhythmus: 2 Schritte ein – 2 Schritte aus',
  ]
  const tip = tips[new Date().getDate() % tips.length]

  return (
    <div className="fixed inset-0 z-[110] flex flex-col" style={{ background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 18px)', paddingBottom: 14,
          background: 'rgba(0,0,0,0.96)', backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(125,184,138,0.15)' }}>
        <div>
          <h2 className="font-black text-xl" style={{ color: '#fff', letterSpacing: -0.5 }}>Lauf vorbereiten</h2>
          {profile?.name && <p style={{ fontSize: 12, color: '#555', marginTop: 1 }}>Bereit, {profile.name.split(' ')[0]}?</p>}
        </div>
        <button onClick={onCancel}
          className="w-10 h-10 rounded-2xl flex items-center justify-center glass-press"
          style={{ background: 'rgba(74,140,92,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <X size={18} style={{ color: '#888' }} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

        {/* ── GPS Signal card ── */}
        <div className="rounded-3xl p-6 text-center"
          style={{
            background: gpsError ? 'rgba(239,68,68,0.08)'
              : gpsGood ? 'rgba(16,185,129,0.07)'
              : gpsReady ? 'rgba(74,140,92,0.05)'
              : 'rgba(59,130,246,0.07)',
            border: `1.5px solid ${gpsError ? 'rgba(239,68,68,0.2)'
              : gpsGood ? 'rgba(16,185,129,0.2)'
              : gpsReady ? 'rgba(74,140,92,0.18)'
              : 'rgba(59,130,246,0.2)'}`,
          }}>

          {gpsError ? (
            <div>
              <p style={{ fontSize: 52, marginBottom: 8 }}>📡</p>
              <p style={{ fontWeight: 800, fontSize: 15, color: '#ef4444' }}>{gpsError}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 6, lineHeight: 1.5 }}>
                Einstellungen → Datenschutz → Standort<br />Berechtigung für Safari erlauben
              </p>
            </div>
          ) : (
            <>
              <GpsSignalBars accuracy={accuracy} />
              {gpsGood && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>Bereit zum Laufen!</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Weather card ── */}
        {weather && (
          <div className="rounded-3xl px-5 py-4 flex items-center gap-4"
            style={{ background: 'rgba(74,140,92,0.06)', border: '1px solid rgba(74,140,92,0.1)' }}>
            <span style={{ fontSize: 44 }}>{weatherEmoji(weather.code)}</span>
            <div>
              <p style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: -1 }}>
                {weather.temp}°C
              </p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>
                {weatherLabel(weather.code)} · 💨 {weather.wind} km/h
              </p>
            </div>
          </div>
        )}

        {/* ── Goal setting ── */}
        <div className="rounded-3xl p-4 space-y-3"
          style={{ background: '#0d0d0d', border: '1px solid rgba(125,184,138,0.15)' }}>
          <p className="label px-1">Ziel setzen (optional)</p>
          <div className="flex gap-2">
            {[
              { id: 'none'     as const, icon: <span>🏃</span>, label: 'Frei laufen' },
              { id: 'distance' as const, icon: <MapPin size={14}/>, label: 'Distanz' },
              { id: 'time'     as const, icon: <Clock size={14}/>, label: 'Zeit' },
            ].map((opt) => (
              <button key={opt.id} onClick={() => setGoalType(opt.id)}
                className="flex-1 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                style={goalType === opt.id
                  ? { background: 'rgba(74,140,92,0.15)', border: '1.5px solid rgba(245,158,11,0.4)', color: '#4a8c5c' }
                  : { background: 'rgba(74,140,92,0.06)', border: '1px solid rgba(74,140,92,0.1)', color: 'rgba(255,255,255,0.4)' }}>
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>

          {goalType !== 'none' && (
            <div className="flex items-center gap-3 pt-1">
              <input
                type="number" inputMode="decimal"
                value={goalValue}
                onChange={(e) => setGoalValue(e.target.value)}
                placeholder={goalType === 'distance' ? '5.0' : '30'}
                style={{
                  flex: 1, background: 'rgba(74,140,92,0.08)',
                  border: '1px solid rgba(74,140,92,0.12)',
                  borderRadius: 16, color: '#fff',
                  padding: '13px 16px', fontSize: 22, fontWeight: 900,
                  textAlign: 'center',
                }}
              />
              <div className="flex flex-col items-center" style={{ flexShrink: 0 }}>
                <Target size={16} style={{ color: '#4a8c5c', marginBottom: 2 }} />
                <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
                  {goalType === 'distance' ? 'km' : 'min'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Tip card ── */}
        <div className="rounded-2xl px-4 py-3"
          style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(74,140,92,0.08)' }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{tip}</p>
        </div>
      </div>

      {/* ── Start button ── */}
      <div className="px-5"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 28px)', paddingTop: 14,
          background: 'rgba(0,0,0,0.96)', backdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(125,184,138,0.15)' }}>

        <button
          onClick={handleStart}
          disabled={!!gpsError}
          className="w-full flex items-center justify-center gap-3 rounded-3xl font-black disabled:opacity-40 glass-press"
          style={{
            paddingTop: 22, paddingBottom: 22,
            background: gpsReady
              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
              : 'rgba(74,140,92,0.22)',
            boxShadow: gpsReady ? '0 8px 32px rgba(245,158,11,0.4)' : 'none',
            color: '#000', border: 'none', fontSize: 19,
            transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)',
          }}>
          <Play size={26} fill="#000" style={{ flexShrink: 0 }} />
          {gpsError        ? 'GPS-Fehler – nicht startbar'
            : gpsReady     ? 'Jetzt loslaufen!'
            : accuracy === null ? 'Warte auf GPS…'
            : 'GPS noch ungenau…'}
        </button>

        {!gpsReady && !gpsError && (
          <p className="text-center mt-2" style={{ fontSize: 11, color: '#444' }}>
            Du kannst auch ohne perfektes GPS starten – Tap trotzdem
          </p>
        )}
        {!gpsReady && !gpsError && (
          <button onClick={handleStart}
            className="w-full mt-2 py-3 rounded-2xl text-sm font-bold glass-press"
            style={{ color: 'rgba(255,255,255,0.3)', background: 'rgba(74,140,92,0.06)', border: '1px solid rgba(255,255,255,0.07)' }}>
            Trotzdem starten (ohne GPS)
          </button>
        )}
      </div>
    </div>
  )
}
