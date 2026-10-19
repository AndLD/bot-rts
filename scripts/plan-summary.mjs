// Writes (or, with --check, verifies) the summary table and the contents of the phases in docs/development-plan/DEVELOPMENT-PLAN.md from
// the phase files. `npm run docs:check` runs the check; `npm run plan:summary` writes.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { profile } from './harness-profile.mjs'
import { parsePhase, phaseProblems, renderIndex } from './plan-summary-lib.mjs'

const root = resolve(import.meta.dirname, '..')
const plan = join(root, profile.paths.plan)
const indexPath = join(plan, 'DEVELOPMENT-PLAN.md')
const isCheck = process.argv.includes('--check')

const phases = readdirSync(join(plan, 'phases'))
  .filter((name) => /^phase-\d+-.+\.md$/.test(name))
  .map((name) => parsePhase(name, readFileSync(join(plan, 'phases', name), 'utf8')))

const problems = phases.flatMap(phaseProblems)
const current = readFileSync(indexPath, 'utf8')
const expected = renderIndex(current, phases)

if (isCheck) {
  if (expected !== current) {
    problems.push(
      `${profile.paths.plan}/DEVELOPMENT-PLAN.md: the summary or the contents disagree with the phase files; run \`npm run plan:summary\``
    )
  }
  if (problems.length) {
    console.error(problems.join('\n'))
    process.exit(1)
  }
  console.log(`Checked the plan summary against ${phases.length} phase files.`)
} else {
  writeFileSync(indexPath, expected)
  console.log(`Wrote the plan summary of ${phases.length} phases.`)
  if (problems.length) {
    console.error(problems.join('\n'))
    process.exit(1)
  }
}
