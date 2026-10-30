import type { Config } from 'jest'
// The coverage gate of the project profile (docs/profile.md), shared with scripts/check-changed-coverage.mjs
import { coverageGate } from '../harness-profile.json'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json', diagnostics: { ignoreCodes: [151002] } }] },
  testMatch: ['**/*.test.ts'],
  modulePathIgnorePatterns: ['<rootDir>/ts-built/'],
  // Coverage is gated per package; the exclusions each have a reason
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts', // tests themselves
    '!src/test-support.ts', // helper of the tests
    '!src/index.ts' // process entry point: reads the environment and starts the server (the logic is in start.ts)
  ],
  coverageThreshold: { global: coverageGate },
  // `json` is what scripts/merge-coverage.mjs merges across the CI shards
  coverageReporters: ['text-summary', 'json-summary', 'json', 'lcov']
}

export default config
