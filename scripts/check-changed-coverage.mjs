// Fails when a source file changed by the pull request has less than 97 % coverage on any metric.
// Usage: node scripts/check-changed-coverage.mjs <base-ref> [<package-dir>...]
// Reads <package-dir>/coverage/coverage-summary.json (Jest `json-summary` reporter).
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const THRESHOLD = 97
const METRICS = ['statements', 'branches', 'functions', 'lines']

const root = resolve(import.meta.dirname, '..')
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
    const low = METRICS.filter((metric) => data[metric].pct < THRESHOLD).map(
      (metric) => `${metric} ${data[metric].pct}%`
    )

    if (low.length) {
      failures.push(`${file}: ${low.join(', ')}`)
    }
  }
}

if (failures.length) {
  console.error(`Changed files below ${THRESHOLD}% coverage:\n${failures.join('\n')}`)
  process.exit(1)
}

console.log(`${checked} changed source files meet the ${THRESHOLD}% coverage threshold.`)
