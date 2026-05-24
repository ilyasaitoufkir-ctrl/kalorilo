import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { CheckCircle } from 'lucide-react'
import { fmtTime, fmtPace } from './RunActiveScreen'
import RunMap from './RunMap'
import type { RunSession } from '../types'

interface Props {
  session: RunSession
  onDone: () => void
}

export default function RunSummary({ session, onDone }: Props) {
  const bestPace = session.splits.length > 0
    ? Math.min(...session.splits.map(s => s.pace))
    : session.avgPace

  const paceData = session.splits.map(split => ({
    name: `${split.km} km`,
    // decimal minutes for chart axis (e.g. 5.5 = 5:30)
    paceMin: Math.round(split.pace / 60 * 100) / 100,
    paceStr: fmtPace(split.pace),
  }))

  const stats = [
    { icon: '⏱', label: 'Gesamtzeit',    value: fmtTime(session.duration) },
    { icon: '⚡', label: 'Ø Pace',        value: fmtPace(session.avgPace) + ' /km' },
    { icon: '🏅', label: 'Beste Pace',    value: fmtPace(bestPace) + ' /km' },
    { icon: '⛰',  label: 'Höhenmeter',   value: `${session.elevationGain} m` },
    { icon: '🔥', label: 'Kalorien',      value: `${session.caloriesBurned} kcal` },
    { icon: '📊', label: 'Splits',        value: `${session.splits.length} km` },
  ]

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto" style={{ background: 'var(--bg)' }}>

      {/* Header */}
      <div className="pt-safe px-5 pb-5 text-center"
        style={{ background: '#000', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: 'rgba(16,185,129,0.1)', border: '2px solid rgba(16,185,129,0.2)' }}>
            <CheckCircle size={32} style={{ color: '#10b981' }} />
          </div>
          <h2 className="text-2xl font-black" style={{ color: 'var(--text-1)' }}>Lauf abgeschlossen!</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>{session.date}</p>
        </div>
      </div>

      <div className="px-4 pt-4 pb-10 space-y-4">

        {/* Hero distance */}
        <div className="glass p-6 text-center"
          style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.2)' }}>
          <p className="label mb-2">Gesamtdistanz</p>
          <p className="font-black leading-none" style={{ fontSize: 72, color: '#10b981' }}>
            {session.distance.toFixed(2)}
          </p>
          <p className="text-xl font-semibold mt-1" style={{ color: 'var(--text-2)' }}>km</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map(s => (
            <div key={s.label} className="glass p-4 flex flex-col items-center text-center gap-1">
              <span className="text-2xl">{s.icon}</span>
              <p className="label">{s.label}</p>
              <p className="text-lg font-black" style={{ color: 'var(--text-1)' }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Route map */}
        {session.route.length > 1 && (
          <div className="glass overflow-hidden" style={{ borderRadius: 20 }}>
            <p className="px-4 pt-4 pb-2 font-bold text-sm" style={{ color: 'var(--text-2)' }}>
              📍 Route
            </p>
            <RunMap
              route={session.route}
              showFullRoute
              style={{ width: '100%', height: 240 }}
            />
          </div>
        )}

        {/* Pace chart per km */}
        {paceData.length > 0 && (
          <div className="glass p-4">
            <p className="font-bold text-sm mb-4" style={{ color: 'var(--text-2)' }}>
              ⚡ Pace pro Kilometer
            </p>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={paceData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="paceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={['auto', 'auto']} tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 12, color: '#fff' }}
                  labelStyle={{ color: '#aaa', fontSize: 12 }}
                  formatter={(_val: unknown, _name: unknown, props: any) => [
                    (props?.payload?.paceStr ?? '') + ' min/km', 'Pace',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="paceMin"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#paceGrad)"
                  dot={{ fill: '#10b981', r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Splits table */}
        {session.splits.length > 0 && (
          <div className="glass overflow-hidden">
            <p className="px-4 py-3 font-bold text-sm" style={{ color: 'var(--text-2)', borderBottom: '1px solid var(--glass-border)' }}>
              Kilometer-Splits
            </p>
            {session.splits.map((split, i) => (
              <div key={split.km}
                className="flex items-center px-4 py-3"
                style={{ borderTop: i > 0 ? '1px solid var(--glass-border)' : 'none' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mr-3"
                  style={{ background: 'rgba(16,185,129,0.1)' }}>
                  <span className="text-xs font-black" style={{ color: '#10b981' }}>{split.km}</span>
                </div>
                <p className="flex-1 text-sm font-bold" style={{ color: 'var(--text-1)' }}>
                  km {split.km}
                </p>
                <p className="text-sm font-black" style={{ color: split.pace === Math.min(...session.splits.map(s => s.pace)) ? '#f59e0b' : 'var(--text-2)' }}>
                  {fmtPace(split.pace)} <span className="font-normal text-xs" style={{ color: 'var(--text-3)' }}>/km</span>
                </p>
                {split.pace === Math.min(...session.splits.map(s => s.pace)) && (
                  <span className="ml-2 text-xs">🏅</span>
                )}
              </div>
            ))}
          </div>
        )}

        <button onClick={onDone} className="btn-gold w-full py-4 text-base" style={{ minHeight: 54 }}>
          Fertig
        </button>
      </div>
    </div>
  )
}
