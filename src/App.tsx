import { Toaster } from 'react-hot-toast'
import { useStore } from './store/useStore'
import Navigation from './components/Navigation'
import Dashboard from './components/Dashboard'
import FoodTracker from './components/FoodTracker'
import SportTracker from './components/SportTracker'
import AIAdvisor from './components/AIAdvisor'
import Statistics from './components/Statistics'
import Profile from './components/Profile'
import FridgeScan from './components/FridgeScan'
import Onboarding from './components/Onboarding'
import ErrorBoundary from './components/ErrorBoundary'

function MainApp() {
  const profile = useStore((s) => s.profile)
  const activeTab = useStore((s) => s.activeTab)

  if (!profile) {
    return <Onboarding />
  }

  const tab = activeTab as string

  return (
    <div className="relative min-h-screen bg-gray-50">
      {tab === 'dashboard' && <Dashboard />}
      {tab === 'food' && <FoodTracker />}
      {tab === 'sport' && <SportTracker />}
      {tab === 'ai' && <AIAdvisor />}
      {tab === 'stats' && <Statistics />}
      {tab === 'profile' && <Profile />}
      {tab === 'fridge' && <FridgeScan />}
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
          duration: 2500,
          style: { borderRadius: '16px', background: '#1e293b', color: '#fff', fontSize: '14px' },
        }}
      />
    </ErrorBoundary>
  )
}
