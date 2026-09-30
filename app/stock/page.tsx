import { Suspense } from 'react'
import StockClient from '@/components/stock/StockClient'
import { stockImageIds } from '@/lib/stock/imageIds'

export const metadata = { title: 'Stock — Flowstate' }

export default function StockPage() {
  return (
    <div className="stack page">
      <Suspense fallback={null}>
        <StockClient images={stockImageIds()} />
      </Suspense>
    </div>
  )
}
