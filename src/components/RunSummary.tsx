import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Share2 } from 'lucide-react'
import { fmtTime, fmtPace } from './RunActiveScreen'
import RunMap from './RunMap'
import type { RunSession } from '../types'
import toast from 'react-hot-toast'

interface Props {
  session: RunSession
  onDone: () => void
}

export default function RunSummary({ session, onDone }: Props) {
  const bestPace  = session.splits.length > 0 ? Math.min(...session.splits.map(s => s.pace)) : 0
  const worstPace = session.splits.length > 0 ? Math.max(...session.splits.map(s => s.pace)) : 0

  const chartData = session.splits.map(split => ({
    name: `${split.km}`,
    paceMin: Math.round((split.pace / 60) * 100) / 100,
    paceStr: fmtPace(split.pace),
    isBest:  split.pace === bestPace,
    isWorst: split.pace === worstPace && session.splits.length > 1,
  }))

  const handleShare = async () => {
    const text = `🏃 ${session.distance.toFixed(2)} km in ${fmtTime(session.duration)} (${fmtPace(session.avgPace)}/km) · ${session.caloriesBurned} kcal 🔥 – Kalorilo`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Mein Lauf – Kalorilo', text })
      } else {
        await navigator.clipboard.writeText(text)
        toast.success('In Zwischenablage kopiert!')
      }
    } catch { /* user cancelled */ }
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto" style={{ background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <div className="px-5 pb-5 text-center relative overflow-hidden"
        style={{ background: '#000', borderBottom: '1px solid #1a1a1a', paddingTop: 'max(env(safe-area-inset-top), 24px)' }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(16,185,129,0.12), transparent 70%)' }} />
        <div className="relative">
          <div className="w-18 h-18 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ width: 72, height: 72, background: 'rgba(16,185,129,0.1)', border: '2px solid rgba(16,185,129,0.25)' }}>
            <span style={{ fontSize: 36 }}>🏆</span>
          </div>
          <h2 className="text-2xl font-black" style={{ color: '#fff' }}>Lauf abgeschlossen!</h2>
          <p className="text-sm mt-1" style={{ color: '#555' }}>{session.date}</p>
        </div>
      </div>

      <div className="px-4 pt-4 pb-12 space-y-4">

        {/* Hero: distance */}
        <div className="glass p-6 text-center relative overflow-hidden"
          style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.2)' }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 50% 120%, rgba(16,185,129,0.08), transparent 60%)' }} />
          <p className="label mb-2 relative">Gesamtdistanz</p>
          <p className="font-black leading-none relative"
            style={{ fontSize: 80, color: '#10b981', letterSpacing: -4 }}>
            {session.distance.toFixed(2)}
          </p>
          <p className="text-2xl font-bold mt-1 relative" style={{ color: 'rgba(16,185,129,0.6)' }}>km</p>
        </div>

        {/* Key stats 2×2 grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '⏱', label: 'Gesamtzeit',   value: fmtTime(session.duration),              color: '#fff' },
            { icon: '⚡', label: 'Ø Pace',        value: fmtPace(session.avgPace) + ' /km',      color: '#fff' },
            { icon: '🏅', label: 'Beste Pace',    value: fmtPace(bestPace) + ' /km',             color: '#f59e0b' },
            { icon: '🔥', label: 'Kalorien',      value: `${session.caloriesBurned} kcal`,        color: '#f97316' },
            { icon: '⛰',  label: 'Höhenmeter',   value: `+${session.elevationGain} m`,          color: '#60a5fa' },
            { icon: '📍', label: 'Splits',        value: `${session.splits.length} km`,           color: '#a78bfa' },
          ].map(s => (
            <div key={s.label} className="glass p-4 flex items-center gap-3">
              <span style={{ fontSize: 24, flexShrink: 0 }}>{s.icon}</span>
              <div>
                <p className="label">{s.label}</p>
                <p className="font-black text-base mt-0.5" style={{ color: s.color }}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Route map */}
        {session.route.length > 1 && (
          <div className="glass overflow-hidden" style={{ borderRadius: 20 }}>
            <p className="px-4 pt-4 pb-2 font-bold text-sm" style={{ color: 'var(--text-2)' }}>📍 Route</p>
            <RunMap
              route={session.route}
              kmMarkers={session.kmMarkers}
              showFullRoute
              style={{ width: '100%', height: 260 }}
            />
          </div>
        )}

        {/* Pace bar chart per km */}
        {chartData.length > 0 && (
          <div className="glass p-4">
            <p className="font-bold text-sm mb-1" style={{ color: 'var(--text-1)' }}>⚡ Pace pro Kilometer</p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>
              🏅 Gold = beste km · Rot = langsamste km
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="20%">
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#555', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'km', position: 'insideBottomRight', offset: 0, fill: '#444', fontSize: 10 }}
                />
                <YAxis domain={['auto', 'auto']} tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  contentStyle={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 12 }}
                  labelStyle={{ color: '#888', fontSize: 11 }}
                  formatter={(_val: unknown, _name: unknown, props: any) => [
                    (props?.payload?.paceStr ?? '') + ' min/km', 'Pace',
                  ]}
                />
                <Bar dataKey="paceMin" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.isBest ? '#f59e0b' : entry.isWorst ? '#ef4444' : '#3b82f6'}
                      opacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Splits table */}
        {session.splits.length > 0 && (
          <div className="glass overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--glass-border)' }}>
              <p className="font-bold text-sm" style={{ color: 'var(--text-2)' }}>Kilometer-Splits</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>🏅 schnellster</p>
            </div>
            {session.splits.map((split, i) => {
              const isBest  = split.pace === bestPace
              const isWorst = split.pace === worstPace && session.splits.length > 1
              return (
                <div key={split.km}
                  className="flex items-center px-4 py-3.5"
                  style={{ borderTop: i > 0 ? '1px solid var(--glass-border)' : 'none', background: isBest ? 'rgba(245,158,11,0.04)' : 'transparent' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mr-3"
                    style={{ background: isBest ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.1)' }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: isBest ? '#f59e0b' : '#60a5fa' }}>{split.km}</span>
                  </div>
                  <p className="flex-1 text-sm font-bold" style={{ color: 'var(--text-1)' }}>
                    km {split.km}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-black" style={{ color: isBest ? '#f59e0b' : isWorst ? '#ef4444' : 'var(--text-2)' }}>
                      {fmtPace(split.pace)}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>/km</p>
                    {isBest  && <span style={{ fontSize: 14 }}>🏅</span>}
                    {isWorst && <span style={{ fontSize: 14 }}>🔴</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 rounded-2xl font-bold text-sm px-5"
            style={{ height: 54, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa', flexShrink: 0 }}
          >
            <Share2 size={18} />Teilen
          </button>
          <button onClick={onDone} className="btn-gold flex-1 py-4 text-base" style={{ minHeight: 54 }}>
            Fertig
          </button>
        </div>
      </div>
    </div>
  )
}
