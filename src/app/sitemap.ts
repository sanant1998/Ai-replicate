import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { appOrigin } from '@/lib/origin'

/**
 * Rebuilt hourly rather than per request: the catalog changes when a teacher
 * publishes a chapter, not when a crawler calls.
 */
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await appOrigin()

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${origin}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${origin}/academic`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${origin}/courses`, changeFrequency: 'weekly', priority: 0.8 },
    // /pricing is not listed: it renders nothing and only ever redirects into
    // /checkout, which robots.txt disallows. Advertising a URL whose sole job is
    // to bounce a crawler into a blocked path wastes the crawl and indexes
    // nothing. /courses carries the same prices and is a real page.
    { url: `${origin}/login`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${origin}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${origin}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
  ]

  // Only lessons inside a free chapter. A locked lesson is a paywall to a
  // signed-out crawler, so listing it would fill the index with pages that all
  // say the same thing — and dilute the free chapters that are the actual
  // landing pages.
  const freeTopics = await prisma.topic.findMany({
    where: { chapter: { isFree: true }, videoUrl: { not: null } },
    select: { id: true },
    orderBy: { id: 'asc' },
    take: 5000,
  })

  return [
    ...staticPages,
    ...freeTopics.map((topic) => ({
      url: `${origin}/learn/${topic.id}`,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ]
}
