'use client'

import TankSeries from '@/components/charts/TankSeries'
import ReadingList from '@/components/ReadingList'
import TankFromQuery from '@/components/TankFromQuery'
import TankSwitcher from '@/components/TankSwitcher'

export default function TankDetailClient() {
  return (
    <>
      <TankFromQuery />
      <TankSwitcher />
      <TankSeries />
      <ReadingList limit={20} />
    </>
  )
}
