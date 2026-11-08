// The step report of a flow's worker (task 6.4): its schema and its hard cap, held in one place. The wording of the schema is the section `report` of the prompt
// template (`core/plan/flow-step-prompts.md`), which takes the cap from here; `harness flow report-check <file>` checks a report against both, so that an orchestrator
// reads a report whole without paying for prose, and a report over the cap says where the rest went (the task's log) instead of growing. Pure functions on text.
import { readFileSync } from 'node:fs'

/** The hard cap of a step report: lines and characters, the whole text. What does not fit goes to the task's log, and the report links it. */
export const REPORT_CAP = { lines: 30, characters: 2400 }

/** The labelled lines of the schema, in order; the status takes one of `STATUSES`; the heading of the recommendations comes last. */
export const REPORT_LABELS = ['Status', 'Merged', 'Decisions', 'Deviations', 'Next step']
export const STATUSES = ['done', 'partial', 'blocked']
const HEADING = /^#{0,6}\s*\**Recommendations\**:?\s*$/i

// A line without the markup a worker may add around its label (a list dash, bold)
const bare = (line) => line.replace(/^\s*(?:[-*]\s+)?/, '').replace(/\*\*/g, '')

/** The problems of a step report: a label that is missing or out of order, a status that is none of `STATUSES`, text after the recommendations that is not theirs, and the cap. */
export function checkStepReport(text, cap = REPORT_CAP) {
  const problems = []
  const lines = text.replace(/\s+$/, '').split('\n')
  let from = 0
  for (const label of REPORT_LABELS) {
    const found = lines.findIndex((line, index) => index >= from && bare(line).startsWith(`${label}:`))
    if (found === -1) {
      problems.push(
        lines.some((line) => bare(line).startsWith(`${label}:`))
          ? `"${label}:" is out of order; the order is ${REPORT_LABELS.join(', ')}, then Recommendations`
          : `the line "${label}:" is missing`
      )
      continue
    }
    from = found + 1
  }
  const status = lines.map(bare).find((line) => line.startsWith('Status:'))
  if (
    status &&
    !STATUSES.includes(
      status
        .slice('Status:'.length)
        .trim()
        .split(/[\s,.;—-]/)[0]
        .toLowerCase()
    )
  )
    problems.push(`the status is none of ${STATUSES.join(', ')}`)
  const heading = lines.findLastIndex((line) => HEADING.test(line.trim()))
  if (heading === -1) problems.push('the heading "Recommendations" is missing (it comes last, even when it says none)')
  else if (
    lines
      .slice(heading + 1)
      .some((line) => /^\s*(?:[-*]\s+)?\**(?:Status|Merged|Decisions|Deviations|Next step)\**:/.test(line))
  )
    problems.push('the recommendations come last: a labelled line follows them')
  if (lines.length > cap.lines)
    problems.push(
      `the report has ${lines.length} lines, over the cap of ${cap.lines}: move the rest to the task's log and link it`
    )
  if (text.length > cap.characters)
    problems.push(
      `the report has ${text.length} characters, over the cap of ${cap.characters}: move the rest to the task's log and link it`
    )
  return problems
}

/** `harness flow report-check <file>`: the report in a file (a file, so that the check prints a line and not the report). */
export function reportCheckCommand({ words }) {
  if (words.length !== 1) return { lines: ['usage: harness flow report-check <file>'], code: 2 }
  let text
  try {
    text = readFileSync(words[0], { encoding: 'utf8' })
  } catch {
    return { lines: [`cannot read ${words[0]}`], code: 1 }
  }
  const problems = checkStepReport(text)
  return problems.length
    ? {
        lines: [`${words[0]}: the step report breaks its schema:`, ...problems.map((problem) => `- ${problem}`)],
        code: 1
      }
    : {
        lines: [
          `${words[0]}: the step report follows the schema (${text.split('\n').length} lines, ${text.length} characters; the cap is ${REPORT_CAP.lines} and ${REPORT_CAP.characters}).`
        ],
        code: 0
      }
}
