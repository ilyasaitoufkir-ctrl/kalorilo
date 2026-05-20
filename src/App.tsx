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

const TAB_ORDER: TabId[] = ['home', 'food', 'sport', 'friends', 'ai']

function MainApp() {
  const profile        = useStore((s) => s.profile)
  const activeTab      = useStore((s) => s.activeTab)
  const setActiveTab   = useStore((s) => s.setActiveTab)
  const firebaseConfig = useStore((s) => s.firebaseConfig)

  useDarkMode()

  // Auto-init Firebase if config saved
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
    const target = e.target as HTMLElement
    if (!target.closest('input, textarea, [contenteditable]')) {
      (document.activeElement as HTMLElement)?.blur()
    }
  }

  if (!profile) return <Onboarding />

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg)' }}
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onClick={handleTap}>
      {activeTab === 'home'    && <Dashboard />}
      {activeTab === 'food'    && <FoodTracker />}
      {activeTab === 'sport'   && <SportTracker />}
      {activeTab === 'stats'   && <Statistics />}
      {activeTab === 'ai'      && <AIAdvisor />}
      {activeTab === 'profile' && <Profile />}
      {activeTab === 'friends' && <Friends />}
      <Navigation />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
      <Toaster position="top-center" toastOptions={{
        duration: 2800,
        style: {
          borderRadius: '16px', background: 'var(--surface)', color: 'var(--text1)',
          fontSize: '14px', fontWeight: '500', padding: '12px 16px',
          maxWidth: '340px', boxShadow: 'var(--shadow)',
        },
      }} />
    </ErrorBoundary>
  )
}
