'use client'

import { createContext, useContext, useState } from 'react'
import { stockImageSrc } from '@/lib/stock/catalog'
import type { StockKind } from '@/lib/stock/types'

/** Species ids that have a cut-out at /tank/fish/<id>.webp. Filled by the page at build time. */
export const StockImagesContext = createContext<ReadonlySet<string>>(new Set())

// Plain line drawings shown when a cut-out is missing or fails to load.
const GLYPH: Record<StockKind, string> = {
  fish: 'M5 20c4-7 10-9 17-6l7-5v22l-7-5c-7 3-13 1-17-6ZM25 18.5v.01',
  shrimp:
    'M8 27c-2-8 3-15 12-15 6 0 10 4 11 9-4-2-7-2-9 0M8 27c3 3 8 4 13 1M16 12c1-3 3-5 7-6M29 21l5 5M26 25l4 6',
  snail:
    'M6 30h26M8 30c0-4 2-6 5-6M14 24c-4 0-6-5-3-9 3-5 11-5 14 0 3 5 1 13-5 15M20 22a3 3 0 1 1 3 3',
}

type Props = {
  speciesId: string | null
  kind: StockKind
  size?: 'sm' | 'lg'
}

/**
 * The animal's cut-out on the panel, or a small line drawing when no image ships. The cut-outs
 * face right and have a transparent background, so they sit on the panel material directly.
 */
export default function StockThumb({ speciesId, kind, size = 'sm' }: Props) {
  const images = useContext(StockImagesContext)
  // Ids whose image failed to load (missing file, offline and never cached): show the glyph instead
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set())
  const hasImage = !!speciesId && images.has(speciesId) && !broken.has(speciesId)
  return (
    <span className="stock-thumb" data-size={size} aria-hidden="true">
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- static export, no image optimizer
        <img
          src={stockImageSrc(speciesId)}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setBroken((prev) => new Set(prev).add(speciesId))}
        />
      ) : (
        <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d={GLYPH[kind]} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}
