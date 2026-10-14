import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json', diagnostics: { ignoreCodes: [151002] } }] },
  testMatch: ['**/*.test.ts'],
  modulePathIgnorePatterns: ['<rootDir>/ts-built/'],
  // The gate of AGENTS.md §6.1, per package; the exclusions each have a reason
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts', // tests themselves
    '!src/test-support.ts', // helper of the tests
    '!src/index.ts' // process entry point: reads the environment and starts the server (the logic is in start.ts)
  ],
  coverageThreshold: { global: { statements: 97, branches: 97, functions: 97, lines: 97 } },
  coverageReporters: ['text-summary', 'json-summary', 'lcov']
}

export default config
