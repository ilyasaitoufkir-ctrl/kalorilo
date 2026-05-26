import { useState, useEffect, useRef } from 'react'
import { Pause, Play, Square, ChevronUp, ChevronDown } from 'lucide-react'
import type { RunTrackerState, GpsStatus } from '../hooks/useRunTracker'
import RunMap from './RunMap'

// ── Formatters (exported for RunSummary) ──────────────────────────────────────
export function fmtTime(s: number): string {
  const h   = Math.floor(s / 3600)
  const m   = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function fmtPace(secPerKm: number): string {
  if (secPerKm <= 0 || secPerKm > 1800) return '--:--'
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// ── GPS signal bars ───────────────────────────────────────────────────────────
function GpsSignal({ accuracy, gpsStatus }: { accuracy: number | null; gpsStatus: GpsStatus }) {
  const bars = accuracy === null ? 0
    : accuracy < 5  ? 4
    : accuracy < 12 ? 3
    : accuracy < 20 ? 2
    : accuracy < 35 ? 1 : 0
  const color = bars >= 3 ? '#10b981' : bars >= 2 ? '#4a8c5c' : '#f97316'

  const label = gpsStatus === 'searching' ? 'GPS sucht…'
    : gpsStatus === 'weak'      ? 'GPS schwach'
    : gpsStatus === 'good'      ? 'GPS bereit'
    : 'GPS ✅'

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-end gap-0.5">
        {[1, 2, 3, 4].map((b) => (
          <div key={b} style={{
            width: 4, height: 3 + b * 3, borderRadius: 1,
            background: b <= bars ? color : 'rgba(255,255,255,0.15)',
          }} />
        ))}
      </div>
      <span style={{ fontSize: 9, color: color || '#555', fontWeight: 700, lineHeight: 1 }}>
        {label}
      </span>
    </div>
  )
}

// ── Stop confirmation modal ───────────────────────────────────────────────────
function StopConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-sm rounded-3xl p-7 text-center"
        style={{ background: '#ffffff', border: '1px solid #2a2a2a', boxShadow: '0 24px 80px rgba(0,0,0,0.9)' }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🏁</div>
        <h3 className="text-xl font-black mb-2" style={{ color: '#fff' }}>Lauf beenden?</h3>
        <p className="text-sm mb-7" style={{ color: '#666', lineHeight: 1.7 }}>
          Deine Strecke und Statistiken werden<br />automatisch gespeichert.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-4 rounded-2xl font-bold text-sm glass-press"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>
            Weiter laufen
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-4 rounded-2xl font-bold text-sm glass-press"
            style={{ background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444' }}>
            Jetzt beenden
          </button>
        </div>
      </div>
    </div>
  )
}

// ── KM Split toast overlay ────────────────────────────────────────────────────
function KmToast({ km, pace }: { km: number; pace: string }) {
  return (
    <div className="absolute top-4 left-1/2 z-20"
      style={{ transform: 'translateX(-50%)', animation: 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1) both' }}>
      <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl"
        style={{
          background: 'rgba(245,158,11,0.95)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px rgba(245,158,11,0.5)',
        }}>
        <span style={{ fontSize: 22 }}>⚡</span>
        <div>
          <p style={{ fontSize: 16, fontWeight: 900, color: '#000', lineHeight: 1 }}>
            KM {km} geschafft!
          </p>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(0,0,0,0.65)', marginTop: 1 }}>
            Pace: {pace} min/km
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Main RunActiveScreen ──────────────────────────────────────────────────────
interface Props {
  run: RunTrackerState & { pause: () => void; resume: () => void; finish: () => void }
  goal?: { type: 'distance' | 'time'; value: number }
}

export default function RunActiveScreen({ run, goal }: Props) {
  const [showStop, setShowStop]         = useState(false)
  const [statsExpanded, setExpanded]    = useState(false)
  const [kmToast, setKmToast]           = useState<{ km: number; pace: string } | null>(null)
  const prevSplitLen = useRef(0)

  const { status, elapsed, distance, currentPace, avgPace, calories,
    elevationGain, route, splits, gpsAccuracy, gpsStatus, gpsError, kmMarkers } = run
  const isPaused = status === 'paused'

  // Detect new km split → show toast
  useEffect(() => {
    if (splits.length > prevSplitLen.current) {
      const last = splits[splits.length - 1]
      setKmToast({ km: last.km, pace: fmtPace(last.pace) })
      prevSplitLen.current = splits.length
      const t = setTimeout(() => setKmToast(null), 4000)
      return () => clearTimeout(t)
    }
    prevSplitLen.current = splits.length
  }, [splits.length])

  const distDisplay = distance < 1
    ? { value: (distance * 1000).toFixed(0), unit: 'm' }
    : { value: distance.toFixed(2), unit: 'km' }

  // Goal progress bar
  const goalPct = goal
    ? goal.type === 'distance'
      ? Math.min(1, distance / goal.value)
      : Math.min(1, elapsed / (goal.value * 60))
    : null

  return (
    <div className="fixed inset-0 z-[110] flex flex-col" style={{ background: 'var(--bg)' }}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 14px)',
          paddingBottom: 10,
          background: 'rgba(0,0,0,0.94)',
          backdropFilter: 'blur(16px)',
          zIndex: 10,
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
        <GpsSignal accuracy={gpsAccuracy} gpsStatus={gpsStatus} />

        <p style={{ color: '#fff', fontWeight: 900, fontSize: 14, letterSpacing: -0.3 }}>
          🏃 Läuft
        </p>

        {isPaused ? (
          <span className="px-3 py-1 rounded-full text-xs font-black"
            style={{ background: 'rgba(245,158,11,0.18)', color: '#4a8c5c', border: '1px solid rgba(74,140,92,0.3)' }}>
            Pausiert
          </span>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: '#10b981', animation: 'pulseSoft 1.4s ease-in-out infinite' }} />
            <span style={{ color: '#10b981', fontSize: 11, fontWeight: 700 }}>Live</span>
          </div>
        )}
      </div>

      {/* ── Goal progress bar ── */}
      {goalPct !== null && (
        <div style={{ height: 3, background: '#ffffff' }}>
          <div style={{
            height: '100%', width: `${goalPct * 100}%`,
            background: goalPct >= 1
              ? 'linear-gradient(90deg, #10b981, #059669)'
              : 'linear-gradient(90deg, #f59e0b, #d97706)',
            transition: 'width 0.5s ease',
          }} />
        </div>
      )}

      {/* ── Live map ── */}
      <div className="relative" style={{ flex: '1 1 0', minHeight: 0 }}>

        {/* GPS error */}
        {gpsError && (
          <div className="absolute top-3 left-3 right-3 z-10 rounded-2xl px-4 py-3 text-center text-sm font-bold"
            style={{ background: 'rgba(239,68,68,0.92)', color: '#fff', backdropFilter: 'blur(8px)' }}>
            ⚠ {gpsError}
          </div>
        )}

        {/* KM split toast */}
        {kmToast && <KmToast km={kmToast.km} pace={kmToast.pace} />}

        {route.length > 0 ? (
          <RunMap route={route} kmMarkers={kmMarkers} style={{ width: '100%', height: '100%' }} />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-5"
            style={{ background: '#060606' }}>
            <div style={{ fontSize: 52 }}>📡</div>
            <div className="text-center">
              <p style={{ fontWeight: 800, fontSize: 16, color: '#ccc' }}>GPS Signal suchen…</p>
              <p style={{ fontSize: 13, color: '#444', marginTop: 4 }}>Bitte ins Freie gehen</p>
            </div>
          </div>
        )}

        {/* Timer overlay – anchored to bottom of map */}
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-4 pt-10"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.75) 55%, transparent 100%)', pointerEvents: 'none' }}>
          <p className="font-black font-mono"
            style={{ fontSize: 78, lineHeight: 1, color: '#fff', letterSpacing: -4, textShadow: '0 0 40px rgba(0,0,0,0.9)' }}>
            {fmtTime(elapsed)}
          </p>
          <p style={{ fontSize: 10, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 }}>
            {isPaused ? 'Pausiert' : 'Zeit'}
          </p>
        </div>

        {/* Expand/collapse toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="absolute bottom-3 right-3 z-10 w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}>
          {statsExpanded ? <ChevronDown size={16} style={{ color: '#888' }} /> : <ChevronUp size={16} style={{ color: '#888' }} />}
        </button>
      </div>

      {/* ── Stats panel ── */}
      <div style={{ background: '#080808', flexShrink: 0 }}>

        {/* Main row: 3 stats */}
        <div className="grid grid-cols-3" style={{ borderBottom: '1px solid #141414' }}>
          {[
            { label: 'Distanz', value: distDisplay.value, sub: distDisplay.unit, color: '#4a8c5c' },
            { label: 'Pace /km', value: fmtPace(currentPace), sub: 'aktuell', color: '#fff' },
            { label: 'Ø Pace /km', value: fmtPace(avgPace), sub: 'gesamt', color: '#aaa' },
          ].map((s, i) => (
            <div key={s.label} className="flex flex-col items-center justify-center py-3"
              style={{ borderRight: i < 2 ? '1px solid #141414' : 'none' }}>
              <p style={{ fontSize: 27, fontWeight: 900, color: s.color, lineHeight: 1, letterSpacing: -0.5 }}>{s.value}</p>
              <p style={{ fontSize: 10, color: s.color, opacity: 0.55, fontWeight: 700, marginTop: 1 }}>{s.sub}</p>
              <p style={{ fontSize: 9, color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 3 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Secondary row: calories, elevation, splits */}
        {(statsExpanded || splits.length > 0) && (
          <div className="grid grid-cols-3" style={{ borderBottom: '1px solid #141414' }}>
            {[
              { emoji: '🔥', val: String(calories),                     unit: 'kcal',   color: '#f97316' },
              { emoji: '⛰',  val: elevationGain > 0 ? `+${elevationGain}` : '–', unit: 'm hoch',  color: '#60a5fa' },
              { emoji: '📍', val: String(splits.length),                unit: 'splits', color: '#a78bfa' },
            ].map((s, i) => (
              <div key={s.emoji} className="flex items-center justify-center gap-1.5 py-2.5"
                style={{ borderRight: i < 2 ? '1px solid #141414' : 'none' }}>
                <span style={{ fontSize: 15 }}>{s.emoji}</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</p>
                  <p style={{ fontSize: 8, color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>{s.unit}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Latest km splits (last 3) */}
        {statsExpanded && splits.length > 0 && (
          <div className="px-4 py-2" style={{ borderBottom: '1px solid #141414' }}>
            <p className="label mb-1.5">Letzte Splits</p>
            <div className="flex gap-2">
              {splits.slice(-3).map((s) => (
                <div key={s.km} className="flex-1 rounded-xl py-2 text-center"
                  style={{ background: '#ffffff', border: '1px solid #1c1c1c' }}>
                  <p style={{ fontSize: 11, fontWeight: 900, color: '#4a8c5c' }}>{fmtPace(s.pace)}</p>
                  <p style={{ fontSize: 9, color: '#444', fontWeight: 700 }}>KM {s.km}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Goal progress if set */}
        {goal && goalPct !== null && (
          <div className="px-4 py-2.5" style={{ borderBottom: '1px solid #141414' }}>
            <div className="flex items-center justify-between mb-1.5">
              <p style={{ fontSize: 11, color: '#555', fontWeight: 700 }}>
                Ziel: {goal.type === 'distance' ? `${goal.value} km` : `${goal.value} min`}
              </p>
              <p style={{ fontSize: 11, color: goalPct >= 1 ? '#10b981' : '#4a8c5c', fontWeight: 800 }}>
                {Math.round(goalPct * 100)}%
              </p>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#f0f7f0' }}>
              <div style={{
                height: '100%', width: `${goalPct * 100}%`,
                background: goalPct >= 1 ? '#10b981' : '#4a8c5c',
                transition: 'width 0.5s ease', borderRadius: '99px',
              }} />
            </div>
          </div>
        )}

        {/* Control buttons */}
        <div className="flex gap-3 px-4 pt-3"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 28px)' }}>
          {isPaused ? (
            <button onClick={run.resume}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl font-black glass-press"
              style={{ fontSize: 18, paddingTop: 20, paddingBottom: 20,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 6px 24px rgba(16,185,129,0.35)', color: '#fff', border: 'none' }}>
              <Play size={24} fill="#fff" /> Weiter
            </button>
          ) : (
            <button onClick={run.pause}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl font-black glass-press"
              style={{ fontSize: 18, paddingTop: 20, paddingBottom: 20,
                background: 'rgba(74,140,92,0.1)', border: '1.5px solid rgba(245,158,11,0.4)', color: '#4a8c5c' }}>
              <Pause size={24} /> Pause
            </button>
          )}

          <button onClick={() => setShowStop(true)}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl font-black glass-press"
            style={{ fontSize: 18, paddingTop: 20, paddingBottom: 20,
              background: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
            <Square size={24} /> Beenden
          </button>
        </div>
      </div>

      {showStop && (
        <StopConfirm
          onCancel={() => setShowStop(false)}
          onConfirm={() => { setShowStop(false); run.finish() }}
        />
      )}
    </div>
  )
}
