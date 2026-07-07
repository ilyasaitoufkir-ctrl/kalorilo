import { useStore } from '../store/useStore'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { syncWhoopData, refreshAccessToken } from '../lib/whoop'

const C = {
  primary:   '#5a8a6a',
  light:     '#e8f2ec',
  warm:      '#8b7cb0',
  warmLight: '#eeebf5',
  text:      '#1a2e1f',
  secondary: '#6b8570',
  tertiary:  '#9db3a2',
  border:    '#e8f0ea',
  bg:        '#f8faf8',
  card:      '#ffffff',
} as const

function recoveryColor(r: number) {
  if (r >= 67) return '#5a8a6a'
  if (r >= 34) return '#8aaa6a'
  return '#c97a6a'
}

function StatRow({ label, value, unit, sub }: { label: string; value: string | number; unit?: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ color: C.secondary, fontSize: 14 }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ color: C.text, fontSize: 15, fontWeight: 600 }}>{value}</span>
        {unit && <span style={{ color: C.tertiary, fontSize: 13, marginLeft: 3 }}>{unit}</span>}
        {sub && <p style={{ color: C.tertiary, fontSize: 11, marginTop: 1 }}>{sub}</p>}
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '16px 18px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.primary }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

export default function WhoopScreen({ onClose }: { onClose: () => void }) {
  const whoopData     = useStore((s) => s.whoopData)
  const whoopHistory  = useStore((s) => s.whoopHistory)
  const whoopTokens   = useStore((s) => s.whoopTokens)
  const apiKeys       = useStore((s) => s.apiKeys)
  const setWhoopData  = useStore((s) => s.setWhoopData)
  const setWhoopTokens = useStore((s) => s.setWhoopTokens)
  const stepsToday    = useStore((s) => s.stepsToday)
  const whoopLastSync = useStore((s) => s.whoopLastSyncAt)

  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')

  const handleSync = async () => {
    if (!whoopTokens || !apiKeys.whoopClientId || !apiKeys.whoopClientSecret) return
    setSyncing(true)
    setSyncError('')
    try {
      let tokens = whoopTokens
      if (tokens.expiresAt - Date.now() < 5 * 60 * 1000) {
        tokens = await refreshAccessToken(tokens, apiKeys.whoopClientId, apiKeys.whoopClientSecret)
        setWhoopTokens(tokens)
      }
      const data = await syncWhoopData(tokens.accessToken)
      setWhoopData({
        recovery: data.recovery, hrv: data.hrv, restingHR: data.restingHR,
        sleepQuality: data.sleepQuality, strain: data.strain, date: data.date,
        sleepDuration: data.sleepDuration, deepSleep: data.deepSleep,
        remSleep: data.remSleep, respiratoryRate: data.respiratoryRate,
        caloriesBurned: data.caloriesBurned, dailyBurn: data.dailyBurn,
      })
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Sync fehlgeschlagen')
    }
    setSyncing(false)
  }

  const rc = recoveryColor(whoopData?.recovery ?? 0)
  const lastSyncStr = whoopLastSync
    ? new Date(whoopLastSync).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: C.bg }}>
      <div style={{ maxWidth: 430, margin: '0 auto', padding: '0 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 'max(env(safe-area-inset-top), 52px)', paddingBottom: 20 }}>
          <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.primary, fontSize: 15, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <ChevronLeft size={20} strokeWidth={2} />
            Zurück
          </button>
          <h1 style={{ color: C.text, fontSize: 17, fontWeight: 600, margin: 0 }}>WHOOP Daten</h1>
          <button onClick={handleSync} disabled={syncing || !whoopTokens}
            style={{ display: 'flex', alignItems: 'center', gap: 4, color: whoopTokens ? C.primary : C.tertiary, fontSize: 13, fontWeight: 500, background: 'none', border: 'none', cursor: whoopTokens ? 'pointer' : 'default', padding: 0 }}>
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} strokeWidth={2} />
            {syncing ? 'Sync…' : 'Sync'}
          </button>
        </div>

        {/* Status */}
        {!whoopTokens ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 20, textAlign: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>⌚</p>
            <p style={{ color: C.text, fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Kein WHOOP verbunden</p>
            <p style={{ color: C.secondary, fontSize: 13 }}>Verbinde WHOOP unter Profil → API Keys</p>
          </div>
        ) : !whoopData ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 20, textAlign: 'center', marginBottom: 16 }}>
            <p style={{ color: C.secondary, fontSize: 14 }}>Noch keine Daten. Tippe auf Sync.</p>
          </div>
        ) : null}

        {syncError && (
          <p style={{ color: '#c97a6a', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{syncError}</p>
        )}

        {whoopData && (
          <>
            {/* Recovery */}
            <Section title="Recovery" icon="💚">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0 8px' }}>
                <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
                  {(() => {
                    const size = 72, stroke = 7, r = (size - stroke) / 2
                    const circ = 2 * Math.PI * r
                    const dash = circ * Math.min(1, (whoopData.recovery) / 100)
                    return (
                      <svg width={size} height={size} style={{ position: 'absolute' }}>
                        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.light} strokeWidth={stroke} />
                        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={rc} strokeWidth={stroke}
                          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                          transform={`rotate(-90 ${size/2} ${size/2})`}
                          style={{ transition: 'stroke-dasharray 1s ease' }} />
                      </svg>
                    )
                  })()}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: rc }}>{whoopData.recovery}%</span>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: rc, fontSize: 15, fontWeight: 600, marginBottom: 2 }}>
                    {whoopData.recovery >= 67 ? 'Hohe Recovery' : whoopData.recovery >= 34 ? 'Moderate Recovery' : 'Niedrige Recovery'}
                  </p>
                  <p style={{ color: C.secondary, fontSize: 12 }}>Stand: {whoopData.date}</p>
                  {lastSyncStr && <p style={{ color: C.tertiary, fontSize: 11, marginTop: 2 }}>Letzter Sync: {lastSyncStr} Uhr</p>}
                </div>
              </div>
              <StatRow label="HRV" value={whoopData.hrv > 0 ? whoopData.hrv : '—'} unit={whoopData.hrv > 0 ? 'ms' : undefined} />
              <StatRow label="Ruhepuls" value={whoopData.restingHR > 0 ? whoopData.restingHR : '—'} unit={whoopData.restingHR > 0 ? 'bpm' : undefined} />
            </Section>

            {/* Schlaf */}
            <Section title="Schlaf" icon="😴">
              <StatRow label="Schlafdauer" value={whoopData.sleepDuration ? `${whoopData.sleepDuration}` : '—'} unit={whoopData.sleepDuration ? 'h' : undefined} />
              <StatRow label="Schlafqualität" value={whoopData.sleepQuality > 0 ? `${whoopData.sleepQuality}` : '—'} unit={whoopData.sleepQuality > 0 ? '%' : undefined} />
              <StatRow label="Tiefschlaf" value={whoopData.deepSleep ? `${whoopData.deepSleep}` : '—'} unit={whoopData.deepSleep ? 'h' : undefined} />
              <StatRow label="REM-Schlaf" value={whoopData.remSleep ? `${whoopData.remSleep}` : '—'} unit={whoopData.remSleep ? 'h' : undefined} />
              <StatRow label="Atemfrequenz" value={whoopData.respiratoryRate ? `${whoopData.respiratoryRate}` : '—'} unit={whoopData.respiratoryRate ? '/min' : undefined} />
            </Section>

            {/* Belastung */}
            <Section title="Belastung (Strain)" icon="⚡">
              <div style={{ padding: '12px 0 8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ color: C.text, fontSize: 32, fontWeight: 700, letterSpacing: '-1px' }}>{whoopData.strain > 0 ? whoopData.strain.toFixed(1) : '—'}</span>
                  <span style={{ color: C.tertiary, fontSize: 12 }}>/ 21</span>
                </div>
                {whoopData.strain > 0 && (
                  <div style={{ height: 6, background: C.light, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(whoopData.strain / 21) * 100}%`, background: whoopData.strain > 14 ? C.warm : whoopData.strain > 8 ? '#c4a06a' : C.primary, borderRadius: 3, transition: 'width 1s ease' }} />
                  </div>
                )}
                <p style={{ color: C.secondary, fontSize: 12, marginTop: 6 }}>
                  {whoopData.strain > 14 ? 'Hohe Belastung' : whoopData.strain > 8 ? 'Moderate Belastung' : whoopData.strain > 0 ? 'Niedrige Belastung' : 'Keine Workouts heute'}
                </p>
              </div>
            </Section>

            {/* Kalorien */}
            <Section title="Kalorien" icon="🔥">
              <StatRow label="Gesamt-Verbrauch" value={whoopData.dailyBurn ? Math.round(whoopData.dailyBurn) : '—'} unit={whoopData.dailyBurn ? 'kcal' : undefined} sub="inkl. NEAT + Grundumsatz" />
              <StatRow label="Workout-Kalorien" value={whoopData.caloriesBurned ? Math.round(whoopData.caloriesBurned) : '—'} unit={whoopData.caloriesBurned ? 'kcal' : undefined} />
            </Section>

            {/* Aktivität (Apple Health) */}
            <Section title="Aktivität" icon="👣">
              <StatRow label="Schritte" value={stepsToday > 0 ? stepsToday.toLocaleString('de-DE') : '—'} sub="via Apple Health" />
              <p style={{ color: C.tertiary, fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>WHOOP trackt keine Schritte — Schritte kommen aus Apple Health</p>
            </Section>

            {/* 7-Tage-Verlauf */}
            {whoopHistory.length > 0 && (
              <Section title="7-Tage-Verlauf" icon="📈">
                <div style={{ display: 'flex', gap: 4, marginTop: 8, alignItems: 'flex-end', height: 60 }}>
                  {whoopHistory.slice(-7).map((d) => {
                    const h = Math.max(8, (d.recovery / 100) * 52)
                    const col = recoveryColor(d.recovery)
                    return (
                      <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: '100%', height: h, background: col, borderRadius: 4, opacity: 0.8 }} />
                        <span style={{ color: C.tertiary, fontSize: 9 }}>{d.date.slice(5)}</span>
                      </div>
                    )
                  })}
                </div>
                <p style={{ color: C.tertiary, fontSize: 11, marginTop: 4, textAlign: 'center' }}>Recovery der letzten 7 Tage</p>
              </Section>
            )}
          </>
        )}

        <div style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 32px)' }} />
      </div>
    </div>
  )
}
