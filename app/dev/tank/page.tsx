import DevOnlyNotice from '@/components/DevOnlyNotice'
import TankDevClient from '@/components/tank/TankDevClient'

export const dynamic = 'force-static'

export default function DevTankPage() {
  if (process.env.NODE_ENV === 'production') return <DevOnlyNotice />
  return <TankDevClient />
}
