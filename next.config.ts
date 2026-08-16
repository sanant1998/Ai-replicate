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
  turbopack: {
    // Pin the workspace root. Without it Turbopack infers one from the nearest
    // lockfile, which changes if a stray lockfile appears or disappears above
    // this directory — and a changed root moves where `.next` is written.
    root: path.resolve(import.meta.dirname),
  },
}

export default nextConfig
