import { Home, Utensils, Dumbbell, Bot, BarChart2, User, Refrigerator } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { TabId } from '../types'

type ExtTabId = TabId | 'fridge'

const TABS: { id: ExtTabId; icon: React.ElementType; label: string }[] = [
  { id: 'dashboard', icon: Home, label: 'Start' },
  { id: 'food', icon: Utensils, label: 'Essen' },
  { id: 'sport', icon: Dumbbell, label: 'Sport' },
  { id: 'fridge', icon: Refrigerator, label: 'Kühlschrank' },
  { id: 'ai', icon: Bot, label: 'KI' },
  { id: 'stats', icon: BarChart2, label: 'Stats' },
  { id: 'profile', icon: User, label: 'Profil' },
]

export default function Navigation() {
  const activeTab = useStore((s) => s.activeTab)
  const setActiveTab = useStore((s) => s.setActiveTab)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-gray-100 max-w-[480px] mx-auto" style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
      <div className="flex items-center justify-around px-0.5 pt-1">
        {TABS.map(({ id, icon: Icon, label }) => {
          const isActive = (activeTab as string) === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id as TabId)}
              className={`flex flex-col items-center gap-0.5 py-1.5 px-1.5 rounded-2xl transition-all min-w-0`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-blue-50' : ''}`}>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
              </div>
              <span className={`text-[9px] font-medium leading-none truncate max-w-[44px] ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
