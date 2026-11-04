// Runtime hook (session start): prints the branch, the phase in progress and the last "Next step" of its work log, so that a session starts where the
// last one stopped (method, session protocol). The text goes to the agent as context. The phases folder and the method are roles of the profile file.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { nextTask, readPhases } from '../lib/next-task.mjs'
import { compareIds, loadPhaseEntries, parseTaskFile, TASK_LOG_FILE } from '../lib/phase-files.mjs'
import { loadProfile } from '../lib/profile.mjs'
import { runHook } from './io.mjs'
import { isMain } from '../lib/main-module.mjs'
import { readQueue } from '../lib/issue-queue.mjs'
import { intakeLines, recordedReports, reportSettings } from '../lib/reports.mjs'

const IN_PROGRESS = /\*\*Status:\*\*\s*🟡/

// The phases that say "in progress", as { file, title, log, folder?, tasks? }: a phase file with its work log, or a phase folder (task 3.10) with its
// `log.md` and its task files
export function phasesInProgress(readText, list, PHASES) {
  return loadPhaseEntries({ list, readText, phasesDir: PHASES }).flatMap((entry) => {
    if (!IN_PROGRESS.test(entry.text)) {
      return []
    }
    const title = entry.text.match(/^# (.+)$/m)?.[1] ?? entry.name
    if (entry.layout === 'folder') {
      const folder = `${PHASES}/${entry.folder}`
      return [
        {
          file: `${folder}/README.md`,
          title,
          folder,
          log: entry.files.includes('log.md') ? `${folder}/log.md` : null,
          tasks: entry.taskFiles.map(({ file, text }) => ({ ...parseTaskFile(file, text), path: `${folder}/${file}` })),
          files: entry.files
        }
      ]
    }
    const log = entry.text.match(/\(\.\/(work-logs\/[^)]+\.md)\)/)?.[1]
    return [{ file: `${PHASES}/${entry.name}`, title, log: log ? `${PHASES}/${log}` : null }]
  })
}

