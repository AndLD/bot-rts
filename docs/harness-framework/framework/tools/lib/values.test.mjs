import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import { checkValues } from './values.mjs'

const profile = {
  adapters: { stacks: ['x'], host: 'github' },
  repository: { slug: 'owner/name' },
  branches: { production: 'prod', integration: 'dev' },
  paths: { plan: 'docs/plan', changelog: 'CHANGELOG.md', changelogFragments: 'docs/changes' },
  requiredChecks: ['verify', 'pr-title'],
  coveragePackages: ['alpha', 'beta'],
  checks: { roleOnlyPaths: ['.github/workflows/*', 'scripts/*.mjs', '!scripts/*.test.mjs', 'docs/guides/*.md'] }
}

const CI = (branches = 'dev, prod') => `name: CI
on:
  pull_request:
    branches: [${branches}]
  push:
    branches: [${branches}]
jobs:
  pr-title:
    runs-on: ubuntu-latest
  alpha:
    runs-on: ubuntu-latest
  verify:
    needs: [alpha]
    runs-on: ubuntu-latest
`

const dirs = []
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

// A project with the files given; the tracked files are the files written
function project(files, overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'values-'))
  dirs.push(root)
  const all = { '.github/workflows/ci.yml': CI(), ...files }
  for (const [path, text] of Object.entries(all)) {
    mkdirSync(join(root, dirname(path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  return checkValues({ root, profile: { ...profile, ...overrides }, files: Object.keys(all) }).problems
}

test('a project that names its values by role passes', () => {
  assert.deepEqual(
    project({
      'scripts/a.mjs': "import { profile } from './p.mjs'\n",
      'docs/guides/x.md': 'Merge into the integration branch.'
    }),
    []
  )
})

test('the host triggers must equal the protected branches', () => {
  const problems = project({ '.github/workflows/ci.yml': CI('dev, other') })
  assert.ok(
    problems.some((problem) =>
      /ci\.yml: the pull_request trigger lists dev, other, but the protected branches are dev, prod/.test(problem)
    )
  )
  assert.ok(
    project({ '.github/workflows/ci.yml': CI('dev') }).some((problem) => /the push trigger lists dev/.test(problem))
  )
})

test('a project without a workflow that triggers on pull requests and pushes fails', () => {
  const problems = project({
    '.github/workflows/ci.yml': 'on:\n  pull_request:\n    branches: [dev, prod]\njobs:\n  verify:\n  pr-title:\n'
  })
  assert.ok(problems.some((problem) => /both pull requests and pushes/.test(problem)))
})

test('a required check that is no job fails', () => {
  const problems = project({}, { requiredChecks: ['verify', 'pr-title', 'e2e'] })
  assert.deepEqual(problems, ['the required check "e2e" is not a job of any workflow'])
})

test('a branch, the repository or a plan path spelled out in a script fails, a comment line does not', () => {
  assert.deepEqual(project({ 'scripts/a.mjs': "// the 'dev' branch is meant here\nconst x = 1\n" }), [])
  for (const line of [
    "const b = 'dev'",
    'git diff origin/prod',
    'const r = "owner/name"',
    'read(`docs/plan/x.md`)',
    'refs/heads/dev'
  ]) {
    const problems = project({ 'scripts/a.mjs': `${line}\n` })
    assert.equal(problems.length, 1, line)
    assert.match(problems[0], /scripts\/a\.mjs:1: spells out a value of the profile file/)
  }
})

test('a test file is outside the role-only paths', () => {
  assert.deepEqual(project({ 'scripts/a.test.mjs': "const b = 'dev'\n" }), [])
})

test('a workflow names no protected branch outside its triggers', () => {
  const problems = project({ '.github/workflows/ci.yml': `${CI()}  extra:\n    if: github.ref == refs/x/dev\n` })
  assert.ok(problems.some((problem) => /names a protected branch outside a branches trigger/.test(problem)))
})

test('a workflow that lists the coverage packages fails; the needs list of jobs does not', () => {
  const listed = project({
    '.github/workflows/ci.yml': `${CI()}  coverage:\n    run: for pkg in alpha beta; do check; done\n`
  })
  assert.equal(listed.filter((problem) => /lists the coverage packages/.test(problem)).length, 1)
  assert.deepEqual(project({ '.github/workflows/ci.yml': CI().replace('needs: [alpha]', 'needs: [alpha, beta]') }), [])
  assert.deepEqual(
    project({ '.github/workflows/ci.yml': `${CI()}  c:\n    run: check alpha\n` }),
    [],
    'one package is not a list'
  )
})

test('Markdown names the branches by role outside code blocks, and may spell them inside', () => {
  const problems = project({
    'docs/guides/x.md': 'Run `dev` now.\n```sh\ngit checkout dev\n```\nThen merge into prod.\n'
  })
  assert.deepEqual(
    problems.map((problem) => problem.slice(0, 22)),
    ['docs/guides/x.md:1: na', 'docs/guides/x.md:5: na']
  )
})

test('a profile without branches or a host has no values to hold', () => {
  assert.match(checkValues({ root: '.', profile: {}, files: [] }).message, /no values to hold/)
})
