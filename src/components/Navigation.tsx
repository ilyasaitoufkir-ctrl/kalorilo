import { Home, Utensils, Dumbbell, Bot, User } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { TabId } from '../types'

const TABS: { id: TabId; icon: React.ElementType; label: string }[] = [
  { id: 'home',    icon: Home,     label: 'Start'  },
  { id: 'food',    icon: Utensils, label: 'Essen'  },
  { id: 'sport',   icon: Dumbbell, label: 'Sport'  },
  { id: 'ai',      icon: Bot,      label: 'Kalo'   },
  { id: 'profile', icon: User,     label: 'Profil' },
]

export default function Navigation() {
  const activeTab    = useStore((s) => s.activeTab)
  const setActiveTab = useStore((s) => s.setActiveTab)

  return (
    <nav className="tab-bar">
      <div className="flex items-center justify-around pt-2 px-3">
        {TABS.map(({ id, icon: Icon, label }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              onClick={() => { setActiveTab(id); navigator.vibrate?.(8) }}
              className="flex flex-col items-center gap-0.5 transition-all duration-200 relative"
              style={{
                padding: active ? '8px 14px' : '8px 10px',
                borderRadius: 20,
                background: active ? 'rgba(200,230,201,0.18)' : 'transparent',
                border: active ? '1px solid rgba(200,230,201,0.25)' : '1px solid transparent',
                minWidth: 52,
              }}
            >
              <Icon
                size={21}
                strokeWidth={active ? 2.5 : 1.8}
                style={{
                  color: active ? '#c8e6c9' : '#5a7a63',
                  transition: 'color 0.2s ease',
                  filter: active ? 'drop-shadow(0 0 6px rgba(200,230,201,0.5))' : 'none',
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: active ? 800 : 500,
                  color: active ? '#c8e6c9' : '#5a7a63',
                  transition: 'color 0.2s ease',
                  letterSpacing: active ? '0.02em' : 0,
                }}
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
