import { useEffect } from 'react'
import { useStore } from '../store/useStore'

export function useDarkMode() {
  const darkMode = useStore((s) => s.darkMode)

  useEffect(() => {
    const apply = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const isDark = darkMode === 'dark' || (darkMode === 'auto' && prefersDark)
      document.documentElement.classList.toggle('dark', isDark)
    }

    apply()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [darkMode])
}
