import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  // The repository's own AGENTS.md is the source of truth; do not let `next dev` write a second one
  agentRules: false,
  // The shared `lib` package sits next to the app and is imported through the `@lib` alias
  experimental: { externalDir: true }
}

export default config
