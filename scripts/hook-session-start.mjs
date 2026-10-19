// Agent-runtime hook (SessionStart): prints the branch, the phase in progress and the last "Next step" of its work log, so that a
// session starts where the last one stopped (method, session protocol). The text goes to the agent as context.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PHASES = 'docs/development-plan/phases'
const IN_PROGRESS = /\*\*Status:\*\*\s*🟡/

// The phase files that say "in progress", as { file, title, log }
export function phasesInProgress(readText, list) {
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

// The text of the last "Next step" line of a work log, or null
export function lastNextStep(logText) {
  const steps = [...logText.matchAll(/^- \*\*Next step:\*\*\s*(.+)$/gm)]
  return steps.length ? steps[steps.length - 1][1].trim() : null
}

// The message to print for a repository
export function sessionStartMessage(branch, readText, list) {
  const lines = [`Branch: ${branch || 'unknown'}`]
  const phases = phasesInProgress(readText, list)

  if (!phases.length) {
    lines.push('No phase is in progress.')
  }
  for (const phase of phases) {
    lines.push(`Phase in progress: ${phase.title} (${phase.file})`)
    const step = phase.log ? lastNextStep(readText(phase.log)) : null
    lines.push(step ? `Last next step (${phase.log}): ${step}` : 'No next step is recorded in the work log.')
  }
  lines.push('Read the method, section "Session protocol", before you start or resume a phase.')
  return lines.join('\n')
}

function main() {
  const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
  const readText = (path) => readFileSync(join(root, path), 'utf8')
  const list = (path) => (existsSync(join(root, path)) ? readdirSync(join(root, path)) : [])
  let branch = ''
  try {
    branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  } catch {
    // not a git checkout
  }
  process.stdout.write(`${sessionStartMessage(branch, readText, list)}\n`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
