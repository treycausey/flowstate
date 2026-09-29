'use client'

import { useSyncExternalStore } from 'react'
import { showSystemNotification } from '@/lib/notify'

type Permission = NotificationPermission | 'unsupported'
const listeners = new Set<() => void>()

function readPermission(): Permission {
  return typeof window !== 'undefined' && 'Notification' in window
    ? Notification.permission
    : 'unsupported'
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  // Reflect changes made in browser site settings, where the Permissions API reports them
  let status: PermissionStatus | null = null
  navigator.permissions
    ?.query({ name: 'notifications' as PermissionName })
    .then((s) => {
      status = s
      s.addEventListener('change', onChange)
    })
    .catch(() => {})
  return () => {
    listeners.delete(onChange)
    status?.removeEventListener('change', onChange)
  }
}

export default function NotificationsToggle() {
  const permission = useSyncExternalStore(subscribe, readPermission, () => 'unsupported' as const)

  const request = async () => {
    const res = await Notification.requestPermission()
    listeners.forEach((l) => l())
    if (res === 'granted') {
      showSystemNotification(
        'Notifications enabled',
        'Flowstate will notify you when a test is due.',
      )
    }
  }

  if (permission === 'unsupported') return null

  return (
    <p className="muted small" style={{ margin: 0 }}>
      {permission === 'granted' &&
        'System notifications are on. They appear when a test comes due while Flowstate is open.'}
      {permission === 'denied' &&
        'System notifications are blocked for this site. You can allow them in your browser’s site settings.'}
      {permission === 'default' && (
        <>
          Want a system notification when a test is due?{' '}
          <button type="button" className="button button--ghost button--small" onClick={request}>
            Enable notifications
          </button>
        </>
      )}
    </p>
  )
}
