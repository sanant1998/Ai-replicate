import type { Metadata } from 'next'
// Self-hosted Nunito (shipped via npm) — no build-time or runtime call to Google Fonts.
import '@fontsource-variable/nunito'
import './globals.css'
import { reportProductionConfig } from '@/lib/config'

export const metadata: Metadata = {
  // Resolves the relative URLs in per-page openGraph blocks. Without it Next
  // warns at build time and emits OG tags no crawler can follow.
  metadataBase: process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN) : undefined,
  title: {
    default: 'PaperPath — CBSE, ICSE & State Board syllabus for Class 5 to 12',
    // Pages that set a bare title get the brand appended; the ones that need a
    // keyword-led title (lessons, catalog) set an absolute string instead.
    template: '%s | PaperPath',
  },
  description:
    'Chapter-wise video lectures, an AI tutor that knows the chapter you are on, and progress tracking across every subject.',
  openGraph: {
    siteName: 'PaperPath',
    locale: 'en_IN',
    type: 'website',
  },
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  // Once per process, and only in production: names the settings that are
  // missing rather than letting the deployment look healthy while password
  // reset mails nobody and the rate limiter counts nothing.
  reportProductionConfig()

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full font-sans">{children}</body>
    </html>
  )
}
