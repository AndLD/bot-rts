import type { Config } from 'jest'

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
      globalSetup: '<rootDir>/tests/integration/global-setup.ts'
    }
  ],
  // The single list of coverage exclusions (AGENTS.md §6.1); every entry has a reason
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
    '!prisma/**', // seed script and migrations
    '!scripts/**' // command line entry points
  ],
  // The gate of AGENTS.md §6.1, per package
  coverageThreshold: { global: { statements: 97, branches: 97, functions: 97, lines: 97 } },
  coverageReporters: ['text-summary', 'json-summary', 'lcov']
}

export default config
