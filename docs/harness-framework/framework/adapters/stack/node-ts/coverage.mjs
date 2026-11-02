// The node-ts stack's coverage (design §4.1, roles "coverage tool" and "coverage merge"): the shards of a package are Istanbul `coverage-final.json`
// files; merging them and writing the neutral summary (the shape of Jest's `json-summary` reporter: `total` and one entry per file, each with
// `statements`, `branches`, `functions` and `lines` as `{ total, covered, skipped, pct }`) is this module's job. The core reads the summary and
// applies the gate. No dependency: Istanbul's own rules for the summary are written out here, and a test compares them with its library when
// it is installed.
import { isDeepStrictEqual } from 'node:util'

/** The file in which a shard of a package keeps its coverage. */
export const SHARD_FILE = 'coverage-final.json'

const MAPS = ['statementMap', 'fnMap', 'branchMap']

// Adds the hit counts of `other` to those of `file`, entry by entry, after checking that both describe the same source
function addHits(path, file, other) {
  for (const name of MAPS) {
    if (!isDeepStrictEqual(file[name], other[name])) {
      throw new Error(
        `${path}: the ${name} differs between shards, so their hit counts cannot be added; ` +
          'the shards must run the same code with the same Jest configuration'
      )
    }
  }

  // A hit count for every entry of the maps, and no other: a missing count would turn into NaN, which no threshold catches
  const hits = { s: 'statementMap', f: 'fnMap', b: 'branchMap' }

  for (const [counts, map] of Object.entries(hits)) {
    if (!isDeepStrictEqual(Object.keys(other[counts]).sort(), Object.keys(other[map]).sort())) {
      throw new Error(`${path}: the hit counts "${counts}" of a shard do not match its ${map}`)
    }
  }

  for (const key of Object.keys(file.s)) {
    file.s[key] += other.s[key]
  }

  for (const key of Object.keys(file.f)) {
    file.f[key] += other.f[key]
  }

  for (const key of Object.keys(file.b)) {
    file.b[key] = file.b[key].map((count, index) => count + other.b[key][index])
  }
}

/**
 * Adds up the hit counts of the same files from several `coverage-final.json` objects, index by index. Every shard is instrumented from
 * the same source, so a file has the same statement, function and branch maps in each; a file whose maps differ is an error. This does
 * not use `CoverageMap.merge` of istanbul-lib-coverage: it matches entries by source location, so two functions or statements at one
 * location become one and the covered one hides the uncovered one.
 */
export function mergeCoverage(finals) {
  const merged = {}

  for (const final of finals) {
    for (const [path, file] of Object.entries(final)) {
      if (merged[path]) {
        addHits(path, merged[path], file)
      } else {
        merged[path] = structuredClone(file)
      }
    }
  }

  return merged
}

// Istanbul's percentage: the floor to two decimals, so that 99.999 is never shown as 100; nothing to cover is 100
const percent = (covered, total) => (total > 0 ? Math.floor((1000 * 100 * covered) / total / 10) / 100 : 100)

const metric = (covered, total) => ({ total, covered, skipped: 0, pct: percent(covered, total) })

// The four metrics of one file. A line is covered when the most-hit statement that starts on it is; a branch counts once per location
function fileMetrics(file) {
  const statements = Object.values(file.s)
  const lineHits = {}
  for (const [id, count] of Object.entries(file.s)) {
    const line = file.statementMap[id].start.line
    lineHits[line] = Math.max(lineHits[line] ?? 0, count)
  }
  const branches = Object.values(file.b).flat()
  const functions = Object.values(file.f)
  const lines = Object.values(lineHits)
  const covered = (counts) => counts.filter((count) => count > 0).length

  return {
    statements: metric(covered(statements), statements.length),
    branches: metric(covered(branches), branches.length),
    functions: metric(covered(functions), functions.length),
    lines: metric(covered(lines), lines.length)
  }
}

/** The neutral summary of merged coverage: `total` and one entry per file. */
export function toSummary(merged) {
  const files = Object.entries(merged).map(([path, file]) => [path, fileMetrics(file)])
  const total = {}
  for (const name of ['statements', 'branches', 'functions', 'lines']) {
    const covered = files.reduce((sum, [, metrics]) => sum + metrics[name].covered, 0)
    const count = files.reduce((sum, [, metrics]) => sum + metrics[name].total, 0)
    total[name] = metric(covered, count)
  }
  return { total, ...Object.fromEntries(files) }
}

/**
 * The coverage-merge role: `shards` are the parsed `coverage-final.json` files of one package.
 * @returns {{ artifacts: Record<string, object>, summary: object }} the files to write next to the summary (`coverage-final.json`), and the summary
 */
export function merge(shards) {
  const merged = mergeCoverage(shards)
  return { artifacts: { [SHARD_FILE]: merged }, summary: toSummary(merged) }
}
