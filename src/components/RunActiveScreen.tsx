import { Pause, Play, Square, MapPin } from 'lucide-react'
import type { RunTrackerState } from '../hooks/useRunTracker'
import RunMap from './RunMap'

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

interface Props {
  run: RunTrackerState & {
    pause: () => void
    resume: () => void
    finish: () => void
  }
}

export default function RunActiveScreen({ run }: Props) {
  const { status, elapsed, distance, currentPace, avgPace, calories, elevationGain, route } = run

  const distLabel = distance < 1
    ? `${Math.round(distance * 1000)} m`
    : `${distance.toFixed(2)} km`

  const stats = [
    { label: 'Distanz',   value: distLabel },
    { label: 'Pace',      value: fmtPace(currentPace) + ' /km' },
    { label: 'Ø Pace',    value: fmtPace(avgPace) + ' /km' },
    { label: 'Kalorien',  value: `${calories} kcal` },
  ]

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: '#000' }}>

      {/* ── Map area (takes all remaining height) ── */}
      <div className="flex-1 relative overflow-hidden">
        {route.length > 0 ? (
          <RunMap route={route} style={{ width: '100%', height: '100%' }} />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3"
            style={{ background: '#0a0a0a' }}>
            <MapPin size={40} style={{ color: '#10b981' }} className="animate-bounce" />
            <p className="font-bold" style={{ color: 'var(--text-2)' }}>GPS wird gesucht…</p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>Bitte ins Freie gehen</p>
          </div>
        )}

        {/* Timer overlay – top of map */}
        <div className="absolute top-0 left-0 right-0 flex flex-col items-center"
          style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)',
            paddingTop: 'max(env(safe-area-inset-top), 20px)',
            paddingBottom: 32,
          }}>
          <p className="font-black font-mono leading-none"
            style={{ fontSize: 80, color: '#fff', textShadow: '0 2px 24px rgba(0,0,0,0.6)', letterSpacing: -2 }}>
            {fmtTime(elapsed)}
          </p>
          {status === 'paused' && (
            <span className="mt-2 px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
              Pausiert
            </span>
          )}
          {elevationGain > 5 && (
            <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
              ↑ {elevationGain} m
            </p>
          )}
        </div>
      </div>

      {/* ── Bottom panel ── */}
      <div style={{ background: '#0d0d0d', borderTop: '1px solid #1f1f1f' }}>

        {/* Stats row */}
        <div className="grid grid-cols-4" style={{ borderBottom: '1px solid #1a1a1a' }}>
          {stats.map((s, i) => (
            <div key={s.label}
              className="py-3 flex flex-col items-center"
              style={{ borderLeft: i > 0 ? '1px solid #1a1a1a' : 'none' }}>
              <p style={{ color: 'var(--text-3)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
                {s.label}
              </p>
              <p style={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Control buttons */}
        <div className="flex gap-3 px-5 pt-4"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}>
          <button
            onClick={status === 'running' ? run.pause : run.resume}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl font-bold text-base"
            style={{
              paddingTop: 16, paddingBottom: 16,
              background: status === 'running' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
              border: `1.5px solid ${status === 'running' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`,
              color: status === 'running' ? '#f59e0b' : '#10b981',
            }}>
            {status === 'running'
              ? <><Pause size={20} />Pause</>
              : <><Play size={20} />Weiter</>}
          </button>

          <button
            onClick={run.finish}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl font-bold text-base"
            style={{
              paddingTop: 16, paddingBottom: 16,
              background: 'rgba(239,68,68,0.12)',
              border: '1.5px solid rgba(239,68,68,0.3)',
              color: '#ef4444',
            }}>
            <Square size={20} />Stopp
          </button>
        </div>
      </div>
    </div>
  )
}
