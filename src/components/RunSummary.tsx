import { useMemo } from 'react'
import { PaceBarChart } from './MiniChart'
import { Share2, Trophy, Zap } from 'lucide-react'
import { fmtTime, fmtPace } from './RunActiveScreen'
import RunMap from './RunMap'
import { useStore } from '../store/useStore'
import type { RunSession } from '../types'
import toast from 'react-hot-toast'

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  session: RunSession
  onSave: (session: RunSession) => void
  onDiscard: () => void
}

export default function RunSummary({ session, onSave, onDiscard }: Props) {
  const runSessions = useStore((s) => s.runSessions)
  const whoopData   = useStore((s) => s.whoopData)

  // Previous bests (all runs BEFORE this one)
  const prevRuns = useMemo(
    () => runSessions.filter((r) => r.id !== session.id && r.distance >= 0.5),
    [runSessions, session.id],
  )

  const pb = useMemo(() => {
    if (prevRuns.length === 0) return null
    return {
      bestPace:    Math.min(...prevRuns.map((r) => r.avgPace)),
      longestRun:  Math.max(...prevRuns.map((r) => r.distance)),
    }
  }, [prevRuns])

  const isNewPaceRecord  = pb && session.distance >= 0.5 && session.avgPace < pb.bestPace
  const isNewDistRecord  = pb && session.distance > pb.longestRun

  const bestSplit  = session.splits.length > 0 ? Math.min(...session.splits.map((s) => s.pace)) : 0
  const worstSplit = session.splits.length > 0 ? Math.max(...session.splits.map((s) => s.pace)) : 0
  const avgPaceMin = session.avgPace / 60

  const chartData = session.splits.map((split) => ({
    name:    `${split.km}`,
    paceMin: Math.round((split.pace / 60) * 100) / 100,
    paceStr: fmtPace(split.pace),
    isBest:  split.pace === bestSplit,
    isWorst: split.pace === worstSplit && session.splits.length > 1,
  }))

  const dateFormatted = new Date(session.startTime).toLocaleDateString('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const timeFormatted = new Date(session.startTime).toLocaleTimeString('de-DE', {
    hour: '2-digit', minute: '2-digit',
  })

  const handleShare = async () => {
    const text = `🏃 ${session.distance.toFixed(2)} km in ${fmtTime(session.duration)} · ${fmtPace(session.avgPace)}/km · ${session.caloriesBurned} kcal 🔥 – via Kalorilo`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Mein Lauf – Kalorilo', text })
      } else {
        await navigator.clipboard.writeText(text)
        toast.success('In Zwischenablage kopiert!')
      }
    } catch { /* cancelled */ }
  }

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto" style={{ background: 'var(--bg)' }}>

      {/* ── Hero header ── */}
      <div className="relative overflow-hidden text-center pb-6"
        style={{ background: 'var(--bg)', paddingTop: 'max(env(safe-area-inset-top), 24px)', borderBottom: '1px solid rgba(125,184,138,0.15)' }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(74,140,92,0.08), transparent 65%)' }} />

        <div className="relative">
          {/* Trophy */}
          <div className="flex items-center justify-center mb-4">
            <div style={{ width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(74,140,92,0.18), rgba(217,119,6,0.1))',
              border: '2px solid rgba(74,140,92,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 40 }}>
                {isNewPaceRecord || isNewDistRecord ? '🏆' : '🏅'}
              </span>
            </div>
          </div>

          <h2 className="text-2xl font-black mb-1" style={{ color: '#fff' }}>Lauf abgeschlossen!</h2>
          <p style={{ fontSize: 13, color: '#555' }}>{dateFormatted} · {timeFormatted} Uhr</p>

          {/* New records banners */}
          {(isNewPaceRecord || isNewDistRecord) && (
            <div className="flex gap-2 justify-center mt-3 px-4">
              {isNewPaceRecord && (
                <span className="px-3 py-1.5 rounded-2xl text-xs font-black"
                  style={{ background: 'rgba(74,140,92,0.15)', border: '1px solid rgba(74,140,92,0.3)', color: '#4a8c5c' }}>
                  🏆 Neue Bestpace!
                </span>
              )}
              {isNewDistRecord && (
                <span className="px-3 py-1.5 rounded-2xl text-xs font-black"
                  style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}>
                  📍 Längster Lauf!
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 40px)' }}>

        {/* ── Distance hero ── */}
        <div className="glass p-6 text-center relative overflow-hidden"
          style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(74,140,92,0.18)' }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 50% 120%, rgba(245,158,11,0.07), transparent 55%)' }} />
          <p className="label mb-2 relative">Gesamtdistanz</p>
          <p className="font-black leading-none relative" style={{ fontSize: 88, color: '#4a8c5c', letterSpacing: -5 }}>
            {session.distance.toFixed(2)}
          </p>
          <p className="text-2xl font-bold mt-1 relative" style={{ color: 'rgba(245,158,11,0.5)' }}>km</p>
        </div>

        {/* ── Stats 2×3 grid ── */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '⏱', label: 'Gesamtzeit',  value: fmtTime(session.duration),              color: '#fff' },
            { icon: '⚡', label: 'Ø Pace',       value: `${fmtPace(session.avgPace)} /km`,      color: '#fff' },
            { icon: '🏅', label: 'Beste Pace',   value: `${fmtPace(bestSplit)} /km`,            color: '#4a8c5c' },
            { icon: '🔥', label: 'Kalorien',     value: `${session.caloriesBurned} kcal`,        color: '#f97316' },
            { icon: '⛰',  label: 'Höhenmeter',  value: `+${session.elevationGain} m`,          color: '#60a5fa' },
            { icon: '📍', label: 'Splits',       value: `${session.splits.length} km`,           color: '#a78bfa' },
          ].map((s) => (
            <div key={s.label} className="glass p-4 flex items-center gap-3">
              <span style={{ fontSize: 26, flexShrink: 0 }}>{s.icon}</span>
              <div>
                <p className="label">{s.label}</p>
                <p className="font-black text-base mt-0.5" style={{ color: s.color }}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Whoop HR (if connected & data available) ── */}
        {whoopData && (
          <div className="glass p-4 flex items-center gap-4"
            style={{ background: '#0a0a0a', borderColor: '#1e1e1e' }}>
            <span style={{ fontSize: 26 }}>⌚</span>
            <div className="flex-1">
              <p className="label">Whoop Recovery (Lauftag)</p>
              <p className="font-black text-base mt-0.5"
                style={{ color: whoopData.recovery > 66 ? '#10b981' : whoopData.recovery > 33 ? '#4a8c5c' : '#ef4444' }}>
                {whoopData.recovery}% Recovery
              </p>
            </div>
            <div className="text-right">
              <p className="label">HRV</p>
              <p className="font-black text-base mt-0.5" style={{ color: '#60a5fa' }}>{whoopData.hrv} ms</p>
            </div>
          </div>
        )}

        {/* ── PB comparison ── */}
        {pb && (
          <div className="glass p-4" style={{ background: 'rgba(74,140,92,0.04)', borderColor: 'rgba(74,140,92,0.1)' }}>
            <p className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
              <Trophy size={15} style={{ color: '#4a8c5c', flexShrink: 0 }} /> Vergleich zu deinen Bestleistungen
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  label: 'Ø Pace',
                  current: fmtPace(session.avgPace),
                  best: fmtPace(pb.bestPace),
                  better: session.avgPace < pb.bestPace,
                },
                {
                  label: 'Distanz',
                  current: `${session.distance.toFixed(2)} km`,
                  best: `${pb.longestRun.toFixed(2)} km`,
                  better: session.distance > pb.longestRun,
                },
              ].map((item) => (
                <div key={item.label} className="glass p-3 text-center">
                  <p className="label mb-1">{item.label}</p>
                  <p style={{ fontSize: 18, fontWeight: 900, color: item.better ? '#10b981' : 'var(--text-1)' }}>
                    {item.current}
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <span style={{ fontSize: 9, color: 'var(--text-3)' }}>Bestzeit:</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#4a8c5c' }}>{item.best}</span>
                  </div>
                  {item.better && <p style={{ fontSize: 9, color: '#10b981', fontWeight: 700, marginTop: 2 }}>🏆 Neuer Rekord!</p>}
                </div>
              ))}
            </div>
          </div>
        )}
        {prevRuns.length === 0 && (
          <div className="glass p-4 text-center"
            style={{ background: 'rgba(74,140,92,0.04)', borderColor: 'rgba(74,140,92,0.08)' }}>
            <Zap size={18} style={{ color: '#4a8c5c', margin: '0 auto 6px' }} />
            <p style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>Das ist dein erster Lauf! 🎉</p>
          </div>
        )}

        {/* ── Route map ── */}
        {session.route.length > 1 && (
          <div className="glass overflow-hidden" style={{ borderRadius: 20 }}>
            <div className="flex items-center gap-3 px-4 pt-4 pb-2">
              <p className="font-bold text-sm flex-1" style={{ color: 'var(--text-2)' }}>📍 Deine Route</p>
            </div>
            <RunMap
              route={session.route}
              kmMarkers={session.kmMarkers}
              showFullRoute
              style={{ width: '100%', height: 260 }}
            />
          </div>
        )}

        {/* ── Pace bar chart per km ── */}
        {chartData.length > 0 && (
          <div className="glass p-4">
            <p className="font-bold text-sm mb-1" style={{ color: 'var(--text-1)' }}>⚡ Pace pro Kilometer</p>
            <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>
              🥇 Gold = schnellster · 🔴 Rot = langsamster · Linie = Ø Pace
            </p>
            <PaceBarChart data={chartData} avgPaceMin={avgPaceMin} />
          </div>
        )}

        {/* ── Splits table ── */}
        {session.splits.length > 0 && (
          <div className="glass overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--glass-border)' }}>
              <p className="font-bold text-sm" style={{ color: 'var(--text-2)' }}>Kilometer-Splits</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>🥇 schnellster km</p>
            </div>
            {session.splits.map((split, i) => {
              const isBest  = split.pace === bestSplit
              const isWorst = split.pace === worstSplit && session.splits.length > 1
              return (
                <div key={split.km} className="flex items-center px-4 py-3.5"
                  style={{ borderTop: i > 0 ? '1px solid var(--glass-border)' : 'none',
                    background: isBest ? 'rgba(74,140,92,0.04)' : 'transparent' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mr-3"
                    style={{ background: isBest ? 'rgba(74,140,92,0.15)' : 'rgba(59,130,246,0.1)' }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: isBest ? '#4a8c5c' : '#60a5fa' }}>{split.km}</span>
                  </div>
                  <p className="flex-1 text-sm font-bold" style={{ color: 'var(--text-1)' }}>km {split.km}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-black"
                      style={{ color: isBest ? '#4a8c5c' : isWorst ? '#ef4444' : 'var(--text-2)' }}>
                      {fmtPace(split.pace)}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>/km</p>
                    {isBest  && <span style={{ fontSize: 14 }}>🥇</span>}
                    {isWorst && <span style={{ fontSize: 14 }}>🔴</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Action buttons ── */}
        <div className="flex gap-3">
          <button onClick={handleShare}
            className="flex items-center justify-center gap-2 rounded-2xl font-bold text-sm px-4 glass-press"
            style={{ height: 56, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa', flexShrink: 0 }}>
            <Share2 size={17} />
          </button>
          <button
            onClick={onDiscard}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl font-bold text-sm glass-press"
            style={{ height: 56, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}
          >
            ❌ Nicht speichern
          </button>
          <button
            onClick={() => onSave(session)}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl font-black text-sm glass-press"
            style={{ height: 56, background: 'linear-gradient(135deg,#7db88a,#4a8c5c)', color: '#fff', border: 'none', boxShadow: '0 4px 16px rgba(74,140,92,0.3)' }}
          >
            ✅ Speichern
          </button>
        </div>
      </div>
    </div>
  )
}
