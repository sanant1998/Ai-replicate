import type { MetadataRoute } from 'next'
import { appOrigin } from '@/lib/origin'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await appOrigin()

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Everything behind sign-in, plus the routes that carry single-use
        // tokens in the query string. A crawler that follows a confirmation
        // link out of a leaked referrer would spend the token.
        //
        // /academic and /learn are deliberately left crawlable: the catalog and
        // the free first chapter of every course are the pages a parent
        // searching "class 8 science chapter 1" should land on. A locked lesson
        // renders its paywall to a crawler, which is a sales page, not a leak.
        disallow: [
          '/api/',
          '/admin',
          '/profile',
          '/notes',
          '/history',
          '/performance',
          '/checkout',
          '/tutor',
          '/quiz/',
          '/reset-password',
          '/verify-email',
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  }
}
