'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import ReportClient from '@/components/ReportClient'

function ReportPageInner() {
  const params = useSearchParams()
  const tankId = params.get('tankId') ?? undefined

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Report</h1>
      <ReportClient initialTankId={tankId} />
    </main>
  )
}

export default function TanksReportPage() {
  return (
    <Suspense
      fallback={
        <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
          <h1>Report</h1>
        </main>
      }
    >
      <ReportPageInner />
    </Suspense>
  )
}
