"use client"

import { useEffect, useState } from 'react'

export default function NotificationsToggle() {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'Notification' in window)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  const request = async () => {
    if (!supported) return
    const res = await Notification.requestPermission()
    setPermission(res)
    if (res === 'granted') {
      new Notification('Notifications enabled', { body: 'You will see reminders when due.' })
    }
  }

  if (!supported) return null

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span>Notifications: {permission}</span>
      {permission !== 'granted' && <button onClick={request}>Enable</button>}
    </div>
  )
}

