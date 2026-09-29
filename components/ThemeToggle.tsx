'use client'

import { useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark' | 'system'

export const THEME_KEY = 'theme'
const listeners = new Set<() => void>()

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system'
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  // Keep other tabs in sync
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_KEY) return
    document.documentElement.setAttribute('data-theme', readTheme())
    onChange()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onStorage)
  }
}

function setTheme(next: Theme) {
  document.documentElement.setAttribute('data-theme', next)
  try {
    localStorage.setItem(THEME_KEY, next)
  } catch {
    // ignore: storage disabled; the choice lasts for this page only
  }
  listeners.forEach((l) => l())
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'system' as Theme)

  return (
    <select
      value={theme}
      onChange={(e) => setTheme(e.target.value as Theme)}
      aria-label="Color theme"
      className="theme-select"
    >
      <option value="system">Auto</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  )
}
