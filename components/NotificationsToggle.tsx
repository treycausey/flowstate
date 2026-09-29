'use client'

import { useEffect, useState } from 'react'
import { showSystemNotification } from '@/lib/notify'

export default function NotificationsToggle() {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setSupported(true)
      setPermission(Notification.permission)
    }
  }, [])

  const request = async () => {
    const res = await Notification.requestPermission()
    setPermission(res)
    if (res === 'granted') {
      showSystemNotification(
        'Notifications enabled',
        'Flowstate will notify you when a test is due.',
      )
    }
  }

  if (!supported) return null

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
