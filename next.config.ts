import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Don't advertise the framework and version to anyone scanning for known CVEs.
  poweredByHeader: false,
  // The verification suite drives the app over 127.0.0.1 while the dev server's
  // own origin is localhost, so Next blocks its HMR resources as cross-origin
  // and the browser logs 403s. Both spellings name this machine; listing them
  // keeps that noise out of the console-error check. Dev-only setting.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  experimental: {
    serverActions: {
      // Topic material is pasted whole and has no length cap of its own, so the
      // 1MB default would be the cap — and it would surface as a failed request
      // rather than a message. A page of notes is nowhere near this.
      bodySizeLimit: '10mb',
    },
  },
  turbopack: {
    // Pin the workspace root. Without it Turbopack infers one from the nearest
    // lockfile, which changes if a stray lockfile appears or disappears above
    // this directory — and a changed root moves where `.next` is written.
    root: path.resolve(import.meta.dirname),
  },
}

export default nextConfig
