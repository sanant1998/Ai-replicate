import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root. Without it Turbopack infers one from the nearest
    // lockfile, which changes if a stray lockfile appears or disappears above
    // this directory — and a changed root moves where `.next` is written.
    root: path.resolve(import.meta.dirname),
  },
}

export default nextConfig
