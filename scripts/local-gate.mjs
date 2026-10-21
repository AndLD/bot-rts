// The local gate, run by .githooks/pre-push: reads the refs of the push from standard input, takes the files they change, and runs only the checks
// those files need (scripts/local-gate-lib.mjs; docs/testing/README.md). `--dry-run` prints the plan and runs nothing.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { root, profile } from './harness-profile.mjs'
import { planGate, rangesOfPush } from './local-gate-lib.mjs'

const integration = profile.branches.integration
const isDryRun = process.argv.includes('--dry-run')

function changedFiles(ranges) {
  const files = new Set()

  for (const range of ranges) {
    let names
    try {
      names = execFileSync('git', ['diff', '--name-only', range], { cwd: root, encoding: 'utf8' }).split('\n')
    } catch {
      names = ['unknown.ts'] // the range cannot be read (a base the clone does not have): run everything
    }
    names.filter(Boolean).forEach((name) => files.add(name))
  }

  return [...files]
}

function run(step) {
  const result = spawnSync(step.command, step.args, { cwd: join(root, step.cwd ?? '.'), stdio: 'inherit' })

  if (result.status !== 0) {
    console.error(`pre-push: "${step.label}" failed`)
    process.exit(result.status ?? 1)
  }
}

const stdin = process.stdin.isTTY ? '' : readFileSync(0, 'utf8')
const files = changedFiles(rangesOfPush(stdin, integration))
const plan = planGate(files, {
  packages: profile.coveragePackages,
  integration,
  exists: (file) => existsSync(join(root, file))
})

if (plan.skip) {
  console.log(`pre-push: no code check needed, ${plan.skip}`)
  process.exit(0)
}

console.log(`pre-push: ${files.length} changed file(s); checks: ${plan.steps.map((step) => step.label).join(', ')}`)
if (isDryRun) {
  process.exit(0)
}

let databaseIsUp = false

for (const step of plan.steps) {
  console.log(`pre-push: ${step.label}`)

  if (step.needsDatabase && !databaseIsUp) {
    run({ label: 'database', command: 'npm', args: ['run', 'db:up'] })
    databaseIsUp = true
  }
  if (step.clearsSummary) {
    // A run that finds no related tests must not leave the summary of an earlier run to be judged
    rmSync(join(root, step.cwd, 'coverage', 'coverage-summary.json'), { force: true })
  }
  if (step.onlyPackagesWithSummary) {
    const [script, base, ...packages] = step.args
    const withSummary = packages.filter((pkg) => existsSync(join(root, pkg, 'coverage', 'coverage-summary.json')))

    packages
      .filter((pkg) => !withSummary.includes(pkg))
      .forEach((pkg) => console.log(`pre-push: no related tests ran in ${pkg}, so its changed files are judged by CI`))
    if (withSummary.length) {
      run({ ...step, args: [script, base, ...withSummary] })
    }
  } else if (step.generated) {
    for (const script of [
      ['run', 'openapi:generate', '-w', 'api'],
      ['run', 'api:generate', '-w', 'client'],
      ['run', 'docs:generate']
    ]) {
      run({ label: step.label, command: 'npm', args: script })
    }
    const stale = spawnSync(
      'git',
      [
        'diff',
        '--exit-code',
        '--',
        'api/openapi.json',
        'client/src/shared/api/generated.ts',
        'client/src/docs/generated',
        'client/src/features/admin/docs/generated'
      ],
      { cwd: root, stdio: 'inherit' }
    )

    if (stale.status !== 0) {
      console.error(
        'Commit the regenerated files first (npm run openapi:generate -w api; npm run api:generate -w client; npm run docs:generate)'
      )
      process.exit(1)
    }
  } else {
    run(step)
  }
}
