import assert from 'node:assert/strict'
import { test } from 'node:test'
import { plan } from './gate.mjs'

const packages = ['api', 'client', 'mcp']
const isolated = (file) => file.startsWith('scripts/') || file.startsWith('docs/')
const run = (files, gone = []) =>
  plan({ files, packages, integration: 'develop', exists: (file) => !gone.includes(file), isolated })
const labels = (result) => result.steps.map((step) => step.label)
const commandLine = (step) => [step.command, ...step.args].join(' ')

test('one client file runs the client checks and its related tests, and nothing of api or mcp', () => {
  const result = run(['client/src/features/map/Map.tsx'])
  assert.deepEqual(result.coveragePackages, ['client'])
  const related = result.steps.find((step) => step.args.includes('--findRelatedTests'))
  assert.equal(related.cwd, 'client')
  assert.deepEqual(related.args.slice(related.args.indexOf('--findRelatedTests') + 1), ['src/features/map/Map.tsx'])
  assert.ok(
    related.args.includes('--coverageThreshold={}'),
    'the package gate is CI’s, the changed files are held to the gate below'
  )
  assert.ok(labels(run(['client/src/x.ts'])).includes('typecheck client'))
  assert.ok(!labels(result).some((label) => /api|mcp/.test(label)))
  assert.deepEqual(
    related.clears,
    ['client/coverage/coverage-summary.json'],
    'a run with no related tests leaves no old summary to be judged'
  )
  const coverage = result.steps.at(-1)
  assert.deepEqual(
    [coverage.command, ...coverage.args],
    ['harness', 'coverage', 'check-changed', '--skip-missing', 'origin/develop', 'client']
  )
})

test('the related tests of a package get every changed file of it, relative to the package', () => {
  const result = run(['api/src/a.ts', 'api/src/b.test.ts', 'client/src/c.ts'])
  const apiTests = result.steps.find((step) => step.cwd === 'api')
  assert.deepEqual(apiTests.args.slice(apiTests.args.indexOf('--findRelatedTests') + 1), ['src/a.ts', 'src/b.test.ts'])
  assert.equal(apiTests.package, 'api', 'the driver gives a step the needs of its package (a database for api)')
  assert.deepEqual(result.coveragePackages, ['api', 'client'])
})

test('a file that cannot be followed to its tests runs the whole package', () => {
  for (const file of [
    'api/package.json',
    'client/jest.config.ts',
    'client/messages/en.json',
    'api/prisma/schema.prisma'
  ]) {
    const tests = run([file]).steps.find((step) => step.args.includes('test:coverage'))
    assert.equal(commandLine(tests), `npm run test:coverage -w ${file.split('/')[0]}`, file)
  }
})

test('a deleted source file runs the whole package, since it has no related tests to find', () => {
  const result = run(['mcp/src/old.ts'], ['mcp/src/old.ts'])
  assert.ok(result.steps.some((step) => commandLine(step) === 'npm run test:coverage -w mcp'))
})

test('a change outside the packages (lib, root files, hooks) runs everything', () => {
  for (const file of ['lib/src/index.ts', 'package-lock.json', '.githooks/pre-push', 'tsconfig.base.json']) {
    const result = run([file])
    assert.deepEqual(result.coveragePackages, packages, file)
    assert.ok(
      result.steps.some((step) => commandLine(step) === 'npm run typecheck'),
      file
    )
    for (const pkg of packages) {
      assert.ok(
        result.steps.some((step) => commandLine(step) === `npm run test:coverage -w ${pkg}`),
        `${file} ${pkg}`
      )
    }
  }
})

test('files the project calls isolated trigger no package test and no full run', () => {
  const result = run(['scripts/x.mjs', 'docs/x.json'])
  assert.deepEqual(result.coveragePackages, [])
  assert.deepEqual(labels(result), ['format changed files'])
})

test('the format check runs from the installation of the project and never downloads a formatter', () => {
  const format = run(['scripts/x.mjs']).steps[0]
  assert.deepEqual(format.args.slice(0, 2), ['--no-install', 'prettier'])
  assert.equal(format.args.at(-1), 'scripts/x.mjs')
  assert.ok(
    !labels(run(['scripts/x.mjs'], ['scripts/x.mjs'])).includes('format changed files'),
    'a deleted file is not formatted'
  )
})

test('a Cypress spec is typechecked and linted with its package but has no Jest tests', () => {
  const result = run(['client/cypress/e2e/map.cy.ts'])
  assert.ok(labels(result).includes('typecheck client'))
  assert.deepEqual(result.coveragePackages, [])
  assert.ok(!result.steps.some((step) => step.args.includes('--findRelatedTests')))
})

test('a stack that owns only some folders plans only for those', () => {
  const result = plan({ files: ['api/src/a.ts'], packages: ['api'], integration: 'main', exists: () => true })
  assert.deepEqual(result.coveragePackages, ['api'])
  assert.ok(result.steps.at(-1).args.includes('origin/main'))
})
