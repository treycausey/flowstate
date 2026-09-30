'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Route as NextRoute } from 'next'

/** The views of the Stock page. They live in the query string so back and links work. */
export type StockRoute =
  | { view: 'mine' }
  | { view: 'learn' }
  | { view: 'group'; id: string }
  | { view: 'species'; id: string }

export function routeHref(route: StockRoute): string {
  switch (route.view) {
    case 'mine':
      return '/stock'
    case 'learn':
      return '/stock?view=learn'
    case 'group':
      return `/stock?group=${encodeURIComponent(route.id)}`
    case 'species':
      return `/stock?species=${encodeURIComponent(route.id)}`
  }
}

export function parseRoute(params: URLSearchParams | null): StockRoute {
  const group = params?.get('group')
  if (group) return { view: 'group', id: group }
  const species = params?.get('species')
  if (species) return { view: 'species', id: species }
  if (params?.get('view') === 'learn') return { view: 'learn' }
  return { view: 'mine' }
}

/** Current view plus a `go` that pushes a new one and puts the reader back at the top. */
export function useStockRoute() {
  const params = useSearchParams()
  const router = useRouter()
  const route = parseRoute(params)
  const key = routeHref(route)
  const lastKey = useRef(key)

  // Scroll the panel back to the top and hand focus to the new page heading.
  useEffect(() => {
    if (lastKey.current === key) return
    lastKey.current = key
    document.querySelector('.app-panel')?.scrollTo?.(0, 0)
    window.scrollTo?.(0, 0)
    document.getElementById('stock-heading')?.focus()
  }, [key])

  const go = useCallback((next: StockRoute) => router.push(routeHref(next) as NextRoute), [router])
  return { route, go }
}
