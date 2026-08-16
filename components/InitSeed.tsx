'use client'

import { useEffect, useState } from 'react'
import { ensureSeed } from '@/lib/idb'

export default function InitSeed() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    ensureSeed().finally(() => setReady(true))
  }, [])
  return ready ? null : null
}
