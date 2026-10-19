// Prints the implementation log of a phase from the merged pull requests of the integration branch.
// Usage: node scripts/plan-log.mjs <phase number> [ref]   (ref defaults to origin/<the integration branch>)
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { profile } from './harness-profile.mjs'
import { implementationLog, implementationRows } from './plan-log-lib.mjs'

const [phase, ref = `origin/${profile.branches.integration}`] = process.argv.slice(2)

if (!/^\d+$/.test(phase ?? '')) {
  console.error('Usage: node scripts/plan-log.mjs <phase number> [ref]')
  process.exit(1)
}

const SEPARATOR = '\u001e'
const FIELD = '\u001f'
const output = execFileSync(
  'git',
  ['log', ref, `--grep=^Plan: ${phase}\\.`, `--format=%s${FIELD}%b${FIELD}%cI${SEPARATOR}`],
  {
    cwd: resolve(import.meta.dirname, '..'),
    encoding: 'utf8'
  }
)
const commits = output
  .split(SEPARATOR)
  .map((record) => record.trim())
  .filter(Boolean)
  .map((record) => {
    const [subject, body, date] = record.split(FIELD)
    return { subject, body, date }
  })

console.log(implementationLog(implementationRows(commits, phase), profile.repository.url))
