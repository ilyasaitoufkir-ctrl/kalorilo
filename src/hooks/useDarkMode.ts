import { useEffect } from 'react'

export function useDarkMode() {
  useEffect(() => {
    // Always light mode – remove any dark class that may have been persisted
    document.documentElement.classList.remove('dark')
  }, [])
}
