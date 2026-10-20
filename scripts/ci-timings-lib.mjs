// Parsing and formatting for scripts/ci-timings.mjs: the duration of each job and step of a GitHub Actions run, and the slowest
// test files read from Jest's `PASS … (N s)` lines in the log of a job. Pure functions, tested by ci-timings.test.mjs.

// `gh run view --log` prefixes a line with "<job>\t<step>\t"; the raw log of the API has only the timestamp
const TAB_PREFIX = /^[^\t]*\t[^\t]*\t/
const TIMESTAMP = /^﻿?\d{4}-\d{2}-\d{2}T[\d:.]+Z /
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g

const PACKAGE_HEADER = /^> @[\w-]+\/([\w-]+)@\S+ test(?::coverage)?$/
const PASS_LINE = /^(PASS|FAIL)(?: (\w+))? (\S+) \((\d+(?:\.\d+)?) s\)$/
const TIME_LINE = /^Time:\s+(\d+(?:\.\d+)?) s$/

export function cleanLogLine(line) {
  return line.replace(TAB_PREFIX, '').replace(TIMESTAMP, '').replace(ANSI, '').trimEnd()
}

/**
 * Reads the Jest output of a job log. Jest prints the duration only for files above its slow-test threshold (5 s), so `files`
 * lists the slow files, not every file. `packages` holds the `Time:` line of each workspace run (`npm run test:coverage` runs
 * the workspaces one after another, and each prints `> @bot-rts/<package>@… test:coverage` first).
 */
export function parseTestLog(text) {
  const files = []
  const packages = []
  let current = null

  for (const raw of text.split('\n')) {
    const line = cleanLogLine(raw)
    const header = PACKAGE_HEADER.exec(line)
    if (header) {
      current = header[1]
      continue
    }
    const pass = PASS_LINE.exec(line)
    if (pass) {
      files.push({ package: current, project: pass[2] ?? null, file: pass[3], seconds: Number(pass[4]) })
      continue
    }
    const time = TIME_LINE.exec(line)
    if (time && current) {
      packages.push({ package: current, seconds: Number(time[1]) })
    }
  }

  return { files, packages }
}

/**
 * The jobs whose log holds Jest output: the one named `name`, or by default the test jobs of the parallel workflow (`api tests`,
 * `client tests 1/3`, … ) and `verify`, which held every test before Phase 16 split it.
 */
export function testJobs(jobs, name) {
  const wanted = name ? (job) => job.name === name : (job) => job.name === 'verify' || /\btests\b/.test(job.name)
  // A job that is still running has no log to read yet, and a skipped one never had any
  return jobs.filter((job) => wanted(job) && job.conclusion !== null && job.conclusion !== 'skipped')
}

/** One test log from several: the files and the package runs of all of them. */
export function mergeTestLogs(logs) {
  return { files: logs.flatMap((log) => log.files), packages: logs.flatMap((log) => log.packages) }
}

export function slowestFiles(files, count) {
  return [...files].sort((a, b) => b.seconds - a.seconds).slice(0, count)
}

function secondsBetween(start, end) {
  if (!start || !end) {
    return null
  }
  return Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 1000))
}

/** Duration of every job and of each of its steps, from the `jobs` array of the GitHub Actions API. */
export function jobDurations(jobs) {
  return jobs.map((job) => ({
    id: job.id,
    name: job.name,
    conclusion: job.conclusion,
    seconds: secondsBetween(job.started_at, job.completed_at),
    steps: (job.steps ?? []).map((step) => ({
      name: step.name,
      conclusion: step.conclusion,
      seconds: secondsBetween(step.started_at, step.completed_at)
    }))
  }))
}

export function formatDuration(seconds) {
  if (seconds === null) {
    return '-'
  }
  const minutes = Math.floor(seconds / 60)
  return minutes > 0 ? `${minutes} min ${String(seconds % 60).padStart(2, '0')} s` : `${seconds} s`
}

/** The wall time of a run: from the first job start to the last job end. */
export function runSeconds(jobs) {
  const starts = jobs.map((job) => Date.parse(job.started_at)).filter((time) => !Number.isNaN(time))
  const ends = jobs.map((job) => Date.parse(job.completed_at)).filter((time) => !Number.isNaN(time))
  if (starts.length === 0 || ends.length === 0) {
    return null
  }
  return Math.round((Math.max(...ends) - Math.min(...starts)) / 1000)
}

/** Steps shorter than this are left out of the step listing unless `all` is set. */
const MINOR_STEP_SECONDS = 5

export function formatReport({ runId, jobs, testLog, top = 10, all = false }) {
  const durations = jobDurations(jobs)
  const lines = [`Run ${runId}: ${formatDuration(runSeconds(jobs))} wall time`, '', 'Jobs', '----']

  for (const job of durations) {
    lines.push(`${job.name.padEnd(12)} ${formatDuration(job.seconds).padStart(10)}  ${job.conclusion ?? 'running'}`)
  }

  for (const job of durations) {
    const steps = job.steps.filter((step) => step.seconds !== null && (all || step.seconds >= MINOR_STEP_SECONDS))
    if (steps.length === 0) {
      continue
    }
    lines.push(
      '',
      `Steps of ${job.name}${all ? '' : ` (${MINOR_STEP_SECONDS} s or more)`}`,
      '-'.repeat(9 + job.name.length)
    )
    for (const step of steps) {
      lines.push(`${formatDuration(step.seconds).padStart(10)}  ${step.name}`)
    }
  }

  if (testLog) {
    lines.push('', 'Jest per package (Time: line)', '-----------------------------')
    for (const entry of testLog.packages) {
      lines.push(`${formatDuration(Math.round(entry.seconds)).padStart(10)}  ${entry.package}`)
    }
    lines.push('', `Slowest test files (top ${top}, files above Jest's 5 s threshold)`, '-'.repeat(54))
    for (const file of slowestFiles(testLog.files, top)) {
      lines.push(`${`${file.seconds.toFixed(1)} s`.padStart(10)}  ${file.package ?? '?'}  ${file.file}`)
    }
  }

  return lines.join('\n')
}
