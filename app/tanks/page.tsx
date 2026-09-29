import { Suspense } from 'react'
import TankDetailClient from '@/components/TankDetailClient'

export const metadata = { title: 'Charts — Flowstate' }

export default function TanksPage() {
  return (
    <main className="container stack page">
      <h1 className="page-title">Charts</h1>
      <Suspense fallback={null}>
        <TankDetailClient />
      </Suspense>
    </main>
  )
}
