import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter, Newsreader } from 'next/font/google'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import { TankProvider } from '@/components/TankProvider'
import TankHost from '@/components/tank/TankHost'
import NavBar from '@/components/NavBar'
import StorageError from '@/components/StorageError'
import PanelShell from '@/components/PanelShell'
import TauriNavigationBridge from '@/components/TauriNavigationBridge'
import { PHASE_SCRIPT } from '@/lib/tank/phaseScript'

// Self-hosted at build time (works offline and inside Tauri)
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
  display: 'swap',
})

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
  // Edge-to-edge under the notch and home indicator (iOS app); CSS pads with env(safe-area-inset-*)
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#dfe6dc' },
    { media: '(prefers-color-scheme: dark)', color: '#0b141b' },
  ],
}

// Apply the saved theme and the time-of-day phase before first paint to avoid a light/dark flash
const themeScript = `try{var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',t==='light'||t==='dark'?t:'system')}catch(e){}${PHASE_SCRIPT}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {/* Static fallback scene; the WebGL canvas mounts in #tank-canvas-slot */}
        <div className="tank-layer" aria-hidden="true">
          <div id="tank-canvas-slot" />
        </div>
        <ServiceWorkerRegister />
        <TankProvider>
          <TauriNavigationBridge />
          <TankHost />
          <PanelShell>
            <NavBar />
            <StorageError />
            {children}
          </PanelShell>
        </TankProvider>
      </body>
    </html>
  )
}
