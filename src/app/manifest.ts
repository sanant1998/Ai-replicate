import type { MetadataRoute } from 'next'

/**
 * Makes the site installable from the browser's "Add to home screen".
 *
 * That matters more here than it looks. The students are on Android phones,
 * often shared, often with a home screen that is the whole of how they navigate
 * — and a bookmark buried in a browser menu is a lesson they do not come back
 * to. Installing costs nothing and removes a step from every session.
 *
 * Deliberately no service worker. Offline video is the thing students would
 * actually want, and it is not a caching problem: the stream is served through
 * an expiring, account-bound ticket precisely so it cannot be kept, and making
 * it keepable is a licensing decision before it is an engineering one. A worker
 * that cached only the shell would put a stale, signed-out-looking app in front
 * of anyone on a bad connection, which is worse than the browser's own error.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PaperPath — chapter-wise lessons for the CBSE syllabus',
    short_name: 'PaperPath',
    description:
      'Chapter-wise video lectures, an AI tutor that knows the chapter you are on, and quizzes that mark themselves.',
    // The catalog rather than the marketing page: someone who installed this
    // has already been sold.
    start_url: '/academic',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#e8d5b7',
    theme_color: '#ea580c',
    lang: 'en-IN',
    categories: ['education'],
    icons: [
      {
        // The favicon is the only mark that exists; pointing at PNGs that are
        // not in public/ would give installers a broken icon rather than a
        // small one.
        src: '/favicon.ico',
        sizes: '48x48',
        type: 'image/x-icon',
      },
    ],
  }
}
