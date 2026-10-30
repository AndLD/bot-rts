import assert from 'node:assert/strict'
import { test } from 'node:test'
import { planGate, rangesOfPush } from './local-gate-lib.mjs'

const packages = ['api', 'client', 'mcp']
const plan = (files, gone = []) =>
  planGate(files, { packages, integration: 'develop', exists: (file) => !gone.includes(file) })
const labels = (result) => result.steps.map((step) => step.label)

test('a push that changes no file runs no code check (the empty claim push)', () => {
  const result = plan([])
  assert.match(result.skip, /no file/)
  assert.deepEqual(result.steps, [])
  assert.match(plan(['', '']).skip, /no file/)
})

test('a push that changes only Markdown runs no code check', () => {
  const result = plan(['docs/profile.md', 'README.md'])
  assert.match(result.skip, /only Markdown/)
  assert.deepEqual(result.steps, [])
})

test('one client file runs the client checks and its related tests, and nothing of api or mcp', () => {
  const result = plan(['client/src/features/map/Map.tsx'])
  assert.equal(result.skip, null)
  assert.deepEqual(result.coveragePackages, ['client'])
  const related = result.steps.find((step) => step.args?.includes('--findRelatedTests'))
  assert.equal(related.cwd, 'client')
  assert.deepEqual(related.args.slice(related.args.indexOf('--findRelatedTests') + 1), ['src/features/map/Map.tsx'])
  assert.ok(
    related.args.includes('--coverageThreshold={}'),
    'the package gate is CI’s, the changed files are held to the gate below'
  )
  assert.ok(labels(result).includes('typecheck client') && labels(result).includes('lint client'))
  assert.ok(!labels(result).some((label) => /api|mcp/.test(label)))
  assert.ok(!result.steps.some((step) => step.needsDatabase), 'no database for a client change')
  assert.ok(result.steps.some((step) => step.args?.includes('scripts/check-changed-coverage.mjs')))
})

test('the related tests of a package get every changed file of it, relative to the package', () => {
  const result = plan(['api/src/a.ts', 'api/src/b.test.ts', 'client/src/c.ts'])
  const apiTests = result.steps.find((step) => step.cwd === 'api')
  assert.deepEqual(apiTests.args.slice(apiTests.args.indexOf('--findRelatedTests') + 1), ['src/a.ts', 'src/b.test.ts'])
  assert.equal(apiTests.needsDatabase, true)
  assert.deepEqual(result.coveragePackages, ['api', 'client'])
})

test('a file that cannot be followed to its tests runs the whole package', () => {
  for (const file of [
    'api/package.json',
    'client/jest.config.ts',
    'client/messages/en.json',
    'api/prisma/schema.prisma'
  ]) {
    const result = plan([file])
    const tests = result.steps.find((step) => step.args?.includes('test:coverage'))
    assert.deepEqual(tests.args, ['run', 'test:coverage', '-w', file.split('/')[0]], file)
  }
})

test('a deleted source file runs the whole package, since it has no related tests to find', () => {
  const result = plan(['mcp/src/old.ts'], ['mcp/src/old.ts'])
  assert.ok(result.steps.some((step) => step.args?.join(' ') === 'run test:coverage -w mcp'))
})

test('a change outside the packages (lib, root files, hooks) runs everything', () => {
  for (const file of ['lib/src/index.ts', 'package-lock.json', '.githooks/pre-push', 'tsconfig.base.json']) {
    const result = plan([file])
    assert.deepEqual(result.coveragePackages, packages, file)
    assert.ok(
      result.steps.some((step) => step.args?.join(' ') === 'run typecheck'),
      file
    )
    for (const pkg of packages) {
      assert.ok(
        result.steps.some((step) => step.args?.join(' ') === `run test:coverage -w ${pkg}`),
        `${file} ${pkg}`
      )
    }
  }
})

test('scripts and documentation sources alone run no package test; scripts run the script tests', () => {
  const result = plan(['scripts/local-gate.mjs', 'scripts/local-gate-lib.test.mjs'])
  assert.deepEqual(result.coveragePackages, [])
  assert.ok(labels(result).includes('script tests'))
  assert.ok(!labels(result).some((label) => label.startsWith('typecheck')))
})

test('a change in the framework staging folder runs the framework tests and the format check, and nothing else', () => {
  const result = plan([
    'docs/harness-framework/framework/tools/lib/x.mjs',
    'docs/harness-framework/framework/README.md'
  ])
  assert.deepEqual(labels(result), ['format changed files', 'framework tests'])
  assert.deepEqual(result.coveragePackages, [])
  assert.ok(!plan(['scripts/x.mjs']).steps.some((step) => step.label === 'framework tests'))
  assert.ok(
    plan(['api/src/x.ts', 'docs/harness-framework/framework/framework.json']).steps.some(
      (step) => step.label === 'framework tests'
    )
  )
})

test('a push that changes only Markdown of the framework staging folder runs no code check', () => {
  assert.match(plan(['docs/harness-framework/framework/README.md']).skip, /only Markdown/)
})

test('a Cypress spec is typechecked and linted with its package but has no Jest tests', () => {
  const result = plan(['client/cypress/e2e/map.cy.ts'])
  assert.ok(labels(result).includes('typecheck client'))
  assert.deepEqual(result.coveragePackages, [])
  assert.ok(!result.steps.some((step) => step.args?.includes('--findRelatedTests')))
})

test('the generated files are checked unless the change stays in mcp or scripts', () => {
  assert.ok(plan(['api/src/x.ts']).steps.some((step) => step.generated))
  assert.ok(plan(['docs/product-knowledge/x.json']).steps.some((step) => step.generated))
  assert.ok(!plan(['mcp/src/x.ts']).steps.some((step) => step.generated))
  assert.ok(!plan(['scripts/x.mjs']).steps.some((step) => step.generated))
})

test('the CI configuration alone needs no package check', () => {
  const result = plan(['.github/workflows/ci.yml'])
  assert.equal(result.skip, null)
  assert.deepEqual(result.coveragePackages, [])
})

test('rangesOfPush reads the refs of a push: new branches against the integration branch, deletions skipped', () => {
  const zero = '0'.repeat(40)
  const stdin = [
    `refs/heads/a aaaa refs/heads/a ${zero}`,
    `refs/heads/b bbbb refs/heads/b cccc`,
    `refs/heads/c ${zero} refs/heads/c dddd`,
    ''
  ].join('\n')
  assert.deepEqual(rangesOfPush(stdin, 'develop'), ['origin/develop..aaaa', 'cccc..bbbb'])
  assert.deepEqual(rangesOfPush('', 'develop'), [])
})