// The newest "Next step" across logs, by the date of the entry that holds it: `logs` are { file, text }, the phase's log first. Ties go to the later log.
// Returns { file, step, date } or null.
export function newestNextStep(logs) {
  let newest = null
  for (const { file, text } of logs) {
    for (const entry of text.split(/^(?=### \d{4}-\d{2}-\d{2})/m)) {
      const date = entry.match(/^### (\d{4}-\d{2}-\d{2})/)?.[1]
      const step = lastNextStep(entry)
      if (date && step && (!newest || date >= newest.date)) {
        newest = { file, step, date }
      }
    }
  }
  return newest
}

// The work-log fragments of the tasks of a phase (`work-logs/phase-<n>/<n>.<m>.md`) that are in progress, as { file, step }
export function fragmentsInProgress(logPath, readText, list) {
  const directory = logPath.replace(/-log\.md$/, '')
  return list(directory)
    .filter((name) => /^\d+\.\d+[a-z]?\.md$/.test(name))
    .sort()
    .flatMap((name) => {
      const text = readText(`${directory}/${name}`)
      return /\*\*Status:\*\*\s*🟡/.test(text) ? [{ file: `${directory}/${name}`, step: lastNextStep(text) }] : []
    })
}

// The text of the last "Next step" line of a work log, or null
export function lastNextStep(logText) {
  const steps = [...logText.matchAll(/^- \*\*Next step:\*\*\s*(.+)$/gm)]
  return steps.length ? steps[steps.length - 1][1].trim() : null
}

// The next task of the plan, by its order (`lib/next-task.mjs`), or null when the plan cannot be read or has no task left
function nextTaskOf(readText, list, phasesDir, planIndex) {
  try {
    const files = loadPhaseEntries({ list, readText, phasesDir }).map((entry) => ({
      file: `${phasesDir}/${entry.file}`,
      text: entry.text,
      tasks: entry.taskFiles?.map(({ file, text }) => parseTaskFile(file, text)).filter((task) => task.id)
    }))
    let indexText = ''
    try {
      indexText = planIndex ? readText(planIndex) : ''
    } catch {
      // a plan without an index has only the orders of its phases
    }
    return nextTask({ phases: readPhases(files), indexText })
  } catch {
    return null
  }
}

// The message to print for a repository
// The line about the issue queue: how many issues are open and where the index is; null where the project has no queue
export function issueQueueLine(readText, list, issuesDir) {
  if (!issuesDir || !list(issuesDir).includes('README.md')) {
    return null
  }
  const open = list(issuesDir).filter((name) => /^I-\d+\.md$/.test(name))
  const started = open.filter((name) => /\*\*Status:\*\*\s*🟡/.test(readText(`${issuesDir}/${name}`))).length
  return `Issue queue: ${open.length} open issue(s)${started ? `, ${started} in progress` : ''} (${issuesDir}/README.md); read the index, never the archive, when asked to work the queue.`
}

export function sessionStartMessage(
  branch,
  readText,
  list,
  phasesDir,
  methodPath = 'the method',
  planIndex = null,
  issuesDir = null,
  reportLines = []
) {
  const lines = [`Branch: ${branch || 'unknown'}`]
  const phases = phasesInProgress(readText, list, phasesDir)

  if (!phases.length) {
    lines.push('No phase is in progress.')
    const next = nextTaskOf(readText, list, phasesDir, planIndex)
    if (next) {
      lines.push(
        `Next task: ${next.id} ${next.title} (${next.file}), by the ${next.source}; check that it has no open pull request first.`
      )
    }
  }
  for (const phase of phases.filter((item) => item.folder)) {
    lines.push(`Phase in progress: ${phase.title} (${phase.file})`)
    const logs = [
      ...(phase.log ? [phase.log] : []),
      ...phase.files
        .filter((name) => TASK_LOG_FILE.test(name))
        .sort((x, y) => compareIds(x.replace(/\.log\.md$/, ''), y.replace(/\.log\.md$/, '')))
        .map((name) => `${phase.folder}/${name}`)
    ].map((file) => ({ file, text: readText(file) }))
    const newest = newestNextStep(logs)
    lines.push(
      newest
        ? `Last next step (${newest.file}, ${newest.date}): ${newest.step}`
        : 'No next step is recorded in the logs.'
    )
    const open = phase.tasks.filter((task) => task.status !== '✅')
    lines.push(
      open.length
        ? `Open tasks: ${open.map((task) => `${task.id} ${task.title}`).join('; ')}`
        : 'Every task of the phase is done.'
    )
    for (const task of open.filter((item) => item.status === '🟡' && item.log)) {
      lines.push(`Task in progress (${task.path}): its log is ${phase.folder}/${task.log.replace(/^\.\//, '')}`)
    }
  }
  for (const phase of phases.filter((item) => !item.folder)) {
    lines.push(`Phase in progress: ${phase.title} (${phase.file})`)
    const step = phase.log ? lastNextStep(readText(phase.log)) : null
    lines.push(step ? `Last next step (${phase.log}): ${step}` : 'No next step is recorded in the work log.')
    for (const fragment of phase.log ? fragmentsInProgress(phase.log, readText, list) : []) {
      lines.push(`Task in progress (${fragment.file}): ${fragment.step ?? 'no next step recorded'}`)
    }
  }
  const queue = issueQueueLine(readText, list, issuesDir)
  if (queue) {
    lines.push(queue)
  }
  lines.push(...reportLines)
  lines.push(`Read the method, section "Session protocol" (${methodPath}), before you start or resume a phase.`)
  return lines.join('\n')
}

// The lines about the reports of users, when the intake is on: asks the host through its adapter, and says so when it cannot
export async function reportLinesOf({ root, profile, readText, list, host: given = null }) {
  if (reportSettings({ profile, root }).intake === 'off') {
    return []
  }
  const host = given ?? (await import('../lib/reports-command.mjs')).hostReports(profile)
  const settings = reportSettings({ profile, root, capable: Boolean(host) })
  if (settings.intake === 'off') {
    return []
  }
  try {
    const reports = host.listReports({ slug: profile.repository.slug })
    const queue = profile.paths?.issues ? readQueue({ dir: profile.paths.issues, list, readText }) : null
    return intakeLines({ settings, reports, recorded: recordedReports({ queue }) })
  } catch (error) {
    return intakeLines({ settings, reports: [], recorded: new Set(), error: error.message.split('\n')[0] })
  }
}

export async function decide(event) {
  if (event.kind !== 'session-start') {
    return {}
  }
  const root = process.env.CLAUDE_PROJECT_DIR ?? process.env.CURSOR_PROJECT_DIR ?? event.cwd
  const profile = loadProfile(root)
  const readText = (path) => readFileSync(join(root, path), 'utf8')
  const list = (path) => (existsSync(join(root, path)) ? readdirSync(join(root, path)) : [])
  let branch = ''
  try {
    branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
  } catch {
    // not a git checkout
  }
  const reportLines = await reportLinesOf({ root, profile, readText, list })
  return {
    context: sessionStartMessage(
      branch,
      readText,
      list,
      profile.paths?.phases ?? 'docs/plan/phases',
      profile.documents?.method,
      profile.paths?.planIndex,
      profile.paths?.issues,
      reportLines
    )
  }
}

if (isMain(import.meta.url)) {
  await runHook((event) => decide(event), { kind: 'session-start' })
}
