// Merging of the Jest coverage of the shards of one package, and the coverage gate on the merged data (docs/profile.md).
// Used by scripts/merge-coverage.mjs, the last step of the `verify` job of the CI workflow.
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

// Sums the hit counts of the same files from several `coverage-final.json` objects
export function mergeCoverage(finals) {
  const map = libCoverage.createCoverageMap({})

  for (const final of finals) {
    map.merge(final)
  }

  return map
}

// The shape of Jest's `json-summary` reporter: `total` and one entry per file, which scripts/check-changed-coverage.mjs reads
export function toSummary(map) {
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
