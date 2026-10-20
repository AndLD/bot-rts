import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { gateFailures, mergeCoverage, parseArtifactName, shardsOf, toSummary } from './merge-coverage-lib.mjs'

// The merge identifies a statement by its location, so each one gets a line of its own
const location = (line) => ({ start: { line, column: 0 }, end: { line, column: 10 } })

// A `coverage-final.json` entry with one statement per hit count, as Jest's `json` reporter writes it
function file(path, hits) {
  const statementMap = Object.fromEntries(hits.map((_, i) => [String(i), location(i + 1)]))
  const s = Object.fromEntries(hits.map((count, i) => [String(i), count]))
  return { [path]: { path, statementMap, s, fnMap: {}, f: {}, branchMap: {}, b: {} } }
}

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

test('merging adds the hits of the same file and keeps the files that only one shard has', () => {
  const merged = mergeCoverage([
    { ...file('/r/a.ts', [1, 0]), ...file('/r/b.ts', [0]) },
    { ...file('/r/a.ts', [0, 0]), ...file('/r/c.ts', [3]) },
    file('/r/a.ts', [0, 2])
  ])
  const summary = toSummary(merged)
  assert.deepEqual(Object.keys(summary).sort(), ['/r/a.ts', '/r/b.ts', '/r/c.ts', 'total'])
  assert.equal(summary['/r/a.ts'].statements.pct, 100)
  assert.equal(summary['/r/b.ts'].statements.pct, 0)
  assert.equal(summary.total.statements.covered, 3)
  assert.equal(summary.total.statements.total, 4)
})

test('the gate reports each metric below the threshold and nothing at or above it', () => {
  const gate = { statements: 97, branches: 97, functions: 97, lines: 97 }
  const metric = (pct) => ({ pct })
  const ok = { statements: metric(97), branches: metric(100), functions: metric(97.5), lines: metric(98) }
  assert.deepEqual(gateFailures(ok, gate), [])
  assert.deepEqual(gateFailures({ ...ok, branches: metric(96.99) }, gate), ['branches 96.99% (gate 97%)'])
})

test('the command fails below the gate, passes above it and fails on a missing shard', () => {
  const dir = mkdtempSync(join(tmpdir(), 'merge-coverage-'))
  const artifacts = join(dir, 'artifacts')
  mkdirSync(artifacts)
  const shard = (name, final) => {
    mkdirSync(join(artifacts, name))
    writeFileSync(join(artifacts, name, 'coverage-final.json'), JSON.stringify(final))
  }
  const run = () => {
    try {
      execFileSync('node', [join(import.meta.dirname, 'merge-coverage.mjs'), artifacts, '--out', dir, 'mcp'], {
        stdio: 'pipe'
      })
      return 0
    } catch (error) {
      return error.status
    }
  }
  shard('coverage-mcp-1-of-2', file('/r/a.ts', [1, 1]))
  assert.equal(run(), 2, 'the second shard is missing')
  shard('coverage-mcp-2-of-2', file('/r/b.ts', [0]))
  assert.equal(run(), 1, '2 of 3 statements is below the gate')
  const summary = JSON.parse(readFileSync(join(dir, 'mcp', 'coverage', 'coverage-summary.json'), 'utf8'))
  assert.equal(summary.total.statements.total, 3)
  assert.equal(summary.total.statements.covered, 2)
  // The same file covered by the other shard lifts the merged package to the gate
  writeFileSync(join(artifacts, 'coverage-mcp-1-of-2', 'coverage-final.json'), JSON.stringify(file('/r/b.ts', [1])))
  writeFileSync(join(artifacts, 'coverage-mcp-2-of-2', 'coverage-final.json'), JSON.stringify(file('/r/b.ts', [0])))
  assert.equal(run(), 0)
})
