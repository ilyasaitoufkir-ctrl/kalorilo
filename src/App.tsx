import { lazy, Suspense, useRef } from 'react'
import { Toaster } from 'react-hot-toast'
import { useStore } from './store/useStore'
import { useDarkMode } from './hooks/useDarkMode'
import { useWhoopSync } from './hooks/useWhoopSync'
import { useFirestoreSync } from './hooks/useFirestoreSync'
import { useBroadcasts } from './hooks/useBroadcasts'
import Navigation from './components/Navigation'
import ErrorBoundary from './components/ErrorBoundary'
import type { TabId } from './types'

// ── Lazy-loaded route components ──────────────────────────────────────────────
// Each tab is its own chunk — only loaded when first visited.
const Dashboard    = lazy(() => import('./components/Dashboard'))
const FoodTracker  = lazy(() => import('./components/FoodTracker'))
const SportTracker = lazy(() => import('./components/SportTracker'))
const AIAdvisor    = lazy(() => import('./components/AIAdvisor'))
const Profile      = lazy(() => import('./components/Profile'))
const Statistics   = lazy(() => import('./components/Statistics'))
const Friends      = lazy(() => import('./components/Friends'))
const Onboarding   = lazy(() => import('./components/Onboarding'))
const WhoopCallback = lazy(() => import('./components/WhoopCallback'))

// ── Shared loading spinner ────────────────────────────────────────────────────
function Spinner() {
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

// ── Lightweight tab fallback (keeps nav visible while tab chunk loads) ────────
function TabFallback() {
  return (
    <div className="flex items-center justify-center" style={{ height: 'calc(100dvh - 80px)', background: 'var(--bg)' }}>
      <div className="w-6 h-6 rounded-full border-2"
        style={{ borderColor: 'rgba(74,140,92,0.3)', borderTopColor: '#4a8c5c', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
}

const TAB_ORDER: TabId[] = ['home', 'food', 'sport', 'ai', 'profile']

function MainApp() {
  const profile      = useStore((s) => s.profile)
  const activeTab    = useStore((s) => s.activeTab)
  const setActiveTab = useStore((s) => s.setActiveTab)

  useDarkMode()
  useWhoopSync()
  useFirestoreSync(null)
  useBroadcasts(null)

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

  if (!profile) {
    return (
      <Suspense fallback={<Spinner />}>
        <Onboarding />
      </Suspense>
    )
  }

  const tab = activeTab as string

  return (
    <div
      className="min-h-dvh overflow-x-hidden"
      style={{ background: 'var(--bg)' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleTap}
    >
      <Suspense fallback={<TabFallback />}>
        {tab === 'home'     && <Dashboard />}
        {tab === 'food'     && <FoodTracker />}
        {tab === 'sport'    && <SportTracker />}
        {tab === 'ai'       && <AIAdvisor />}
        {tab === 'profile'  && <Profile />}
        {tab === 'stats'    && <Statistics />}
        {tab === 'friends'  && <Friends />}
      </Suspense>
      <Navigation />
    </div>
  )
}

export default function App() {
  const isWhoopCallback = window.location.pathname.includes('whoop-callback')

  return (
    <ErrorBoundary>
      <Suspense fallback={<Spinner />}>
        {isWhoopCallback ? (
          <WhoopCallback />
        ) : (
          <MainApp />
        )}
      </Suspense>
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
    </ErrorBoundary>
  )
}
