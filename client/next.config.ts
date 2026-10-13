import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  // The repository's own AGENTS.md is the source of truth; do not let `next dev` write a second one
  agentRules: false,
  // The shared `lib` package sits next to the app and is imported through the `@lib` alias
  experimental: { externalDir: true },
  // The end-to-end run builds into a folder of its own, so that it never overwrites a running `next dev`
  distDir: process.env.NEXT_DIST_DIR ?? '.next'
}

export default config
