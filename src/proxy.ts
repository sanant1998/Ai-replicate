import { NextResponse, type NextRequest } from 'next/server'

/**
 * Security headers, and the nonce the Content-Security-Policy is built around.
 *
 * A nonce has to be minted per request, which is why this lives in the proxy
 * rather than next.config.ts: Next reads the nonce back out of the request's
 * CSP header during render and stamps it onto its own framework and bundle
 * scripts, so nothing here has to be threaded through the component tree.
 *
 * The cost is that nonced pages must render dynamically. That is close to free
 * here — almost every page already reads the session cookie — but it does mean
 * the handful of purely static pages (/terms, /privacy, /pricing) stop being
 * statically optimised. Bought knowingly: this app holds children's data behind
 * a payment flow, and 'unsafe-inline' on script-src would leave the main thing
 * CSP exists to stop wide open.
 */

/**
 * Hosts the video player streams from. hls.js resolves segment URLs against the
 * manifest it finally loaded, so after /api/video/[topicId] redirects to the CDN
 * every segment is fetched cross-origin and connect-src has to name that host —
 * 'self' only covers the redirect hop. Space-separated; set it when you swap
 * `upstreamUrl()` for a real provider.
 */
const MEDIA_ORIGINS = (
  process.env.MEDIA_ORIGINS ?? 'https://test-streams.mux.dev'
).trim()

const RAZORPAY = 'https://checkout.razorpay.com https://api.razorpay.com'

function csp(nonce: string, isDev: boolean) {
  return [
    `default-src 'self'`,
    // strict-dynamic lets a trusted script load more scripts, which is how the
    // Razorpay checkout tag gets in — PlanCard injects it from bundle code that
    // already carries the nonce. Browsers that honour strict-dynamic ignore the
    // host list; the ones that don't fall back to it, so both are named.
    // wasm-unsafe-eval is Ketcher's chemistry engine, which is WebAssembly.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval' ${RAZORPAY}${isDev ? " 'unsafe-eval'" : ''}`,
    // Inline style attributes, not inline scripts: subject cards colour
    // themselves from hex values held in the database, and React writes those
    // as style="". Nonces cannot cover attributes, and CSS injection is a far
    // smaller problem than script injection.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self' data:`,
    // blob: is hls.js — it drives the <video> element through a MediaSource
    // object URL rather than a network URL.
    `media-src 'self' blob: ${MEDIA_ORIGINS}`,
    `connect-src 'self' ${MEDIA_ORIGINS} ${RAZORPAY}`,
    // Razorpay renders its card form in an iframe on our page.
    `frame-src 'self' https://*.razorpay.com`,
    // hls.js runs its demuxer in a worker created from a blob.
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self' ${RAZORPAY}`,
    `frame-ancestors 'none'`,
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ')
}

export function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development'
  const nonce = crypto.randomUUID().replaceAll('-', '')
  const policy = csp(nonce, isDev)

  // Next parses the nonce out of the CSP on the *request* to stamp its own
  // script tags, so it has to be set on both request and response.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', policy)

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  response.headers.set('Content-Security-Policy', policy)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  )
  // Only meaningful over TLS, and actively harmful on a plain-HTTP dev server:
  // one visit would pin localhost to https for the browser's whole cache.
  if (!isDev) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    )
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Everything the browser renders as a document. Excluded:
     * - api        — JSON and SSE, no HTML to inject into
     * - _next/*    — build output served straight from disk
     * - static assets by extension
     * Prefetches are skipped too: they produce no document to nonce.
     */
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
