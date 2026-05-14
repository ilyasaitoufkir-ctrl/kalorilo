import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
          <div className="text-5xl mb-4">😵</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Etwas ist schiefgelaufen</h2>
          <p className="text-sm text-gray-500 mb-4 font-mono bg-gray-50 rounded-xl p-3 text-left max-w-sm overflow-auto">
            {this.state.error.message}
          </p>
          <button
            onClick={() => { localStorage.clear(); window.location.reload() }}
            className="px-6 py-3 bg-blue-500 text-white rounded-2xl font-semibold text-sm"
          >
            App zurücksetzen
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
