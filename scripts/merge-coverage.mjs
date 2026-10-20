// Merges the coverage of the CI shards of each package and applies the coverage gate to the merged data.
// Usage: node scripts/merge-coverage.mjs <artifacts-dir> [--out <dir>] [<package-dir>...]
// <artifacts-dir> holds one directory per uploaded shard, `coverage-<package>-<index>-of-<count>/coverage-final.json`
// (Jest `json` reporter). Writes <package-dir>/coverage/coverage-final.json and coverage-summary.json, the files that a single
// Jest run writes, so scripts/check-changed-coverage.mjs reads the merged result. `--out <dir>` writes below <dir> instead of the
// repository root (the test of the script uses it). Exits 1 below the gate, 2 on missing shards or shards whose files differ.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { profile } from './harness-profile.mjs'
import { gateFailures, mergeCoverage, shardsOf, toSummary } from './merge-coverage-lib.mjs'

const root = resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const outIndex = args.indexOf('--out')
const out = outIndex === -1 ? root : resolve(args.splice(outIndex, 2)[1])
const [artifacts, ...requested] = args

if (!artifacts) {
  console.error('Usage: merge-coverage.mjs <artifacts-dir> [--out <dir>] [<package-dir>...]')
  process.exit(2)
}

const gate = JSON.parse(readFileSync(join(root, 'scripts', 'coverage-threshold.json'), 'utf8'))
const names = readdirSync(artifacts)
const failures = []

for (const pkg of requested.length ? requested : profile.coveragePackages) {
  let shards

  try {
    shards = shardsOf(pkg, names)
  } catch (error) {
    console.error(error.message)
    process.exit(2)
  }

  let merged

  try {
    merged = mergeCoverage(
      shards.map((shard) => JSON.parse(readFileSync(join(artifacts, shard, 'coverage-final.json'), 'utf8')))
    )
  } catch (error) {
    console.error(`${pkg}: ${error.message}`)
    process.exit(2)
  }

  const summary = toSummary(merged)
  const dir = join(out, pkg, 'coverage')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'coverage-final.json'), JSON.stringify(merged))
  writeFileSync(join(dir, 'coverage-summary.json'), JSON.stringify(summary))

  const { total } = summary
  const counts = ['statements', 'branches', 'functions', 'lines']
    .map((metric) => `${metric} ${total[metric].covered}/${total[metric].total} (${total[metric].pct}%)`)
    .join(', ')
  console.log(`${pkg}: ${shards.length} shard(s) merged, ${Object.keys(merged).length} files; ${counts}`)

  const low = gateFailures(total, gate)

  if (low.length) {
    failures.push(`${pkg}: ${low.join(', ')}`)
  }
}

if (failures.length) {
  console.error(`Coverage below the gate:\n${failures.join('\n')}`)
  process.exit(1)
}
