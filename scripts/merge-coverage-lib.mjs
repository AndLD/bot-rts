// Merging of the Jest coverage of the shards of one package, and the coverage gate on the merged data (docs/profile.md).
// Used by scripts/merge-coverage.mjs, the last step of the `verify` job of the CI workflow.
import { isDeepStrictEqual } from 'node:util'
import libCoverage from 'istanbul-lib-coverage'

const METRICS = ['statements', 'branches', 'functions', 'lines']

// The shards of a package are uploaded as `coverage-<package>-<index>-of-<count>`; this reads the name back
export function parseArtifactName(name) {
  const match = /^coverage-([\w-]+?)-(\d+)-of-(\d+)$/.exec(name)
  return match ? { pkg: match[1], index: Number(match[2]), count: Number(match[3]) } : null
}

// The shards of `pkg` among the artifact names, in order. Throws when a shard of the set is missing or the sets disagree
export function shardsOf(pkg, names) {
  const found = names.map(parseArtifactName).filter((entry) => entry && entry.pkg === pkg)

  if (!found.length) {
    throw new Error(`No coverage artifact for ${pkg}`)
  }

  const [{ count }] = found
  const indexes = found.map((entry) => entry.index).sort((a, b) => a - b)
  const expected = Array.from({ length: count }, (_, i) => i + 1)

  if (found.some((entry) => entry.count !== count) || indexes.join() !== expected.join()) {
    throw new Error(`The coverage of ${pkg} is incomplete: found shards ${indexes.join(', ')} of ${count}`)
  }

  return found.map((entry) => `coverage-${pkg}-${entry.index}-of-${entry.count}`)
}

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
    file.b[key] = file.b[key].map((hits, index) => hits + other.b[key][index])
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

// The shape of Jest's `json-summary` reporter: `total` and one entry per file, which scripts/check-changed-coverage.mjs reads
export function toSummary(merged) {
  const map = libCoverage.createCoverageMap(merged)
  const summary = { total: map.getCoverageSummary().toJSON() }

  for (const file of map.files()) {
    summary[file] = map.fileCoverageFor(file).toSummary().toJSON()
  }

  return summary
}

// The metrics of `total` that are below the gate, like Jest's `coverageThreshold` of the whole package
export function gateFailures(total, gate) {
  return METRICS.filter((metric) => total[metric].pct < gate[metric]).map(
    (metric) => `${metric} ${total[metric].pct}% (gate ${gate[metric]}%)`
  )
}
