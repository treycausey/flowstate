'use client'

import { useTanks } from '@/components/TankProvider'

/** Shows why the local data could not be opened, on every page, instead of an empty screen. */
export default function StorageError() {
  const { loadError } = useTanks()
  if (!loadError) return null
  return (
    <p role="alert" className="danger">
      Couldn&apos;t open your data. {loadError}
    </p>
  )
}
