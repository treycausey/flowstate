import { readdirSync } from 'node:fs'
import path from 'node:path'
import { Suspense } from 'react'
import StockClient from '@/components/stock/StockClient'

export const metadata = { title: 'Stock — Flowstate' }

/**
 * Species ids that have a cut-out in public/tank/fish/<id>.webp, read when the page is built.
 * Passing them down means a missing image never triggers a failing request.
 */
function stockImageIds(): string[] {
  try {
    return readdirSync(path.join(process.cwd(), 'public', 'tank', 'fish'))
      .filter((file) => file.endsWith('.webp'))
      .map((file) => file.slice(0, -'.webp'.length))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [] // no cut-outs shipped yet
    throw err
  }
}

export default function StockPage() {
  return (
    <div className="stack page">
      <Suspense fallback={null}>
        <StockClient images={stockImageIds()} />
      </Suspense>
    </div>
  )
}
