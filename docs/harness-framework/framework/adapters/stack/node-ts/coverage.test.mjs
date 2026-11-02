import assert from 'node:assert/strict'
import { test } from 'node:test'
import { merge, mergeCoverage, SHARD_FILE, toSummary } from './coverage.mjs'

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

test('the merge role returns the merged coverage to write next to the neutral summary', () => {
  const { artifacts, summary } = merge([file('/r/a.ts', { s: [1, 0] }), file('/r/a.ts', { s: [0, 0] })])
  assert.equal(SHARD_FILE, 'coverage-final.json')
  assert.deepEqual(Object.keys(artifacts), ['coverage-final.json'])
  assert.deepEqual(artifacts['coverage-final.json']['/r/a.ts'].s, { 0: 1, 1: 0 })
  assert.deepEqual(summary['/r/a.ts'].statements, { total: 2, covered: 1, skipped: 0, pct: 50 })
  assert.deepEqual(summary.total.lines, { total: 2, covered: 1, skipped: 0, pct: 50 })
})

test('a line is covered when the most-hit statement that starts on it is; nothing to cover is 100 %; the percentage rounds down', () => {
  const sameLine = file('/r/l.ts', { s: [0, 2, 0] }, (i) => (i < 2 ? 1 : 2))
  const summary = toSummary(sameLine)['/r/l.ts']
  assert.deepEqual(summary.lines, { total: 2, covered: 1, skipped: 0, pct: 50 })
  assert.deepEqual(summary.statements, { total: 3, covered: 1, skipped: 0, pct: 33.33 })
  assert.equal(summary.branches.pct, 100)
  assert.equal(summary.functions.pct, 100)
  const almost = toSummary(file('/r/m.ts', { s: Array.from({ length: 100000 }, (_, i) => (i === 0 ? 0 : 1)) }))
  assert.equal(almost.total.statements.pct, 99.99, '99.999 is never shown as 100')
})

test('the summary is the one Istanbul computes, where its library is installed', async (context) => {
  let libCoverage
  try {
    libCoverage = (await import('istanbul-lib-coverage')).default
  } catch {
    context.skip('istanbul-lib-coverage is not installed here')
    return
  }
  const merged = mergeCoverage([
    {
      ...file(
        '/r/a.ts',
        {
          s: [1, 0, 2, 0],
          f: [1, 0],
          b: [
            [1, 0, 0],
            [2, 1]
          ]
        },
        (i) => Math.floor(i / 2) + 1
      ),
      ...file('/r/b.ts', { s: [0, 0] })
    }
  ])
  const map = libCoverage.createCoverageMap(merged)
  const four = (summary) =>
    Object.fromEntries(['statements', 'branches', 'functions', 'lines'].map((name) => [name, summary[name]]))
  const expected = {
    total: four(map.getCoverageSummary().toJSON()),
    ...Object.fromEntries(map.files().map((path) => [path, four(map.fileCoverageFor(path).toSummary().toJSON())]))
  }
  assert.deepEqual(toSummary(merged), expected)
})
