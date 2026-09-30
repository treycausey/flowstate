import { Suspense } from 'react'
import ReportClient from '@/components/ReportClient'

export const metadata = { title: 'Report — Flowstate' }

export default function TanksReportPage() {
  return (
    <div className="stack page report">
      <Suspense fallback={null}>
        <ReportClient />
      </Suspense>
    </div>
  )
}
