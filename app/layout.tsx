import './globals.css'
import type { Metadata, Viewport } from 'next'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import InitSeed from '@/components/InitSeed'
import { TankProvider } from '@/components/TankProvider'
import ThemeToggle from '@/components/ThemeToggle'
import TauriNavigationBridge from '@/components/TauriNavigationBridge'

export const metadata: Metadata = {
  title: 'Flowstate',
  description: 'Flowstate — local-first freshwater aquarium chemistry tracker',
  manifest: '/manifest.webmanifest',
  // iOS Safari ignores SVG for apple-touch-icon; the home-screen icon must be PNG.
  appleWebApp: { capable: true, title: 'Flowstate', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0ea5e9',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegister />
        <InitSeed />
        <TankProvider>
          <TauriNavigationBridge />
          <header className="container" style={{ padding: '0.5rem 0' }}>
            <div className="cluster" style={{ justifyContent: 'flex-end' }}>
              <ThemeToggle />
            </div>
          </header>
          {children}
        </TankProvider>
      </body>
    </html>
  )
}
