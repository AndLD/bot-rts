import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import {
  changedFileFailures,
  mergeShards,
  parseArtifactName,
  shardsOf,
  summarizePackages,
  totalFailures
} from './coverage.mjs'

const GATE = { statements: 97, branches: 97, functions: 97, lines: 97 }
const metric = (pct) => ({ total: 100, covered: pct, skipped: 0, pct })
const entry = (pct) => ({ statements: metric(pct), branches: metric(pct), functions: metric(pct), lines: metric(pct) })

const dirs = []
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))
const cli = join(import.meta.dirname, '..', 'harness.mjs')

test('an artifact name gives the package, the shard and the shard count', () => {
  assert.deepEqual(parseArtifactName('coverage-client-2-of-3'), { pkg: 'client', index: 2, count: 3 })
  assert.deepEqual(parseArtifactName('coverage-api-1-of-1'), { pkg: 'api', index: 1, count: 1 })
  assert.equal(parseArtifactName('e2e-failure'), null)
})

test('the shards of a package are all its artifacts, and a missing shard is an error', () => {
  const names = ['coverage-api-1-of-1', 'coverage-client-1-of-3', 'coverage-client-3-of-3', 'coverage-client-2-of-3']
  assert.deepEqual(shardsOf('client', names), [
    'coverage-client-1-of-3',
    'coverage-client-3-of-3',
    'coverage-client-2-of-3'
  ])
  assert.throws(() => shardsOf('client', names.slice(0, 3)), /incomplete: found shards 1, 3 of 3/)
  assert.throws(() => shardsOf('mcp', names), /No coverage artifact for mcp/)
  assert.throws(() => shardsOf('api', ['coverage-api-1-of-2', 'coverage-api-1-of-1']), /incomplete/)
})

test('the gate reports each metric below the threshold and nothing at or above it; a metric the stack does not measure is not judged', () => {
  const ok = { ...entry(97), branches: metric(100), functions: metric(97.5) }
  assert.deepEqual(totalFailures(ok, GATE), [])
  assert.deepEqual(totalFailures({ ...ok, branches: metric(96.99) }, GATE), ['branches 96.99% (gate 97%)'])
  const linesOnly = { lines: metric(96) }
  assert.deepEqual(totalFailures(linesOnly, GATE), ['lines 96% (gate 97%)'])
})

test('a changed file below the gate on any metric is reported with its metrics; a file missing from the summary is excluded by the configuration', () => {
  const summary = {
    total: entry(99),
    '/r/api/src/a.ts': entry(99),
    '/r/api/src/b.ts': { ...entry(99), branches: metric(80) }
  }
  const result = changedFileFailures({
    summary,
    root: '/r',
    changed: ['api/src/a.ts', 'api/src/b.ts', 'api/src/types.ts', 'client/src/c.ts'],
    pkg: 'api',
    gate: GATE
  })
  assert.deepEqual(result, { failures: ['api/src/b.ts: branches 80% (gate 97%)'], checked: 2 })
})

// A project with a Git history, a profile that selects the node-ts stack, and a changed file with the given coverage
function project({ pct, summary = true }) {
  const root = mkdtempSync(join(tmpdir(), 'coverage-gate-'))
  dirs.push(root)
  const write = (path, content) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: root, stdio: 'pipe' })
  write(
    'harness-profile.json',
    JSON.stringify({ adapters: { stacks: ['node-ts'] }, coverageGate: GATE, coveragePackages: ['api'] })
  )
  write('api/src/a.ts', 'export const a = 1\n')
  git('init', '--quiet', '--initial-branch', 'develop')
  git('add', '.')
  git('commit', '--quiet', '-m', 'start')
  write('api/src/b.ts', 'export const b = 2\n')
  git('add', '.')
  git('commit', '--quiet', '-m', 'change')
  if (summary) {
    write(
      'api/coverage/coverage-summary.json',
      JSON.stringify({ total: entry(pct), [join(root, 'api/src/b.ts')]: entry(pct) })
    )
  }
  return root
}
const harness = (root, ...args) => spawnSync(process.execPath, [cli, ...args, '--root', root], { encoding: 'utf8' })

test('a coverage drop in a changed file fails the gate, and a file at the gate passes', () => {
  const low = harness(project({ pct: 90 }), 'coverage', 'check-changed', 'HEAD~1', 'api')
  assert.equal(low.status, 1)
  assert.match(low.stderr, /Changed files below the coverage gate:\napi\/src\/b\.ts: statements 90% \(gate 97%\)/)
  const fine = harness(project({ pct: 98 }), 'coverage', 'check-changed', 'HEAD~1', 'api')
  assert.equal(fine.status, 0, fine.stderr)
  assert.match(fine.stdout, /1 changed source files meet the coverage gate\./)
})

test('a missing summary is an error, unless the local gate skips the packages whose related tests found none', () => {
  const root = project({ pct: 100, summary: false })
  const strict = harness(root, 'coverage', 'check-changed', 'HEAD~1', 'api')
  assert.equal(strict.status, 2)
  assert.match(strict.stderr, /No coverage summary for api/)
  const skipping = harness(root, 'coverage', 'check-changed', '--skip-missing', 'HEAD~1', 'api')
  assert.equal(skipping.status, 0)
  assert.match(skipping.stdout, /No related tests ran in api, so its changed files are judged by CI\./)
})

