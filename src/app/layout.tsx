import type { Metadata, Viewport } from 'next'
import { Barlow_Condensed, Inter } from 'next/font/google'
import './globals.css'

/**
 * Two families, clearly distinct. Barlow Condensed carries every figure —
 * race bibs, result sheets and split tables are all set condensed, so it is
 * the native typography of the sport. Inter stays neutral on purpose.
 * Self-hosted by next/font: no third-party request, no layout shift.
 */
const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const condensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-condensed',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Runna Web — your running coach',
  description:
    'A training plan built around how much you can actually run, that updates when that changes.',
}

export const viewport: Viewport = {
  themeColor: '#0f141b',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${condensed.variable}`}>
      <body className="min-h-dvh bg-ink font-[family-name:var(--font-sans)] text-chalk antialiased">
        {children}
      </body>
    </html>
  )
}
