import nextJest from 'next/jest.js'
import type { Config } from 'jest'

// Loads next.config.ts and the env files, and compiles TS/TSX with SWC
const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testTimeout: 15000,
  testEnvironment: 'jest-environment-jsdom',
  setupFiles: ['<rootDir>/jest.env.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@lib/(.*)$': '<rootDir>/../lib/$1',
    '\\.(css|scss)$': '<rootDir>/tests/style-mock.ts'
  },
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/cypress/'],
  // The single list of coverage exclusions (AGENTS.md §6.1); every entry has a reason
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}', // tests themselves
    '!src/**/*.d.ts', // type declarations
    '!src/app/**/page.tsx', // Next.js route entry points: each only re-exports a feature component that is tested
    '!src/app/layout.tsx', // the root layout renders <html>, which only a Next.js server render can host
    '!src/shared/api/generated.ts' // generated from the OpenAPI document of the API (npm run api:generate)
  ],
  coverageThreshold: { global: { statements: 97, branches: 97, functions: 97, lines: 97 } },
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
