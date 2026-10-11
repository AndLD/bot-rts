import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json', 'node'],
  moduleNameMapper: { '^@lib/(.*)$': '<rootDir>/../lib/$1' },
  modulePathIgnorePatterns: ['<rootDir>/ts-built/'],
  testMatch: ['**/tests/**/*.test.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
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
    '!index.ts' // process entry point (bootstrap only)
  ],
  coverageReporters: ['text-summary', 'json-summary', 'lcov']
}

export default config
