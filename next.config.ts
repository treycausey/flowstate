import type { NextConfig } from 'next'
import path from 'path'
import bundleAnalyzer from '@next/bundle-analyzer'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  outputFileTracingRoot: path.join(__dirname),
}
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })
export default withBundleAnalyzer(nextConfig)
