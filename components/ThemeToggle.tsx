'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

const key = 'theme'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const saved = localStorage.getItem(key) as Theme | null
    const sysDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    const initial: Theme = saved ?? 'system'
    apply(initial, sysDark)
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (e: MediaQueryListEvent) => {
        const current = (localStorage.getItem(key) as Theme | null) ?? 'system'
        if (current === 'system') apply('system', e.matches)
      }
      mq.addEventListener?.('change', handler)
      return () => mq.removeEventListener?.('change', handler)
    }
  }, [])

  const apply = (t: Theme, sysDark?: boolean) => {
    setTheme(t)
    if (t === 'system') {
      document.documentElement.setAttribute('data-theme', 'system')
      // no explicit variables needed; CSS handles via media query
    } else {
      document.documentElement.setAttribute('data-theme', t)
    }
    localStorage.setItem(key, t)
  }

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => apply(e.target.value as Theme)

  return (
    <label>
      Theme
      <select value={theme} onChange={onChange} style={{ marginLeft: 6 }} aria-label="Color theme">
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
    </label>
  )
}