// The shards of CI for the merge command
const at = (line) => ({ start: { line, column: 0 }, end: { line, column: 10 } })
const finalOf = (path, counts) => ({
  [path]: {
    path,
    statementMap: Object.fromEntries(counts.map((_, i) => [String(i), at(i + 1)])),
    s: Object.fromEntries(counts.map((count, i) => [String(i), count])),
    fnMap: {},
    f: {},
    branchMap: {},
    b: {}
  }
})

test('the merge command fails below the gate, passes above it and fails on a missing shard or on differing maps', () => {
  const root = project({ pct: 100, summary: false })
  const artifacts = join(root, 'artifacts')
  mkdirSync(artifacts)
  const shard = (name, final) => {
    mkdirSync(join(artifacts, name), { recursive: true })
    writeFileSync(join(artifacts, name, 'coverage-final.json'), JSON.stringify(final))
  }
  const merge = () => harness(root, 'coverage', 'merge', artifacts, 'api')

  shard('coverage-api-1-of-2', finalOf('/r/a.ts', [1, 1]))
  const missing = merge()
  assert.equal(missing.status, 2, 'the second shard is missing')
  assert.match(missing.stderr, /incomplete/)

  shard('coverage-api-2-of-2', finalOf('/r/b.ts', [0]))
  const below = merge()
  assert.equal(below.status, 1, '2 of 3 statements is below the gate')
  assert.match(below.stderr, /Coverage below the gate:\napi: statements 66\.66% \(gate 97%\)/)
  const summary = JSON.parse(readFileSync(join(root, 'api', 'coverage', 'coverage-summary.json'), 'utf8'))
  assert.equal(summary.total.statements.total, 3)
  assert.equal(summary.total.statements.covered, 2)

  // The same file covered by the other shard lifts the merged package to the gate
  shard('coverage-api-1-of-2', finalOf('/r/b.ts', [1]))
  shard('coverage-api-2-of-2', finalOf('/r/b.ts', [0]))
  const passed = merge()
  assert.equal(passed.status, 0, passed.stderr)
  assert.match(passed.stdout, /api: 2 shard\(s\) merged, 1 files; statements 1\/1 \(100%\)/)

  // A file that is not the same source in the two shards cannot be merged
  shard('coverage-api-2-of-2', finalOf('/r/b.ts', [0, 0]))
  const differing = merge()
  assert.equal(differing.status, 2, 'the statement maps differ')
  assert.match(differing.stderr, /the statementMap differs between shards/)
})

test('a package that no stack owns cannot be merged', () => {
  const root = project({ pct: 100, summary: false })
  writeFileSync(
    join(root, 'harness-profile.json'),
    JSON.stringify({ adapters: { stacks: ['unknown-stack'] }, coverageGate: GATE, coveragePackages: ['api'] })
  )
  mkdirSync(join(root, 'artifacts'))
  const result = harness(root, 'coverage', 'merge', join(root, 'artifacts'), 'api')
  assert.equal(result.status, 2)
  assert.match(result.stderr, /api: no stack adapter fills the coverage-merge role for it/)
})

test('a project with no coverage package has nothing to merge, and the folder of the artifacts need not exist', () => {
  const missing = join(tmpdir(), 'no-such-coverage-artifacts')
  const result = mergeShards({
    root: tmpdir(),
    profile: { coveragePackages: [], coverageGate: GATE },
    artifacts: missing,
    packages: []
  })
  assert.equal(result.code, 0)
  assert.deepEqual(result.problems, [])
  assert.match(result.messages[0], /No coverage packages in the profile file/)
})

test('summarize writes the neutral summary of the last run of a package, passes the project root and package to the stack, and skips a package with no raw coverage on request', () => {
  const seen = []
  const stack = {
    manifest: { roles: { 'coverage-merge': { module: 'coverage.mjs', export: 'merge' } } },
    modules: {
      'coverage.mjs': {
        SHARD_FILE: 'raw.json',
        merge: (shards, where) => {
          seen.push([shards, where])
          return { artifacts: { 'raw.json': { merged: true } }, summary: { total: {}, '/r/a.py': {} } }
        }
      }
    }
  }
  const profile = { adapters: { stacks: ['x'] }, coveragePackages: ['api'] }
  const root = mkdtempSync(join(tmpdir(), 'summarize-'))
  const run = (options = {}) => summarizePackages({ root, profile, packages: [], stacks: { x: stack }, ...options })

  assert.match(run().problems[0], /api: no raw\.json in api\/coverage/)
  assert.deepEqual(run({ skipMissing: true }), {
    code: 0,
    messages: ['No raw coverage in api, so there is nothing to summarize.'],
    problems: []
  })

  mkdirSync(join(root, 'api', 'coverage'), { recursive: true })
  writeFileSync(join(root, 'api', 'coverage', 'raw.json'), JSON.stringify({ files: 1 }))
  assert.deepEqual(run().messages, ['api: summarized 1 files.'])
  assert.deepEqual(seen, [[[{ files: 1 }], { root, pkg: 'api' }]])
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'api', 'coverage', 'raw.json'), 'utf8')), { merged: true })
  assert.deepEqual(
    Object.keys(JSON.parse(readFileSync(join(root, 'api', 'coverage', 'coverage-summary.json'), 'utf8'))),
    ['total', '/r/a.py']
  )
  assert.match(run({ stacks: {} }).problems[0], /api: no stack adapter fills the coverage-merge role/)
})
