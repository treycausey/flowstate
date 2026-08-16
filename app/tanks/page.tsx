'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import TankDetailClient from '@/components/TankDetailClient'

function TanksPageInner() {
  const params = useSearchParams()
  const tankId = params.get('tankId')

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>{tankId ? `Tank ${tankId}` : 'Tanks'}</h1>
      <TankDetailClient />
    </main>
  )
}

export default function TanksPage() {
  return (
    <Suspense
      fallback={
        <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
          <h1>Tanks</h1>
        </main>
      }
    >
      <TanksPageInner />
    </Suspense>
  )
}
