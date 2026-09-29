import './globals.css'
import type { Metadata, Viewport } from 'next'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import { TankProvider } from '@/components/TankProvider'
import NavBar from '@/components/NavBar'
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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0f14' },
  ],
}

// Apply the saved theme before first paint to avoid a light/dark flash
const themeScript = `try{var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',t==='light'||t==='dark'?t:'system')}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ServiceWorkerRegister />
        <TankProvider>
          <TauriNavigationBridge />
          <NavBar />
          {children}
        </TankProvider>
      </body>
    </html>
  )
}
