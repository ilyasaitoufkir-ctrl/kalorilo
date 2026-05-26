import { useRef } from 'react'
import { Toaster } from 'react-hot-toast'
import { useStore } from './store/useStore'
import { useDarkMode } from './hooks/useDarkMode'
import { useWhoopSync } from './hooks/useWhoopSync'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { useFirestoreSync } from './hooks/useFirestoreSync'
import Navigation from './components/Navigation'
import Dashboard from './components/Dashboard'
import FoodTracker from './components/FoodTracker'
import SportTracker from './components/SportTracker'
import AIAdvisor from './components/AIAdvisor'
import Statistics from './components/Statistics'
import Profile from './components/Profile'
import Friends from './components/Friends'
import Onboarding from './components/Onboarding'
import LoginScreen from './components/LoginScreen'
import WhoopCallback from './components/WhoopCallback'
import ErrorBoundary from './components/ErrorBoundary'
import type { TabId } from './types'

const TAB_ORDER: TabId[] = ['home', 'food', 'sport', 'ai', 'profile']

function MainApp() {
  const profile      = useStore((s) => s.profile)
  const activeTab    = useStore((s) => s.activeTab)
  const setActiveTab = useStore((s) => s.setActiveTab)
  const { user, loading, isConfigured } = useAuth()

  useDarkMode()
  useWhoopSync()
  useFirestoreSync(user?.uid ?? null)

  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current)
    if (Math.abs(dx) > 70 && dy < 50) {
      const idx = TAB_ORDER.indexOf(activeTab as TabId)
      if (idx === -1) return
      if (dx < 0 && idx < TAB_ORDER.length - 1) { setActiveTab(TAB_ORDER[idx + 1]); navigator.vibrate?.(8) }
      if (dx > 0 && idx > 0)                     { setActiveTab(TAB_ORDER[idx - 1]); navigator.vibrate?.(8) }
    }
  }
  const handleTap = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement
    if (!t.closest('input, textarea, [contenteditable]'))
      (document.activeElement as HTMLElement)?.blur()
  }

  // Auth loading spinner
  if (isConfigured && loading) {
    return (
      <div className="h-dvh flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-center anim-fade">
          <div style={{ fontSize: 56, marginBottom: 16 }}>🥗</div>
          <div className="w-8 h-8 rounded-full border-2 mx-auto"
            style={{ borderColor: 'rgba(74,140,92,0.3)', borderTopColor: '#4a8c5c', animation: 'spin 0.8s linear infinite' }} />
        </div>
      </div>
    )
  }

  // Show login if Firebase configured but not logged in
  if (isConfigured && !user) return <LoginScreen />

  // Show onboarding if no profile yet
  if (!profile) return <Onboarding />

  const tab = activeTab as string

  return (
    <div
      className="min-h-dvh overflow-x-hidden"
      style={{ background: 'var(--bg)' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleTap}
    >
      {tab === 'home'    && <Dashboard />}
      {tab === 'food'    && <FoodTracker />}
      {tab === 'sport'   && <SportTracker />}
      {tab === 'ai'      && <AIAdvisor />}
      {tab === 'profile' && <Profile />}
      {tab === 'stats'   && <Statistics />}
      {tab === 'friends' && <Friends />}
      <Navigation />
    </div>
  )
}

export default function App() {
  const isWhoopCallback = window.location.pathname.includes('whoop-callback')

  return (
    <ErrorBoundary>
      <AuthProvider>
        {isWhoopCallback ? <WhoopCallback /> : <MainApp />}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 2800,
            style: {
              borderRadius: '16px',
              background: '#ffffff',
              color: 'var(--text-1)',
              border: '1px solid rgba(125,184,138,0.2)',
              fontSize: '14px',
              fontWeight: '600',
              padding: '12px 18px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
            },
          }}
        />
      </AuthProvider>
    </ErrorBoundary>
  )
}
