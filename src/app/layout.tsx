import type { Metadata } from 'next'
// Self-hosted Nunito (shipped via npm) — no build-time or runtime call to Google Fonts.
import '@fontsource-variable/nunito'
import './globals.css'
import { headers } from 'next/headers'
import { reportProductionConfig } from '@/lib/config'
import { THEME_KEY } from '@/lib/theme'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/session'
import { DEFAULT_LANGUAGE, languageOf } from '@/lib/language'

export const metadata: Metadata = {
  // Resolves the relative URLs in per-page openGraph blocks. Without it Next
  // warns at build time and emits OG tags no crawler can follow.
  metadataBase: process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN) : undefined,
  title: {
    // Names the board the catalog actually carries. Titling the site for ICSE
    // and state boards it has no content for is a promise the first click
    // breaks, and search engines treat a bounce from a title like that exactly
    // as badly as a reader does. Widen it when the content is there — the admin
    // panel can add a board now, so it is no longer a code change.
    default: 'PaperPath — CBSE syllabus video lessons for Class 5 to 12',
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

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // Once per process, and only in production: names the settings that are
  // missing rather than letting the deployment look healthy while password
  // reset mails nobody and the rate limiter counts nothing.
  reportProductionConfig()

  // `lang` was hard-coded to "en" while the account carried a language the app
  // never read. It matters to more than tidiness: screen readers pick a voice
  // from it, and browsers offer to translate a page based on it — so a Hindi
  // student's tutor answers were being announced by an English synthesiser.
  const session = await readSession()
  const language = session
    ? languageOf(
        (
          await prisma.user.findUnique({
            where: { id: session.uid },
            select: { language: true },
          })
        )?.language,
      ).tag
    : DEFAULT_LANGUAGE

  // The CSP nonce the proxy minted for this request. Needed because the theme
  // script below has to be inline: it must run before the first paint, and an
  // external file cannot beat the paint.
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    // suppressHydrationWarning because the script below writes data-theme onto
    // this element before React sees it. That is the point — without it the
    // page paints in the wrong theme and then corrects itself, which is the
    // white flash every dark-mode implementation is judged on.
    <html lang={language} className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          // A stored choice outranks the operating system; with no stored
          // choice, nothing is set and the CSS media query decides. Wrapped in
          // try/catch because localStorage throws outright in some private
          // browsing modes, and a theme is not worth a blank page.
          dangerouslySetInnerHTML={{
            // JSON.stringify rather than quoting by hand: it is the only way to
            // embed a value in a script and be certain the result still parses.
            __html: `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  )
}
