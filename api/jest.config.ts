import type { Config } from 'jest'
// The coverage gate of the project profile (docs/profile.md), shared with scripts/check-changed-coverage.mjs
import coverageGate from '../scripts/coverage-threshold.json'

const shared: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json', 'node'],
  moduleNameMapper: { '^@lib/(.*)$': '<rootDir>/../lib/$1' },
  modulePathIgnorePatterns: ['<rootDir>/ts-built/']
}

const config: Config = {
  testTimeout: 30000, // integration tests clone a database and migrate on first use
  projects: [
    {
      ...shared,
      displayName: 'unit',
      testMatch: ['**/?(*.)+(spec|test).ts?(x)'],
      testPathIgnorePatterns: ['/node_modules/', '\\.int\\.test\\.ts$']
    },
    {
      // Needs the PostgreSQL of docker-compose.yml (`npm run db:up`); in CI it is a service container
      ...shared,
      displayName: 'integration',
      testMatch: ['**/*.int.test.ts'],
      globalSetup: '<rootDir>/tests/integration/global-setup.ts',
      globalTeardown: '<rootDir>/tests/integration/global-teardown.ts'
    }
  ],
  // The single list of coverage exclusions (docs/engineering/stack.md §4); every entry has a reason
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.test.ts', // tests themselves
    '!tests/**', // test helpers
    '!**/*.d.ts', // type declarations
    '!ts-built/**', // build output
    '!node_modules/**',
    '!coverage/**',
    '!jest.config.ts', // config
    '!index.ts', // process entry point (bootstrap only)
    '!src/load-env.ts', // loads the .env file at process start (bootstrap only)
    '!src/engine/infrastructure/engine-worker.ts', // entry point of the engine thread; Jest cannot instrument a worker thread, the engine integration test runs it
    '!prisma/**', // seed script and migrations
    '!scripts/**' // command line entry points
  ],
  coverageThreshold: { global: coverageGate },
  coverageReporters: ['text-summary', 'json-summary', 'lcov']
}

export default config
