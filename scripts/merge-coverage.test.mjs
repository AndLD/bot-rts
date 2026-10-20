import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { gateFailures, mergeCoverage, parseArtifactName, shardsOf, toSummary } from './merge-coverage-lib.mjs'

const at = (line) => ({ start: { line, column: 0 }, end: { line, column: 10 } })

/**
 * A `coverage-final.json` entry as Jest's `json` reporter writes it. `hits.s` and `hits.f` are the hit counts of the statements and
 * functions, `hits.b` those of the branches (one array per branch). `line` gives the line of entry `i` (default: a line of its own);
 * a function that returns the same line for two entries puts them at one source location, as `<Lazy />` wrappers do in the client.
 */
function file(path, { s = [], f = [], b = [] }, line = (i) => i + 1) {
  const entries = (counts) => Object.fromEntries(counts.map((_, i) => [String(i), at(line(i))]))
  const indexed = (counts) => Object.fromEntries(counts.map((count, i) => [String(i), count]))

  return {
    [path]: {
      path,
      statementMap: entries(s),
      s: indexed(s),
      fnMap: Object.fromEntries(
        f.map((_, i) => [String(i), { name: `f${i}`, decl: at(line(i)), loc: at(line(i)), line: line(i) }])
      ),
      f: indexed(f),
      branchMap: Object.fromEntries(
        b.map((_, i) => [String(i), { type: 'if', loc: at(line(i)), locations: b[i].map(() => at(line(i))) }])
      ),
      b: Object.fromEntries(b.map((counts, i) => [String(i), counts]))
    }
  }
}

const sameLocation = () => 1

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

test('merging adds the hit counts of statements, functions and branches index by index', () => {
  const merged = mergeCoverage([
    { ...file('/r/a.ts', { s: [1, 0], f: [2, 0], b: [[1, 0]] }), ...file('/r/b.ts', { s: [0] }) },
    { ...file('/r/a.ts', { s: [0, 3], f: [0, 0], b: [[0, 4]] }), ...file('/r/c.ts', { s: [3] }) },
    file('/r/a.ts', { s: [5, 0], f: [1, 0], b: [[2, 0]] })
  ])
  assert.deepEqual(Object.keys(merged).sort(), ['/r/a.ts', '/r/b.ts', '/r/c.ts'])
  assert.deepEqual(merged['/r/a.ts'].s, { 0: 6, 1: 3 })
  assert.deepEqual(merged['/r/a.ts'].f, { 0: 3, 1: 0 })
  assert.deepEqual(merged['/r/a.ts'].b, { 0: [3, 4] })
  const summary = toSummary(merged)
  assert.equal(summary['/r/a.ts'].statements.pct, 100)
  assert.equal(summary['/r/a.ts'].functions.pct, 50)
  assert.equal(summary['/r/a.ts'].branches.pct, 100)
  assert.equal(summary['/r/b.ts'].statements.pct, 0)
  assert.equal(summary.total.statements.covered, 3)
  assert.equal(summary.total.statements.total, 4)
})

test('functions, statements and branches at one source location stay separate: an uncovered one is not hidden by a covered one', () => {
  const shape = {
    s: [1, 0],
    f: [1, 0],
    b: [
      [1, 0],
      [1, 0]
    ]
  }
  const single = toSummary(file('/r/lazy.tsx', shape, sameLocation))
  assert.equal(single['/r/lazy.tsx'].functions.pct, 50)
  assert.equal(single['/r/lazy.tsx'].statements.pct, 50)

  // The same file, as the shards of one run see it: one shard calls the first function, the other calls none
  const merged = mergeCoverage([
    file('/r/lazy.tsx', shape, sameLocation),
    file(
      '/r/lazy.tsx',
      {
        s: [0, 0],
        f: [0, 0],
        b: [
          [0, 0],
          [0, 0]
        ]
      },
      sameLocation
    )
  ])
  const summary = toSummary(merged)['/r/lazy.tsx']
  assert.equal(summary.functions.total, 2, 'both functions are counted')
  assert.equal(summary.functions.covered, 1)
  assert.equal(summary.functions.pct, 50, 'not 100 %')
  assert.equal(summary.statements.total, 2)
  assert.equal(summary.statements.pct, 50)
  assert.deepEqual(
    { total: summary.branches.total, covered: summary.branches.covered },
    { total: single['/r/lazy.tsx'].branches.total, covered: single['/r/lazy.tsx'].branches.covered }
  )
  assert.deepEqual(toSummary(merged).total, single.total, 'the merged totals are those of the unsharded run')
})

test('shards whose maps differ are an error that names the file and the map', () => {
  const base = file('/r/a.ts', { s: [1, 1], f: [1], b: [[1, 1]] })
  const other = (change) => {
    const copy = structuredClone(base)
    change(copy['/r/a.ts'])
    return copy
  }
  const failure = (change, map) =>
    assert.throws(
      () => mergeCoverage([base, other(change)]),
      new RegExp(`/r/a\\.ts: the ${map} differs between shards`)
    )

  failure((entry) => (entry.statementMap[1].end.column = 11), 'statementMap')
  failure((entry) => (entry.fnMap[0].name = 'renamed'), 'fnMap')
  failure((entry) => (entry.branchMap[0].type = 'switch'), 'branchMap')
  failure((entry) => delete entry.statementMap[1], 'statementMap')
})

test('hit counts that do not match the maps of a shard are an error, not a NaN', () => {
  const broken = structuredClone(file('/r/a.ts', { s: [1, 1] }))
  delete broken['/r/a.ts'].s[1]
  assert.throws(
    () => mergeCoverage([file('/r/a.ts', { s: [1, 1] }), broken]),
    /the hit counts "s" of a shard do not match its statementMap/
  )
})

test('the gate reports each metric below the threshold and nothing at or above it', () => {
  const gate = { statements: 97, branches: 97, functions: 97, lines: 97 }
  const metric = (pct) => ({ pct })
  const ok = { statements: metric(97), branches: metric(100), functions: metric(97.5), lines: metric(98) }
  assert.deepEqual(gateFailures(ok, gate), [])
  assert.deepEqual(gateFailures({ ...ok, branches: metric(96.99) }, gate), ['branches 96.99% (gate 97%)'])
})

test('the command fails below the gate, passes above it and fails on a missing shard or on differing maps', () => {
  const dir = mkdtempSync(join(tmpdir(), 'merge-coverage-'))
  const artifacts = join(dir, 'artifacts')
  mkdirSync(artifacts)
  const shard = (name, final) => {
    mkdirSync(join(artifacts, name), { recursive: true })
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
  shard('coverage-mcp-1-of-2', file('/r/a.ts', { s: [1, 1] }))
  assert.equal(run(), 2, 'the second shard is missing')
  shard('coverage-mcp-2-of-2', file('/r/b.ts', { s: [0] }))
  assert.equal(run(), 1, '2 of 3 statements is below the gate')
  const summary = JSON.parse(readFileSync(join(dir, 'mcp', 'coverage', 'coverage-summary.json'), 'utf8'))
  assert.equal(summary.total.statements.total, 3)
  assert.equal(summary.total.statements.covered, 2)
  // The same file covered by the other shard lifts the merged package to the gate
  shard('coverage-mcp-1-of-2', file('/r/b.ts', { s: [1] }))
  shard('coverage-mcp-2-of-2', file('/r/b.ts', { s: [0] }))
  assert.equal(run(), 0)
  // A file that is not the same source in the two shards cannot be merged
  shard('coverage-mcp-2-of-2', file('/r/b.ts', { s: [0, 0] }))
  assert.equal(run(), 2, 'the statement maps differ')
})
