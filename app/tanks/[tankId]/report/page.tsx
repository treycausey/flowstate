import ReportClient from '@/components/ReportClient'

export default async function ReportPage({
  params,
}: {
  params: Promise<{ tankId: string }>
}) {
  const { tankId } = await params
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Report</h1>
      <ReportClient initialTankId={tankId} />
    </main>
  )
}
