import { fireEvent, render, screen } from '@testing-library/react'
import PlantThumb, { PlantImagesContext, SpeciesPhoto } from '@/components/plants/PlantThumb'

// The thumbnail is aria-hidden decoration with alt="", so it has no accessible role to query
const hiddenImg = () => document.querySelector('.plant-thumb img')
const glyph = () => document.querySelector('.plant-thumb svg')

describe('PlantThumb', () => {
  it('falls back to the placement glyph when the photo fails to load', () => {
    render(
      <PlantImagesContext.Provider value={new Set(['java-fern'])}>
        <PlantThumb speciesId="java-fern" placement="epiphyte" />
      </PlantImagesContext.Provider>,
    )
    fireEvent.error(hiddenImg()!)
    expect(hiddenImg()).not.toBeInTheDocument()
    expect(glyph()).toBeInTheDocument()
  })
})

function renderPhoto() {
  render(
    <PlantImagesContext.Provider value={new Set(['java-fern'])}>
      <SpeciesPhoto speciesId="java-fern" name="Java fern" placement="epiphyte" />
    </PlantImagesContext.Provider>,
  )
}

describe('SpeciesPhoto', () => {
  it('shows a lazy, sized photo named for the plant', () => {
    renderPhoto()
    const img = screen.getByRole('img', { name: 'Java fern' })
    expect(img).toHaveAttribute('src', '/plants/java-fern.webp')
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(img).toHaveAttribute('width', '720')
    expect(img).toHaveAttribute('height', '720')
  })

  it('falls back to the placement glyph when the photo fails to load', () => {
    renderPhoto()
    fireEvent.error(screen.getByRole('img', { name: 'Java fern' }))
    expect(screen.queryByRole('img', { name: 'Java fern' })).not.toBeInTheDocument()
    expect(glyph()).toBeInTheDocument()
  })
})
