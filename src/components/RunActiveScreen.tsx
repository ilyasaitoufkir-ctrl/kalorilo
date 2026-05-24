import { useState } from 'react'
import { Pause, Play, Square } from 'lucide-react'
import type { RunTrackerState } from '../hooks/useRunTracker'
import RunMap from './RunMap'

// ── Formatters (exported for RunSummary) ──────────────────────────────────
export function fmtTime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
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

// ── GPS signal indicator (4 rising bars like a phone) ─────────────────────
function GpsSignal({ accuracy }: { accuracy: number | null }) {
  const bars = accuracy === null ? 0
    : accuracy < 5  ? 4
    : accuracy < 12 ? 3
    : accuracy < 25 ? 2
    : accuracy < 50 ? 1 : 0

  const color = bars >= 4 ? '#10b981' : bars >= 3 ? '#10b981' : bars >= 2 ? '#f59e0b' : bars >= 1 ? '#f97316' : '#ef4444'

  return (
    <div className="flex items-end gap-0.5">
      {[1, 2, 3, 4].map(b => (
        <div key={b} style={{
          width: 4,
          height: 3 + b * 3,
          borderRadius: 1,
          background: b <= bars ? color : 'rgba(255,255,255,0.18)',
        }} />
      ))}
      <span style={{ fontSize: 10, color, marginLeft: 4, fontWeight: 700, lineHeight: 1 }}>
        {accuracy === null ? 'GPS…' : `±${Math.round(accuracy)}m`}
      </span>
    </div>
  )
}

// ── Stop confirmation modal ───────────────────────────────────────────────
function StopConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
    >
      <div className="w-full max-w-sm rounded-3xl p-7 text-center"
        style={{ background: '#111', border: '1px solid #2a2a2a', boxShadow: '0 24px 80px rgba(0,0,0,0.8)' }}>
        <div className="text-5xl mb-4">🏁</div>
        <h3 className="text-xl font-black mb-2" style={{ color: '#fff' }}>Lauf beenden?</h3>
        <p className="text-sm mb-7" style={{ color: '#777', lineHeight: 1.6 }}>
          Willst du deinen Lauf wirklich beenden?<br />
          Deine Daten werden gespeichert.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-4 rounded-2xl font-bold text-sm"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
          >
            Weiter laufen
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-4 rounded-2xl font-bold text-sm"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444' }}
          >
            Jetzt beenden
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Stat cell ─────────────────────────────────────────────────────────────
function Stat({ label, value, sub, color = '#fff' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-3">
      <p style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1, letterSpacing: -0.5 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color, opacity: 0.6, fontWeight: 700, marginTop: 1 }}>{sub}</p>}
      <p style={{ fontSize: 9, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 3 }}>{label}</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────
interface Props {
  run: RunTrackerState & { pause: () => void; resume: () => void; finish: () => void }
}

