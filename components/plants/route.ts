'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Route as NextRoute } from 'next'

/** The views of the Plants page. They live in the query string so back and links work. */
export type PlantsRoute =
  | { view: 'mine' }
  | { view: 'learn' }
  | { view: 'plant'; id: string }
  | { view: 'species'; id: string }

export function routeHref(route: PlantsRoute): string {
  switch (route.view) {
    case 'mine':
      return '/plants'
    case 'learn':
      return '/plants?view=learn'
    case 'plant':
      return `/plants?plant=${encodeURIComponent(route.id)}`
    case 'species':
      return `/plants?species=${encodeURIComponent(route.id)}`
  }
}

export function parseRoute(params: URLSearchParams | null): PlantsRoute {
  const plant = params?.get('plant')
  if (plant) return { view: 'plant', id: plant }
  const species = params?.get('species')
  if (species) return { view: 'species', id: species }
  if (params?.get('view') === 'learn') return { view: 'learn' }
  return { view: 'mine' }
}

/** Current view plus a `go` that pushes a new one and puts the reader back at the top. */
export function usePlantsRoute() {
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
    document.getElementById('plants-heading')?.focus()
  }, [key])

  const go = useCallback((next: PlantsRoute) => router.push(routeHref(next) as NextRoute), [router])
  return { route, go }
}
