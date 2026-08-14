import type { Metadata } from 'next'
// Self-hosted Nunito (shipped via npm) — no build-time or runtime call to Google Fonts.
import '@fontsource-variable/nunito'
import './globals.css'

export const metadata: Metadata = {
  title: 'PaperPath — CBSE, ICSE & State Board syllabus for Class 5 to 12',
  description:
    'Chapter-wise video lectures, an AI tutor that knows the chapter you are on, and progress tracking across every subject.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full font-sans">{children}</body>
    </html>
  )
}
