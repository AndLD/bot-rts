// Runtime hook (session start): prints the branch, the phase in progress and the last "Next step" of its work log, so that a session starts where the
// last one stopped (method, session protocol). The text goes to the agent as context. The phases folder and the method are roles of the profile file.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProfile } from '../lib/profile.mjs'
import { runHook } from './io.mjs'

const IN_PROGRESS = /\*\*Status:\*\*\s*🟡/

// The phase files that say "in progress", as { file, title, log }
export function phasesInProgress(readText, list, PHASES) {
  return list(PHASES)
    .filter((name) => /^phase-\d+-.+\.md$/.test(name))
    .flatMap((name) => {
      const text = readText(`${PHASES}/${name}`)
      if (!IN_PROGRESS.test(text)) {
        return []
      }
      const title = text.match(/^# (.+)$/m)?.[1] ?? name
      const log = text.match(/\(\.\/(work-logs\/[^)]+\.md)\)/)?.[1]
      return [{ file: `${PHASES}/${name}`, title, log: log ? `${PHASES}/${log}` : null }]
    })
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

// The message to print for a repository
export function sessionStartMessage(branch, readText, list, phasesDir, methodPath = 'the method') {
  const lines = [`Branch: ${branch || 'unknown'}`]
  const phases = phasesInProgress(readText, list, phasesDir)

  if (!phases.length) {
    lines.push('No phase is in progress.')
  }
  for (const phase of phases) {
    lines.push(`Phase in progress: ${phase.title} (${phase.file})`)
    const step = phase.log ? lastNextStep(readText(phase.log)) : null
    lines.push(step ? `Last next step (${phase.log}): ${step}` : 'No next step is recorded in the work log.')
    for (const fragment of phase.log ? fragmentsInProgress(phase.log, readText, list) : []) {
      lines.push(`Task in progress (${fragment.file}): ${fragment.step ?? 'no next step recorded'}`)
    }
  }
  lines.push(`Read the method, section "Session protocol" (${methodPath}), before you start or resume a phase.`)
  return lines.join('\n')
}

export function decide(event) {
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
  return {
    context: sessionStartMessage(
      branch,
      readText,
      list,
      profile.paths?.phases ?? 'docs/plan/phases',
      profile.documents?.method
    )
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runHook((event) => decide(event), { kind: 'session-start' })
}
