/** Show a system notification if permitted. Prefers the service worker (required on Android). */
export async function showSystemNotification(title: string, body: string, tag?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission !== 'granted') return false
  const options: NotificationOptions = { body, tag, icon: '/icons/icon-192.png' }
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.()
    if (reg) {
      await reg.showNotification(title, options)
      return true
    }
  } catch {
    // fall through to the page-level API
  }
  try {
    new Notification(title, options)
    return true
  } catch {
    return false
  }
}
