import { Suspense } from 'react'
import TankDetailClient from '@/components/TankDetailClient'

export const metadata = { title: 'Charts — Flowstate' }

export default function TanksPage() {
  return (
    <div className="stack page">
      <h1 className="page-title visually-hidden">Charts</h1>
      <Suspense fallback={null}>
        <TankDetailClient />
      </Suspense>
    </div>
  )
}
