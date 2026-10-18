import nextJest from 'next/jest.js'
import type { Config } from 'jest'
// The coverage gate of the project profile (docs/profile.md), shared with scripts/check-changed-coverage.mjs
import coverageGate from '../scripts/coverage-threshold.json'

// Loads next.config.ts and the env files, and compiles TS/TSX with SWC
const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  // The slowest client test takes about one second (jest.setup.ts keeps the Ant Design style rules out of jsdom); this leaves room for a busy CI runner
  testTimeout: 30000,
  testEnvironment: 'jest-environment-jsdom',
  setupFiles: ['<rootDir>/jest.env.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@lib/(.*)$': '<rootDir>/../lib/$1',
    '\\.(css|scss)$': '<rootDir>/tests/style-mock.ts'
  },
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/cypress/'],
  // The single list of coverage exclusions (docs/engineering/stack.md §4); every entry has a reason
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}', // tests themselves
    '!src/**/*.d.ts', // type declarations
    '!src/app/**/page.tsx', // Next.js route entry points: each only re-exports a feature component that is tested
    '!src/app/**/layout.tsx', // the layouts of the route groups render <html>, which only a Next.js server render can host
    '!src/shared/api/generated.ts' // generated from the OpenAPI document of the API (npm run api:generate)
  ],
  coverageThreshold: { global: coverageGate },
  coverageReporters: ['text-summary', 'json-summary', 'lcov']
}

// next-intl ships ES modules only, so it has to go through the transformer as well
export default async () => {
  const resolved = await createJestConfig(config)()

  return {
    ...resolved,
    transformIgnorePatterns: [
      '/node_modules/(?!(next-intl|use-intl|@formatjs|intl-messageformat)/)',
      '^.+\\.module\\.(css|sass|scss)$'
    ]
  }
}
