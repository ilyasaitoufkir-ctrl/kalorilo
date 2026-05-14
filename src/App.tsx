import { Toaster } from 'react-hot-toast'
import { useStore } from './store/useStore'
import Navigation from './components/Navigation'
import Dashboard from './components/Dashboard'
import FoodTracker from './components/FoodTracker'
import SportTracker from './components/SportTracker'
import AIAdvisor from './components/AIAdvisor'
import Statistics from './components/Statistics'
import Profile from './components/Profile'
import Onboarding from './components/Onboarding'
import ErrorBoundary from './components/ErrorBoundary'

function MainApp() {
  const profile = useStore((s) => s.profile)
  const activeTab = useStore((s) => s.activeTab)

  if (!profile) return <Onboarding />

  return (
    <div className="min-h-dvh bg-slate-100">
      {activeTab === 'home'    && <Dashboard />}
      {activeTab === 'food'    && <FoodTracker />}
      {activeTab === 'sport'   && <SportTracker />}
      {activeTab === 'stats'   && <Statistics />}
      {activeTab === 'ai'      && <AIAdvisor />}
      {activeTab === 'profile' && <Profile />}
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
            background: '#0f172a',
            color: '#f8fafc',
            fontSize: '14px',
            fontWeight: '500',
            padding: '12px 16px',
            maxWidth: '340px',
          },
        }}
      />
    </ErrorBoundary>
  )
}
