import { useState } from 'react'

// ── CSS Bar Chart ─────────────────────────────────────────────────────────────
export interface BarDatum {
  label: string
  value: number
  value2?: number
  color?: string
  color2?: string
  extra?: string   // tooltip extra line
}

export function CSSBarChart({
  data,
  height = 100,
  unit = '',
}: {
  data: BarDatum[]
  height?: number
  unit?: string
}) {
  const [tip, setTip] = useState<number | null>(null)
  const max = Math.max(...data.map(d => Math.max(d.value, d.value2 ?? 0)), 1)

  return (
    <div style={{ position: 'relative' }}>
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 relative"
            onMouseEnter={() => setTip(i)} onMouseLeave={() => setTip(null)}
            onTouchStart={() => setTip(i)} onTouchEnd={() => setTimeout(() => setTip(null), 1200)}>
            {/* Tooltip */}
            {tip === i && (
              <div className="absolute bottom-full mb-1 z-10 px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
                style={{ background: 'rgba(20,20,20,0.85)', color: '#fff', fontSize: 10, left: '50%', transform: 'translateX(-50%)' }}>
                {d.label}: {d.value}{unit}
                {d.value2 !== undefined ? ` · ${d.value2}${unit}` : ''}
                {d.extra ? ` · ${d.extra}` : ''}
              </div>
            )}
            {/* Bars side by side */}
            <div className="flex items-end gap-px w-full" style={{ height: height - 18 }}>
              <div className="flex-1 rounded-t-md transition-all"
                style={{
                  height: `${(d.value / max) * 100}%`,
                  background: d.color ?? 'linear-gradient(180deg,#4a8c5c,#7db88a)',
                  minHeight: d.value > 0 ? 3 : 0,
                  opacity: 0.9,
                }} />
              {d.value2 !== undefined && (
                <div className="flex-1 rounded-t-md transition-all"
                  style={{
                    height: `${(d.value2 / max) * 100}%`,
                    background: d.color2 ?? '#10b981',
                    minHeight: d.value2 > 0 ? 3 : 0,
                    opacity: 0.9,
                  }} />
              )}
            </div>
            <span style={{ fontSize: 9, color: 'var(--text-3)', lineHeight: 1 }}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── CSS Line Chart (SVG polyline, no library) ─────────────────────────────────
export interface LineDatum { label: string; value: number }

export function CSSLineChart({
  data,
  color = '#f59e0b',
  unit = '',
  height = 100,
}: {
  data: LineDatum[]
  color?: string
  unit?: string
  height?: number
}) {
  const [tip, setTip] = useState<number | null>(null)
  if (data.length === 0) return null
  const min = Math.min(...data.map(d => d.value))
  const max = Math.max(...data.map(d => d.value))
  const range = max - min || 1
  const w = 300
  const h = height - 24
  const pad = 10
  const points = data.map((d, i) => {
    const x = pad + (i / (data.length - 1 || 1)) * (w - pad * 2)
    const y = h - ((d.value - min) / range) * (h - pad * 2) - pad
    return { x, y, ...d }
  })
  const polyline = points.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h, overflow: 'visible' }}>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Fill area */}
        <polygon
          points={`${points[0].x},${h} ${polyline} ${points[points.length-1].x},${h}`}
          fill="url(#lineGrad)" />
        {/* Line */}
        <polyline points={polyline} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {/* Dots + tooltips */}
        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setTip(i)} onMouseLeave={() => setTip(null)}>
            <circle cx={p.x} cy={p.y} r={5} fill={color} stroke="white" strokeWidth="1.5" />
            {tip === i && (
              <g>
                <rect x={p.x - 28} y={p.y - 26} width={56} height={18} rx="6" fill="rgba(20,20,20,0.85)" />
                <text x={p.x} y={p.y - 13} textAnchor="middle" fill="white" fontSize="10" fontWeight="600">
                  {p.value}{unit}
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>
      {/* X labels */}
      <div className="flex justify-between px-1" style={{ marginTop: 2 }}>
        {data.map((d, i) => (
          <span key={i} style={{ fontSize: 9, color: 'var(--text-3)' }}>{d.label}</span>
        ))}
      </div>
    </div>
  )
}

// ── Colored Bar Chart (for RunSummary pace) ───────────────────────────────────
export interface PaceDatum {
  name: string
  paceMin: number
  paceStr: string
  isBest: boolean
  isWorst: boolean
}

export function PaceBarChart({ data, avgPaceMin }: { data: PaceDatum[]; avgPaceMin: number }) {
  const [tip, setTip] = useState<number | null>(null)
  const max = Math.max(...data.map(d => d.paceMin), 1)
  const h = 140

  return (
    <div style={{ position: 'relative' }}>
      <div className="flex items-end gap-1.5" style={{ height: h }}>
        {data.map((d, i) => {
          const barH = (d.paceMin / max) * (h - 24)
          const bg = d.isBest ? '#4a8c5c' : d.isWorst ? '#ef4444' : '#3b82f6'
          const avgLine = (avgPaceMin / max) * (h - 24)
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5 relative"
              onMouseEnter={() => setTip(i)} onMouseLeave={() => setTip(null)}
              onTouchStart={() => setTip(i)} onTouchEnd={() => setTimeout(() => setTip(null), 1500)}>
              {tip === i && (
                <div className="absolute bottom-full mb-1 z-10 px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
                  style={{ background: 'rgba(20,20,20,0.85)', color: '#fff', left: '50%', transform: 'translateX(-50%)' }}>
                  {d.name}: {d.paceStr} min/km
                  {d.isBest ? ' 🥇' : d.isWorst ? ' 🔴' : ''}
                </div>
              )}
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%', position: 'relative' }}>
                {/* Avg reference line */}
                <div style={{
                  position: 'absolute', bottom: avgLine, left: 0, right: 0, height: 1.5,
                  background: 'rgba(255,255,255,0.25)', borderRadius: 1,
                }} />
                <div className="w-full rounded-t-lg transition-all"
                  style={{ height: barH, background: bg, opacity: 0.88, minHeight: 4 }} />
              </div>
              <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{d.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
