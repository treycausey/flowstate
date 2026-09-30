export type NavTarget = 'home' | 'charts' | 'plants' | 'stock' | 'report' | 'settings' | string

export function mapNavToPath(target: NavTarget, activeTankId?: string | null): string | null {
  const t = (target || '').toString().toLowerCase()
  switch (t) {
    case 'home':
    case '/':
      return '/'
    case 'settings':
      return '/settings'
    case 'plants':
      return '/plants'
    case 'stock':
      return '/stock'
    case 'charts':
      return activeTankId ? `/tanks?tankId=${activeTankId}` : '/tanks'
    case 'report':
      return activeTankId ? `/tanks/report?tankId=${activeTankId}` : '/tanks/report'
    default:
      // Allow direct paths when payload is a path
      return t.startsWith('/') ? t : null
  }
}
