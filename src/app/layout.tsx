import type { Metadata, Viewport } from 'next'
import { Fraunces, Geist } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { StickyCta } from '@/components/StickyCta'
import { site } from '@/lib/site'

const serif = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.title, template: '%s | Tilchi' },
  description: site.description,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: site.url,
    siteName: 'Tilchi',
    locale: site.locale,
    title: 'Tilchi — online ingliz tili darslari',
    description: 'CELTA · IELTS 7.0 · C1. Bolalar, IELTS va kattalar uchun. Birinchi dars bepul.',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Tilchi — Mukhtasar Karimjonova bilan online ingliz tili darslari',
      },
    ],
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
  icons: { icon: '/icon.svg' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: site.themeColor,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={`${serif.variable} ${geist.variable}`}>
      <body>
        <div className="grain" aria-hidden="true" />
        <a href="#main" className="skip">
          Asosiy kontentga o'tish
        </a>
        <Nav />
        <main id="main">{children}</main>
        <Footer />
        <StickyCta />
      </body>
    </html>
  )
}
