import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null; showReset: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, showReset: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  handleReload = () => {
    window.location.reload()
  }

  handleResetData = () => {
    // Only clear Zustand persist state — NEVER the access code or backups
    const keysToKeep = [
      'kalorilo_access_code',
      'kalorilo_access_code_backup',
      'kalorilo_admin_codes',
      'kalorilo_seen_broadcasts',
    ]
    const saved: Record<string, string> = {}
    keysToKeep.forEach((k) => {
      const v = localStorage.getItem(k)
      if (v !== null) saved[k] = v
    })
    localStorage.clear()
    Object.entries(saved).forEach(([k, v]) => localStorage.setItem(k, v))
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
          style={{ background: 'var(--bg, #0a0a0a)' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>😵</div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 8 }}>
            Verbindungsfehler
          </h2>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
            Ein Fehler ist aufgetreten. Deine Daten sind sicher gespeichert.
          </p>
          <p style={{ fontSize: 11, color: '#555', marginBottom: 24, fontFamily: 'monospace',
            background: '#111', borderRadius: 12, padding: '10px 14px', maxWidth: 320,
            wordBreak: 'break-all', textAlign: 'left' }}>
            {this.state.error.message}
          </p>

          <button
            onClick={this.handleReload}
            style={{ height: 52, paddingInline: 32, borderRadius: 16,
              background: 'linear-gradient(135deg,#7db88a,#4a8c5c)', color: '#fff',
              fontWeight: 900, fontSize: 15, border: 'none', marginBottom: 12,
              boxShadow: '0 4px 16px rgba(74,140,92,0.3)', cursor: 'pointer' }}>
            🔄 Neu laden
          </button>

          {!this.state.showReset ? (
            <button
              onClick={() => this.setState({ showReset: true })}
              style={{ fontSize: 12, color: '#444', background: 'none', border: 'none',
                cursor: 'pointer', textDecoration: 'underline' }}>
              Erweiterte Optionen
            </button>
          ) : (
            <div style={{ marginTop: 4 }}>
              <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>
                ⚠️ Nur App-Cache löschen (Zugangscode bleibt erhalten)
              </p>
              <button
                onClick={this.handleResetData}
                style={{ height: 44, paddingInline: 24, borderRadius: 14,
                  background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                  border: '1px solid rgba(239,68,68,0.3)', fontWeight: 700,
                  fontSize: 13, cursor: 'pointer' }}>
                App-Cache zurücksetzen
              </button>
            </div>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
