'use client'

import { createContext, useContext, useState } from 'react'
import type { Placement } from '@/lib/plants/types'

/** Species ids that have an image at /plants/<id>.webp. Filled by the page at build time. */
export const PlantImagesContext = createContext<ReadonlySet<string>>(new Set())

const GLYPH: Record<Placement, string> = {
  // Low tuft of blades
  foreground: 'M9 31c1-8 2-12 4-16M15 31c0-9 1-15 5-21M22 31c1-8 4-13 9-16M28 31c1-4 2-6 4-8',
  // Leaf rosette
  midground:
    'M20 32V19M20 22c-5 0-9-3-10-9 6 0 10 3 10 9ZM20 22c5 0 9-3 10-9-6 0-10 3-10 9ZM20 28c-4 0-7-2-8-6 5 0 8 2 8 6ZM20 28c4 0 7-2 8-6-5 0-8 2-8 6Z',
  // Tall stem with leaf pairs
  background:
    'M20 33V7M20 13c-3 0-5-2-6-5 3 0 5 2 6 5ZM20 13c3 0 5-2 6-5-3 0-5 2-6 5ZM20 21c-3 0-6-2-7-5 3 0 6 2 7 5ZM20 21c3 0 6-2 7-5-3 0-6 2-7 5ZM20 29c-3 0-6-2-7-5 3 0 6 2 7 5ZM20 29c3 0 6-2 7-5-3 0-6 2-7 5Z',
  // Round pads on the surface, roots hanging
  floating: 'M6 15h28M11 15c0-3 2-5 5-5s5 2 5 5M22 15c0-2 2-4 4-4s4 2 4 4M14 17v9M19 17v13M27 17v8',
  // Leaf on a stone
  epiphyte:
    'M7 32c0-5 5-8 13-8s13 3 13 8ZM20 24c-5-2-7-7-6-14 5 2 7 7 6 14ZM20 24c4-1 7-5 8-10-5 1-8 5-8 10Z',
}

type Props = {
  speciesId: string | null
  placement: Placement
  size?: 'sm' | 'lg'
}

/** Species photo when one ships in /plants, else a small line drawing for the placement. */
export default function PlantThumb({ speciesId, placement, size = 'sm' }: Props) {
  const images = useContext(PlantImagesContext)
  // Ids whose image failed to load (missing file, offline and never cached): show the glyph instead
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set())
  const hasImage = !!speciesId && images.has(speciesId) && !broken.has(speciesId)
  return (
    <span className="plant-thumb" data-size={size} aria-hidden="true">
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- static export, no image optimizer
        <img
          src={`/plants/${speciesId}.webp`}
          alt=""
          // No loading="lazy" / decoding="async": WKWebView (Tauri, iOS) leaves lazy images in a
          // freshly mounted modal blank for seconds. The lists are short and the files small.
          onError={() => setBroken((prev) => new Set(prev).add(speciesId))}
        />
      ) : (
        <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d={GLYPH[placement]} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}

/** Side of the square photos in public/plants, so the hero reserves its space before loading. */
const PHOTO_PX = 720

/**
 * Large species photo for the species page, or the placement glyph when no photo ships or it
 * fails to load. Unlike the thumbnail it is content, so its alt text names the plant.
 */
export function SpeciesPhoto({
  speciesId,
  name,
  placement,
}: {
  speciesId: string
  name: string
  placement: Placement
}) {
  const images = useContext(PlantImagesContext)
  const [broken, setBroken] = useState(false)
  if (!images.has(speciesId) || broken) {
    return <PlantThumb speciesId={null} placement={placement} size="lg" />
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static export, no image optimizer
    <img
      className="plant-photo"
      src={`/plants/${speciesId}.webp`}
      alt={name}
      width={PHOTO_PX}
      height={PHOTO_PX}
      onError={() => setBroken(true)}
    />
  )
}
