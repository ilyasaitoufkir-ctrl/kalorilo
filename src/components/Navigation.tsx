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
      <div className="flex items-center justify-around pt-2 px-2">
        {TABS.map(({ id, icon: Icon, label }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              onClick={() => { setActiveTab(id); navigator.vibrate?.(6) }}
              className="flex flex-col items-center gap-1 transition-all duration-200"
              style={{
                padding: '6px 12px',
                borderRadius: 12,
                background: 'transparent',
                border: 'none',
                minWidth: 52,
              }}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2 : 1.5}
                style={{
                  color: active ? '#5a8a6a' : '#9db3a2',
                  transition: 'color 0.2s ease',
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: active ? 600 : 400,
                  color: active ? '#5a8a6a' : '#9db3a2',
                  transition: 'color 0.2s ease',
                  letterSpacing: '0.01em',
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
