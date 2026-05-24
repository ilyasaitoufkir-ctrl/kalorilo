import { Home, Utensils, Dumbbell, Bot, User } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { TabId } from '../types'

const TABS: { id: TabId; icon: React.ElementType; label: string }[] = [
  { id: 'home',    icon: Home,     label: 'Start'  },
  { id: 'food',    icon: Utensils, label: 'Essen'  },
  { id: 'sport',   icon: Dumbbell, label: 'Sport'  },
  { id: 'ai',      icon: Bot,      label: 'KI'     },
  { id: 'profile', icon: User,     label: 'Profil' },
]

export default function Navigation() {
  const activeTab    = useStore((s) => s.activeTab)
  const setActiveTab = useStore((s) => s.setActiveTab)

  return (
    <nav className="tab-bar">
      <div className="flex items-center justify-around pt-2 px-2">
        {TABS.map(({ id, icon: Icon, label }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              onClick={() => { setActiveTab(id); navigator.vibrate?.(8) }}
              className="flex flex-col items-center gap-1 py-1.5 px-4 rounded-2xl transition-all duration-200 relative"
              style={{ minWidth: 56 }}
            >
              {/* Active gold glow background */}
              {active && (
                <div
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    background: 'rgba(245,158,11,0.1)',
                    border: '1px solid rgba(245,158,11,0.25)',
                    boxShadow: '0 0 16px rgba(245,158,11,0.15)',
                  }}
                />
              )}
              <div className="relative">
                <Icon
                  size={22}
                  strokeWidth={active ? 2.5 : 1.7}
                  style={{ color: active ? '#f59e0b' : '#444444', transition: 'color 0.2s ease' }}
                />
                {/* Gold dot indicator */}
                {active && (
                  <div
                    className="absolute -bottom-1 left-1/2 w-1 h-1 rounded-full"
                    style={{ background: '#f59e0b', transform: 'translateX(-50%)', boxShadow: '0 0 6px #f59e0b' }}
                  />
                )}
              </div>
              <span
                className="text-[10px] font-semibold relative"
                style={{ color: active ? '#f59e0b' : '#444444', transition: 'color 0.2s ease' }}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
