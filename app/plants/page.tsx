import { readdirSync } from 'node:fs'
import path from 'node:path'
import { Suspense } from 'react'
import PlantsClient from '@/components/plants/PlantsClient'

export const metadata = { title: 'Plants — Flowstate' }

/**
 * Species ids that have a photo in public/plants/<id>.webp, read when the page is built.
 * Passing them down means a missing photo never triggers a failing image request.
 */
function plantImageIds(): string[] {
  try {
    return readdirSync(path.join(process.cwd(), 'public', 'plants'))
      .filter((file) => file.endsWith('.webp'))
      .map((file) => file.slice(0, -'.webp'.length))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [] // no photos shipped yet
    throw err
  }
}

export default function PlantsPage() {
  return (
    <div className="stack page">
      <Suspense fallback={null}>
        <PlantsClient images={plantImageIds()} />
      </Suspense>
    </div>
  )
}
