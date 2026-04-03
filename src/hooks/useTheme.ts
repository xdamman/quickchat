import { useState, useEffect } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem('quickchat:theme') as ThemeMode) || 'system'
  })

  useEffect(() => {
    localStorage.setItem('quickchat:theme', theme)
    const updateDOM = () => {
      const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.classList.toggle('dark', isDark)
    }
    
    updateDOM()

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => updateDOM()
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }
  }, [theme])

  return { theme, setTheme }
}
