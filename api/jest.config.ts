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
  testMatch: ['**/tests/**/*.test.ts?(x)', '**/?(*.)+(spec|test).ts?(x)']
}

export default config
