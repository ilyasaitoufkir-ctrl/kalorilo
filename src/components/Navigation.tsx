import { Home, Utensils, Dumbbell, BarChart2, Bot } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { TabId } from '../types'

const TABS: { id: TabId; icon: React.ElementType; label: string }[] = [
  { id: 'home',  icon: Home,     label: 'Start'  },
  { id: 'food',  icon: Utensils, label: 'Essen'  },
  { id: 'sport', icon: Dumbbell, label: 'Sport'  },
  { id: 'stats', icon: BarChart2,label: 'Stats'  },
  { id: 'ai',    icon: Bot,      label: 'KI'     },
]

export default function Navigation() {
  const activeTab = useStore((s) => s.activeTab)
  const setActiveTab = useStore((s) => s.setActiveTab)

  return (
    <nav className="tab-bar">
      <div className="flex items-center justify-around pt-2">
        {TABS.map(({ id, icon: Icon, label }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex flex-col items-center gap-1 px-4 py-1 min-w-[56px]"
            >
              <div className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all duration-200 ${active ? 'bg-blue-50' : ''}`}>
                <Icon
                  size={22}
                  strokeWidth={active ? 2.5 : 1.8}
                  className={active ? 'text-blue-600' : 'text-slate-400'}
                />
              </div>
              <span className={`text-[10px] font-semibold transition-colors duration-200 ${active ? 'text-blue-600' : 'text-slate-400'}`}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
