// Prints the duration of each job and step of a GitHub Actions run and the slowest test files of the `verify` job's log.
// Usage: node scripts/ci-timings.mjs <run-id> [--top <n>] [--all-steps] [--job <name>] [--log <file>]
//   --top <n>      how many slow test files to list (default 10)
//   --all-steps    list every step, not only those of 5 s or more
//   --job <name>   the job whose log holds the Jest output (default verify)
//   --log <file>   read the Jest output from a saved log instead of downloading it
// Needs the GitHub CLI (`gh`), signed in with access to the repository.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { formatReport, parseTestLog } from './ci-timings-lib.mjs'

function option(name, fallback) {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : process.argv[index + 1]
}

function gh(...args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
}

const runId = process.argv[2]

if (!runId || !/^\d+$/.test(runId)) {
  console.error('Usage: ci-timings.mjs <run-id> [--top <n>] [--all-steps] [--job <name>] [--log <file>]')
  process.exit(2)
}

try {
  const { jobs } = JSON.parse(gh('api', `repos/{owner}/{repo}/actions/runs/${runId}/jobs?per_page=100`))
  const jobName = option('--job', 'verify')
  const logFile = option('--log')
  let testLog = null

  if (logFile) {
    testLog = parseTestLog(readFileSync(logFile, 'utf8'))
  } else {
    const job = jobs.find((entry) => entry.name === jobName)
    if (job && job.conclusion !== null) {
      testLog = parseTestLog(gh('api', '--allow-escape-sequences', `repos/{owner}/{repo}/actions/jobs/${job.id}/logs`))
    }
  }

  console.log(
    formatReport({
      runId,
      jobs,
      testLog,
      top: Number(option('--top', '10')),
      all: process.argv.includes('--all-steps')
    })
  )
} catch (error) {
  console.error(`ci-timings failed: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}
