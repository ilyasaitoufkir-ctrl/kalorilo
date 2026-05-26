import { useMemo } from 'react'
import { Trash2, Trophy, TrendingUp } from 'lucide-react'
import { useStore } from '../store/useStore'
import { fmtTime, fmtPace } from './RunActiveScreen'
import type { RunSession, GeoPoint } from '../types'

// ── SVG mini route ─────────────────────────────────────────────────────────────

function MiniRoute({ route, size = 56 }: { route: GeoPoint[]; size?: number }) {
  if (route.length < 2) {
    return (
      <div style={{ width: size, height: size, borderRadius: 14, background: '#0a0a0a',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 20 }}>🏃</span>
      </div>
    )
  }

  const lats = route.map((p) => p.lat)
  const lngs = route.map((p) => p.lng)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const latRange = maxLat - minLat || 0.0001
  const lngRange = maxLng - minLng || 0.0001

  const pad  = 5
  const iw   = size - pad * 2
  const ih   = size - pad * 2

  const step = Math.max(1, Math.floor(route.length / 80))
  const pts  = route.filter((_, i) => i % step === 0 || i === route.length - 1)

  const toXY = (p: GeoPoint) => ({
    x: pad + ((p.lng - minLng) / lngRange) * iw,
    y: pad + ih - ((p.lat - minLat) / latRange) * ih,
  })

  const polyPoints = pts.map((p) => {
    const { x, y } = toXY(p)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const start = toXY(route[0])
  const end   = toXY(route[route.length - 1])

  return (
    <svg width={size} height={size}
      style={{ display: 'block', flexShrink: 0, borderRadius: 14, background: '#0a0a0a' }}>
      <polyline
        points={polyPoints}
        fill="none"
        stroke="#f59e0b"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
      <circle cx={start.x} cy={start.y} r="2" fill="#10b981" />
      <circle cx={end.x}   cy={end.y}   r="2" fill="#ef4444" />
    </svg>
  )
}

// ── Weekly training dots ───────────────────────────────────────────────────────

function WeekBar({ sessions }: { sessions: RunSession[] }) {
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
  const now  = new Date()
  const dayOfWeek = (now.getDay() + 6) % 7

  const weekDays = days.map((label, i) => {
    const d = new Date(now)
    d.setDate(now.getDate() - dayOfWeek + i)
    const dateStr = d.toISOString().split('T')[0]
    const ran     = sessions.some((s) => s.date === dateStr)
    const isToday = i === dayOfWeek
    return { label, ran, isToday }
  })

  return (
    <div className="flex gap-2 justify-between">
      {weekDays.map(({ label, ran, isToday }) => (
        <div key={label} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center"
            style={{
              background: ran ? 'rgba(74,140,92,0.1)' : 'rgba(74,140,92,0.06)',
              border: isToday
                ? '1.5px solid rgba(245,158,11,0.5)'
                : ran ? '1px solid rgba(74,140,92,0.22)' : '1px solid rgba(255,255,255,0.07)',
            }}>
            {ran
              ? <span style={{ fontSize: 16 }}>🏃</span>
              : <span style={{ width: 6, height: 6, borderRadius: '50%',
                  background: isToday ? '#4a8c5c' : '#222', display: 'block' }} />}
          </div>
          <p style={{ fontSize: 10, fontWeight: 700,
            color: isToday ? '#4a8c5c' : ran ? '#888' : 'var(--text-3)' }}>{label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Monthly stats ──────────────────────────────────────────────────────────────

function MonthStats({ sessions }: { sessions: RunSession[] }) {
  const now   = new Date()
  const month = now.getMonth()
  const year  = now.getFullYear()

  const thisMonth = sessions.filter((s) => {
    const d = new Date(s.startTime)
    return d.getMonth() === month && d.getFullYear() === year
  })

  if (thisMonth.length === 0) return null

  const totalDist = thisMonth.reduce((s, r) => s + r.distance, 0)
  const totalCal  = thisMonth.reduce((s, r) => s + r.caloriesBurned, 0)
  const totalTime = thisMonth.reduce((s, r) => s + r.duration, 0)

  return (
    <div className="glass p-4">
      <p className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
        <TrendingUp size={15} style={{ color: '#4a8c5c', flexShrink: 0 }} />
        {now.toLocaleString('de-DE', { month: 'long' })} – Monatsübersicht
      </p>
      <div className="grid grid-cols-4 gap-2">
        {[
          { val: thisMonth.length.toString(), unit: 'Läufe',    color: '#4a8c5c' },
          { val: totalDist.toFixed(1),         unit: 'km',       color: '#10b981' },
          { val: fmtTime(totalTime),           unit: 'Zeit',     color: '#60a5fa' },
          { val: totalCal.toString(),          unit: 'kcal',     color: '#f97316' },
        ].map((item) => (
          <div key={item.unit} className="rounded-2xl py-2.5 text-center"
            style={{ background: '#0a0a0a', border: '1px solid rgba(125,184,138,0.15)' }}>
            <p style={{ fontSize: 16, fontWeight: 900, color: item.color, lineHeight: 1 }}>{item.val}</p>
            <p style={{ fontSize: 9, color: '#444', fontWeight: 700, marginTop: 2 }}>{item.unit}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main RunHistory ────────────────────────────────────────────────────────────

export default function RunHistory() {
  const runSessions   = useStore((s) => s.runSessions)
  const removeSession = useStore((s) => s.removeRunSession)

  const sorted = useMemo(
    () => [...runSessions].sort((a, b) => b.startTime - a.startTime),
    [runSessions],
  )

  const thisWeek = useMemo(() => {
    const now    = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (now.getDay() + 6) % 7)
    monday.setHours(0, 0, 0, 0)
    return sorted.filter((s) => s.startTime >= monday.getTime())
  }, [sorted])

  const pb = useMemo(() => {
    if (sorted.length === 0) return null
    const withDist = sorted.filter((s) => s.distance >= 0.5)
    return {
      longestRun:    Math.max(...sorted.map((s) => s.distance)),
      bestPace:      withDist.length ? Math.min(...withDist.map((s) => s.avgPace)) : 0,
      totalDistance: sorted.reduce((sum, s) => sum + s.distance, 0),
      totalRuns:     sorted.length,
      totalCalories: sorted.reduce((sum, s) => sum + s.caloriesBurned, 0),
    }
  }, [sorted])

  if (sorted.length === 0) {
    return (
      <div className="glass p-12 text-center">
        <p style={{ fontSize: 52, marginBottom: 12 }}>🏃</p>
        <p className="font-bold text-base" style={{ color: 'var(--text-2)' }}>Noch keine Läufe</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Starte deinen ersten Lauf oben!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Monthly stats */}
      <MonthStats sessions={sorted} />

      {/* Weekly training bar */}
      <div className="glass p-4">
        <p className="font-bold text-sm mb-3" style={{ color: 'var(--text-1)' }}>Diese Woche</p>
        <WeekBar sessions={sorted} />
        {thisWeek.length > 0 && (
          <div className="mt-3 pt-3 grid grid-cols-3 gap-2 text-center"
            style={{ borderTop: '1px solid var(--glass-border)' }}>
            {[
              { val: `${thisWeek.reduce((s, r) => s + r.distance, 0).toFixed(1)} km`, label: 'Distanz', color: '#4a8c5c' },
              { val: thisWeek.length.toString(),                                        label: 'Läufe',    color: '#10b981' },
              { val: `${thisWeek.reduce((s, r) => s + r.caloriesBurned, 0)} kcal`,    label: 'Kalorien', color: '#f97316' },
            ].map((item) => (
              <div key={item.label}>
                <p style={{ color: item.color, fontSize: 18, fontWeight: 800 }}>{item.val}</p>
                <p style={{ color: 'var(--text-3)', fontSize: 11 }}>{item.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Personal bests */}
      {pb && (
        <div className="glass p-4"
          style={{ background: 'rgba(74,140,92,0.04)', borderColor: 'rgba(74,140,92,0.1)' }}>
          <p className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
            <Trophy size={15} style={{ color: '#4a8c5c', flexShrink: 0 }} /> Persönliche Bestleistungen
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Längster Lauf',    value: `${pb.longestRun.toFixed(2)} km`,                      color: '#4a8c5c' },
              { label: 'Beste Pace',       value: pb.bestPace ? `${fmtPace(pb.bestPace)} /km` : '–',     color: '#10b981' },
              { label: 'Gesamt Distanz',   value: `${pb.totalDistance.toFixed(1)} km`,                   color: '#60a5fa' },
              { label: 'Gesamt Kalorien',  value: `${pb.totalCalories} kcal`,                            color: '#f97316' },
            ].map((s) => (
              <div key={s.label} className="glass p-3 text-center">
                <p style={{ color: 'var(--text-3)', fontSize: 11 }}>{s.label}</p>
                <p style={{ color: s.color, fontSize: 15, fontWeight: 800, marginTop: 2 }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All runs list */}
      <div className="space-y-2.5">
        <p className="label px-1">Alle Läufe ({sorted.length})</p>
        {sorted.map((run) => {
          const runDate  = new Date(run.startTime)
          const dateStr  = runDate.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
          const timeStr  = runDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
          const isPb     = pb && run.distance >= 0.5 && run.avgPace === pb.bestPace

          return (
            <div key={run.id} className="glass overflow-hidden"
              style={isPb ? { borderColor: 'rgba(74,140,92,0.22)', background: 'rgba(245,158,11,0.03)' } : {}}>
              <div className="flex items-center gap-3 p-4">
                {/* Mini route SVG */}
                <MiniRoute route={run.route} size={56} />

                {/* Info */}
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-black text-base" style={{ color: 'var(--text-1)' }}>
                      {run.distance.toFixed(2)} km
                    </p>
                    {isPb && (
                      <span style={{ fontSize: 9, fontWeight: 800, color: '#4a8c5c',
                        background: 'rgba(74,140,92,0.1)', border: '1px solid rgba(74,140,92,0.22)',
                        padding: '1px 6px', borderRadius: 8 }}>🏆 PB</span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                    {fmtTime(run.duration)} · {fmtPace(run.avgPace)}/km · {dateStr} {timeStr}
                  </p>
                  {/* Mini stats */}
                  <div className="flex gap-3 mt-1.5">
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#f97316' }}>🔥 {run.caloriesBurned} kcal</span>
                    {run.splits.length > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>📍 {run.splits.length} splits</span>
                    )}
                    {run.elevationGain > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>⛰ +{run.elevationGain}m</span>
                    )}
                  </div>
                </div>

                <button onClick={() => removeSession(run.id)}
                  className="glass-press p-2 flex-shrink-0">
                  <Trash2 size={15} style={{ color: 'var(--text-3)' }} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
