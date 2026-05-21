import { useRef } from 'react'
import { Toaster } from 'react-hot-toast'
import { useStore } from './store/useStore'
import { useDarkMode } from './hooks/useDarkMode'
import { tryInitFromConfig } from './lib/firebase'
import Navigation from './components/Navigation'
import Dashboard from './components/Dashboard'
import FoodTracker from './components/FoodTracker'
import SportTracker from './components/SportTracker'
import AIAdvisor from './components/AIAdvisor'
import Statistics from './components/Statistics'
import Profile from './components/Profile'
import Friends from './components/Friends'
import Onboarding from './components/Onboarding'
import ErrorBoundary from './components/ErrorBoundary'
import type { TabId } from './types'

const TAB_ORDER: TabId[] = ['home', 'food', 'sport', 'ai', 'profile']

function MainApp() {
  const profile        = useStore((s) => s.profile)
  const activeTab      = useStore((s) => s.activeTab)
  const setActiveTab   = useStore((s) => s.setActiveTab)
  const firebaseConfig = useStore((s) => s.firebaseConfig)

  useDarkMode()
  if (firebaseConfig?.apiKey) tryInitFromConfig(firebaseConfig)

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
      if (dx < 0 && idx < TAB_ORDER.length - 1) setActiveTab(TAB_ORDER[idx + 1])
      if (dx > 0 && idx > 0) setActiveTab(TAB_ORDER[idx - 1])
    }
  }
  const handleTap = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement
    if (!t.closest('input, textarea, [contenteditable]')) {
      (document.activeElement as HTMLElement)?.blur()
    }
  }

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
  return (
    <ErrorBoundary>
      <MainApp />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 2800,
          style: {
            borderRadius: '16px',
            background: 'rgba(17,24,40,0.95)',
            color: '#f1f5f9',
            border: '1px solid rgba(255,255,255,0.08)',
            fontSize: '14px',
            fontWeight: '600',
            padding: '12px 18px',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          },
        }}
      />
    </ErrorBoundary>
  )
}
