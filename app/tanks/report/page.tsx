import { Suspense } from 'react'
import ReportClient from '@/components/ReportClient'

export const metadata = { title: 'Report — Flowstate' }

export default function TanksReportPage() {
  return (
    <main className="container stack page report">
      <Suspense fallback={null}>
        <ReportClient />
      </Suspense>
    </main>
  )
}