export default function RunActiveScreen({ run }: Props) {
  const [showStop, setShowStop] = useState(false)
  const { status, elapsed, distance, currentPace, avgPace, calories, elevationGain, route, splits, gpsAccuracy, gpsError, kmMarkers } = run
  const isPaused = status === 'paused'

  const distDisplay = distance < 1
    ? { value: (distance * 1000).toFixed(0), unit: 'Meter' }
    : { value: distance.toFixed(2), unit: 'Kilometer' }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: '#000' }}>

      {/* ── Top bar: GPS signal + app name + pause badge ── */}
      <div className="flex items-center justify-between px-4"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 14px)',
          paddingBottom: 10,
          background: 'rgba(0,0,0,0.92)',
          backdropFilter: 'blur(12px)',
          zIndex: 10,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>

        <GpsSignal accuracy={gpsAccuracy} />

        <p style={{ color: '#fff', fontWeight: 900, fontSize: 15, letterSpacing: -0.3 }}>
          🏃 Kalorilo
        </p>

        {isPaused ? (
          <span className="px-3 py-1 rounded-full text-xs font-black"
            style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.35)' }}>
            Pausiert
          </span>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
            <span style={{ color: '#10b981', fontSize: 11, fontWeight: 700 }}>Live</span>
          </div>
        )}
      </div>

      {/* ── Live map (takes remaining height) ── */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>

        {/* GPS error banner */}
        {gpsError && (
          <div className="absolute top-3 left-3 right-3 z-10 rounded-2xl px-4 py-3 text-center text-sm font-bold"
            style={{ background: 'rgba(239,68,68,0.9)', color: '#fff' }}>
            ⚠ {gpsError}
          </div>
        )}

        {route.length > 0 ? (
          <RunMap route={route} kmMarkers={kmMarkers} style={{ width: '100%', height: '100%' }} />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-5"
            style={{ background: '#080808' }}>
            <div className="relative">
              <div className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(59,130,246,0.1)', border: '1.5px solid rgba(59,130,246,0.2)' }}>
                <span style={{ fontSize: 40 }}>📡</span>
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 animate-pulse
                flex items-center justify-center">
                <span style={{ fontSize: 10 }}>!</span>
              </div>
            </div>
            <div className="text-center">
              <p className="font-black text-base" style={{ color: '#ccc' }}>GPS wird gesucht…</p>
              <p className="text-sm mt-1" style={{ color: '#555' }}>Bitte ins Freie gehen</p>
            </div>
          </div>
        )}

        {/* Timer overlay – bottom of map, fading into dark panel */}
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-3 pt-8"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 60%, transparent 100%)' }}>
          <p className="font-black font-mono"
            style={{ fontSize: 72, lineHeight: 1, color: '#fff', letterSpacing: -3, textShadow: '0 0 40px rgba(0,0,0,0.8)' }}>
            {fmtTime(elapsed)}
          </p>
          <p style={{ fontSize: 11, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 }}>
            Zeit
          </p>
        </div>
      </div>

      {/* ── Stats panel ── */}
      <div style={{ background: '#0a0a0a' }}>

        {/* Main stats: 3 columns */}
        <div className="grid grid-cols-3" style={{ borderBottom: '1px solid #141414' }}>
          <div style={{ borderRight: '1px solid #141414' }}>
            <Stat label="Distanz" value={distDisplay.value} sub={distDisplay.unit} color="#10b981" />
          </div>
          <div style={{ borderRight: '1px solid #141414' }}>
            <Stat label="Pace /km" value={fmtPace(currentPace)} />
          </div>
          <div>
            <Stat label="Ø Pace /km" value={fmtPace(avgPace)} />
          </div>
        </div>

        {/* Secondary stats: 3 columns */}
        <div className="grid grid-cols-3" style={{ borderBottom: '1px solid #141414' }}>
          <div className="flex items-center justify-center gap-2 py-2.5"
            style={{ borderRight: '1px solid #141414' }}>
            <span style={{ fontSize: 16 }}>🔥</span>
            <div>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#f97316', lineHeight: 1 }}>{calories}</p>
              <p style={{ fontSize: 8, color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Kcal</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 py-2.5"
            style={{ borderRight: '1px solid #141414' }}>
            <span style={{ fontSize: 16 }}>⛰</span>
            <div>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#60a5fa', lineHeight: 1 }}>
                {elevationGain > 0 ? `+${elevationGain}m` : '–'}
              </p>
              <p style={{ fontSize: 8, color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Höhe</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 py-2.5">
            <span style={{ fontSize: 16 }}>📍</span>
            <div>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#a78bfa', lineHeight: 1 }}>{splits.length}</p>
              <p style={{ fontSize: 8, color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Splits</p>
            </div>
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex gap-3 px-4 pt-3"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 18px)' }}>
          {isPaused ? (
            <button
              onClick={run.resume}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl font-black"
              style={{ fontSize: 18, paddingTop: 18, paddingBottom: 18, background: 'rgba(16,185,129,0.15)', border: '1.5px solid rgba(16,185,129,0.4)', color: '#10b981' }}
            >
              <Play size={22} />Weiter
            </button>
          ) : (
            <button
              onClick={run.pause}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl font-black"
              style={{ fontSize: 18, paddingTop: 18, paddingBottom: 18, background: 'rgba(245,158,11,0.12)', border: '1.5px solid rgba(245,158,11,0.35)', color: '#f59e0b' }}
            >
              <Pause size={22} />Pause
            </button>
          )}

          <button
            onClick={() => setShowStop(true)}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl font-black"
            style={{ fontSize: 18, paddingTop: 18, paddingBottom: 18, background: 'rgba(239,68,68,0.12)', border: '1.5px solid rgba(239,68,68,0.35)', color: '#ef4444' }}
          >
            <Square size={22} />Beenden
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
