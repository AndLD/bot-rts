// Fails when a source file changed by the pull request is below the coverage gate on any metric.
// Usage: node scripts/check-changed-coverage.mjs <base-ref> [<package-dir>...]
// Reads <package-dir>/coverage/coverage-summary.json (Jest `json-summary` reporter) and the gate from
// scripts/coverage-threshold.json, the constant the Jest configs read too (docs/profile.md).
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const gate = JSON.parse(readFileSync(join(root, 'scripts', 'coverage-threshold.json'), 'utf8'))
const [base, ...packages] = process.argv.slice(2)

if (!base) {
  console.error('Usage: check-changed-coverage.mjs <base-ref> [<package-dir>...]')
  process.exit(2)
}

const changed = execFileSync('git', ['diff', '--name-only', '--diff-filter=AM', `${base}...HEAD`], {
  cwd: root,
  encoding: 'utf8'
})
  .split('\n')
  .filter(Boolean)

const failures = []
let checked = 0

for (const pkg of packages.length ? packages : ['api']) {
  const summaryPath = join(root, pkg, 'coverage', 'coverage-summary.json')

  if (!existsSync(summaryPath)) {
    console.error(`No coverage summary for ${pkg}; run the tests with coverage first.`)
    process.exit(2)
  }

  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))
  const covered = new Map(Object.entries(summary).map(([file, data]) => [relative(root, file), data]))

  for (const file of changed.filter((f) => f.startsWith(`${pkg}/`))) {
    const data = covered.get(file)

    // Files missing from the summary are excluded in the coverage config (tests, types, bootstrap)
    if (!data) {
      continue
    }

    checked += 1
    const low = Object.entries(gate)
      .filter(([metric, threshold]) => data[metric].pct < threshold)
      .map(([metric, threshold]) => `${metric} ${data[metric].pct}% (gate ${threshold}%)`)

    if (low.length) {
      failures.push(`${file}: ${low.join(', ')}`)
    }
  }
}

if (failures.length) {
  console.error(`Changed files below the coverage gate:\n${failures.join('\n')}`)
  process.exit(1)
}

console.log(`${checked} changed source files meet the coverage gate.`)
