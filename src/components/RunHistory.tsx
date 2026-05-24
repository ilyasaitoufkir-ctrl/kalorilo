import { useMemo } from 'react'
import { Trash2, Trophy } from 'lucide-react'
import { useStore } from '../store/useStore'
import { fmtTime, fmtPace } from './RunActiveScreen'
import type { RunSession } from '../types'

function WeekBar({ sessions }: { sessions: RunSession[] }) {
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
  const now = new Date()
  // Monday = day 0
  const dayOfWeek = (now.getDay() + 6) % 7

  const weekDays = days.map((label, i) => {
    const d = new Date(now)
    d.setDate(now.getDate() - dayOfWeek + i)
    const dateStr = d.toISOString().split('T')[0]
    const ran = sessions.some(s => s.date === dateStr)
    const isToday = i === dayOfWeek
    return { label, ran, isToday }
  })

  return (
    <div className="flex gap-2 justify-between">
      {weekDays.map(({ label, ran, isToday }) => (
        <div key={label} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{
              background: ran ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
              border: isToday ? '1.5px solid rgba(245,158,11,0.4)' : ran ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.08)',
            }}>
            {ran ? <span style={{ fontSize: 14 }}>🏃</span>
              : <span style={{ width: 6, height: 6, borderRadius: '50%', background: isToday ? '#f59e0b' : '#333', display: 'block' }} />}
          </div>
          <p style={{ fontSize: 10, color: isToday ? '#f59e0b' : 'var(--text-3)', fontWeight: 700 }}>{label}</p>
        </div>
      ))}
    </div>
  )
}

export default function RunHistory() {
  const runSessions    = useStore(s => s.runSessions)
  const removeSession  = useStore(s => s.removeRunSession)

  const sorted = useMemo(() =>
    [...runSessions].sort((a, b) => b.startTime - a.startTime),
    [runSessions],
  )

  const thisWeek = useMemo(() => {
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (now.getDay() + 6) % 7)
    monday.setHours(0, 0, 0, 0)
    return sorted.filter(s => s.startTime >= monday.getTime())
  }, [sorted])

  const pb = useMemo(() => {
    if (sorted.length === 0) return null
    const withDist = sorted.filter(s => s.distance >= 0.5)
    return {
      longestRun:    Math.max(...sorted.map(s => s.distance)),
      bestPace:      withDist.length ? Math.min(...withDist.map(s => s.avgPace)) : 0,
      totalDistance: sorted.reduce((sum, s) => sum + s.distance, 0),
      totalRuns:     sorted.length,
      totalCalories: sorted.reduce((sum, s) => sum + s.caloriesBurned, 0),
    }
  }, [sorted])

  if (sorted.length === 0) {
    return (
      <div className="glass p-10 text-center">
        <p className="text-5xl mb-3">🏃</p>
        <p className="font-bold" style={{ color: 'var(--text-2)' }}>Noch keine Läufe</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Starte deinen ersten Lauf oben!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Weekly training plan */}
      <div className="glass p-4">
        <p className="font-bold text-sm mb-3" style={{ color: 'var(--text-1)' }}>Diese Woche</p>
        <WeekBar sessions={sorted} />
        {thisWeek.length > 0 && (
          <div className="mt-3 pt-3 flex gap-4 text-center" style={{ borderTop: '1px solid var(--glass-border)' }}>
            <div className="flex-1">
              <p style={{ color: '#10b981', fontSize: 18, fontWeight: 800 }}>
                {thisWeek.reduce((s, r) => s + r.distance, 0).toFixed(1)} km
              </p>
              <p style={{ color: 'var(--text-3)', fontSize: 11 }}>Distanz</p>
            </div>
            <div className="flex-1">
              <p style={{ color: '#10b981', fontSize: 18, fontWeight: 800 }}>{thisWeek.length}</p>
              <p style={{ color: 'var(--text-3)', fontSize: 11 }}>Läufe</p>
            </div>
            <div className="flex-1">
              <p style={{ color: '#10b981', fontSize: 18, fontWeight: 800 }}>
                {thisWeek.reduce((s, r) => s + r.caloriesBurned, 0)} kcal
              </p>
              <p style={{ color: 'var(--text-3)', fontSize: 11 }}>Kalorien</p>
            </div>
          </div>
        )}
      </div>

      {/* Personal bests */}
      {pb && (
        <div className="glass p-4"
          style={{ background: 'rgba(245,158,11,0.04)', borderColor: 'rgba(245,158,11,0.12)' }}>
          <p className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
            <Trophy size={16} style={{ color: '#f59e0b' }} /> Persönliche Bestleistungen
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Längster Lauf',   value: `${pb.longestRun.toFixed(2)} km` },
              { label: 'Beste Pace',      value: pb.bestPace ? `${fmtPace(pb.bestPace)} /km` : '–' },
              { label: 'Gesamt Distanz',  value: `${pb.totalDistance.toFixed(1)} km` },
              { label: 'Gesamt Kalorien', value: `${pb.totalCalories} kcal` },
            ].map(s => (
              <div key={s.label} className="glass p-3 text-center">
                <p style={{ color: 'var(--text-3)', fontSize: 11 }}>{s.label}</p>
                <p style={{ color: '#f59e0b', fontSize: 15, fontWeight: 800, marginTop: 2 }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All runs list */}
      <div className="glass overflow-hidden">
        <p className="px-4 py-3 text-xs font-bold uppercase tracking-wide"
          style={{ color: 'var(--text-3)', borderBottom: '1px solid var(--glass-border)' }}>
          Alle Läufe ({sorted.length})
        </p>
        {sorted.map((run, i) => (
          <div key={run.id}
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderTop: i > 0 ? '1px solid var(--glass-border)' : 'none' }}>
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(16,185,129,0.1)' }}>
              <span className="text-xl">🏃</span>
            </div>
            <div className="flex-1" style={{ minWidth: 0 }}>
              <p className="font-black text-sm" style={{ color: 'var(--text-1)' }}>
                {run.distance.toFixed(2)} km
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                {run.date} · {fmtTime(run.duration)} · {fmtPace(run.avgPace)}/km
              </p>
            </div>
            <p className="text-sm font-black flex-shrink-0 mr-2" style={{ color: '#10b981' }}>
              {run.caloriesBurned} kcal
            </p>
            <button onClick={() => removeSession(run.id)} className="glass-press p-1.5 flex-shrink-0">
              <Trash2 size={14} style={{ color: 'var(--text-3)' }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
