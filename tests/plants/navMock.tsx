/**
 * Minimal stand-in for next/navigation: the query string is a small store, `router.push` writes
 * to it and `useSearchParams` re-renders on change. Use with
 * `jest.mock('next/navigation', () => jest.requireActual('./navMock'))`.
 */
import { useMemo, useSyncExternalStore } from 'react'

let search = ''
const listeners = new Set<() => void>()
const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Set the current query string (with or without a leading "?"). */
export function setSearch(next: string) {
  search = next.replace(/^\?/, '')
  listeners.forEach((l) => l())
}

export function currentSearch() {
  return search
}

export function useSearchParams() {
  const value = useSyncExternalStore(
    subscribe,
    () => search,
    () => search,
  )
  return useMemo(() => new URLSearchParams(value), [value])
}

const router = {
  push: (url: string) => setSearch(url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''),
  replace: (url: string) => setSearch(url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''),
  back: () => {},
  forward: () => {},
  refresh: () => {},
  prefetch: () => {},
}

export function useRouter() {
  return router
}

export function usePathname() {
  return '/plants'
}
