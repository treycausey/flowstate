import './globals.css'
import type { Metadata, Viewport } from 'next'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import InitSeed from '@/components/InitSeed'
import { TankProvider } from '@/components/TankProvider'
import ThemeToggle from '@/components/ThemeToggle'

export const metadata: Metadata = {
  title: 'Flowstate',
  description: 'Flowstate — local-first freshwater aquarium chemistry tracker',
  manifest: '/manifest.webmanifest',
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
