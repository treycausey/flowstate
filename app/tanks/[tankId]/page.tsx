import TankDetailClient from '@/components/TankDetailClient'

export default async function TankDetailPage({
  params,
}: {
  params: Promise<{ tankId: string }>
}) {
  const { tankId } = await params
  // The SmallMultiples component expects series data; for v1, compute client‑side
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Tank {tankId}</h1>
      <TankDetailClient />
    </main>
  )
}
