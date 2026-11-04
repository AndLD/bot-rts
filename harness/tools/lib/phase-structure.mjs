// The structure of a phase as the plan method states it (core/plan/phases.md, sections 1, 7 and 9; task 4.2): the parts of the phase index present and in
// order, the back-links of the index, the tasks and the logs, the work log, the record of every done task, and the tasks that one task needs. Pure functions
// on texts (a test passes strings); `harness check plan` calls them through `parsePhaseFolder` and `planSummary`. What is judgment and not checked here: that
// the goal is clear, that a task is atomic and verifiable, and that the exit criteria are observable (the method says so).
import { posix } from 'node:path'

const TASK_LOG_FIRST = /^\[←[^\]]*\]\(([^)]+)\)/
const VERSION = /`?\b\d+\.\d+\.\d+(?:-[\w.]+)?\b`?/g
const TASK_OR_ISSUE = /\b(?:\d+\.\d+[a-z]?|I-\d+)\b/g

// The parts of a phase index, in the order of the template; a part marked `optional` may be missing, and is checked for its place when it is there
export const INDEX_PARTS = Object.freeze([
  { name: 'title', pattern: /^# Phase \d+ — /m, hint: '`# Phase <n> — <theme> (<size> SP)`' },
  { name: 'status line', pattern: /^\*\*Status:\*\*/m, hint: '`**Status:** …`' },
  { name: 'execution order', pattern: /^\*\*Execution order:\*\*/m, hint: '`**Execution order:** …`', optional: true },
  { name: 'task table', pattern: /^<!-- phase-tasks:start -->/m, hint: 'the task table between its two markers' },
  { name: 'task legend', pattern: /^Task status:/m, hint: 'the line `Task status: …`' },
  { name: 'exit criteria', pattern: /^\*\*Exit criteria:\*\*/m, hint: '`**Exit criteria:** …`' },
  { name: 'implementation log', pattern: /^## Implementation log\s*$/m, hint: 'the heading `## Implementation log`' }
])

/** The link of the first line of a document when that line is a back-link `[← …](target)`, else null. */
export const backLinkOf = (text) => TASK_LOG_FIRST.exec(text.split('\n').find((line) => line.trim()) ?? '')?.[1] ?? null

// Where a link written in the document `from` points, as a path of the repository (a fragment and a query are dropped)
const target = (from, link) => posix.normalize(posix.join(posix.dirname(from), link.split('#')[0].split('?')[0]))

/**
 * A document's first line must be a back-link that resolves to `expected` (a path of the repository).
 * @returns {string[]} the problems
 */
export function backLinkProblems({ file, text, expected, what }) {
  const link = backLinkOf(text)
  if (link === null) {
    return [
      `${file}: the first line must be a link back to ${what} (\`[← …](${posix.relative(posix.dirname(file), expected)})\`)`
    ]
  }
  return target(file, link) === expected
    ? []
    : [`${file}: the first line links to ${link}, which is not ${what} (${expected})`]
}

/**
 * The parts of a phase index (`INDEX_PARTS`) present and in order. The exit criteria are the line `**Exit criteria:**` of the template, not a heading of
 * their own, so that every phase reads the same way.
 * @returns {string[]} the problems
 */
export function indexPartsProblems({ file, text, skip = [] }) {
  const problems = []
  const found = []
  for (const part of INDEX_PARTS.filter(({ name }) => !skip.includes(name))) {
    const at = text.search(part.pattern)
    if (at < 0) {
      if (!part.optional) {
        problems.push(
          `${file}: the phase index has no ${part.name} (${part.hint}); start from core/plan/phase-index-template.md`
        )
      }
      continue
    }
    const previous = found.find((other) => other.at > at)
    if (previous) {
      problems.push(
        `${file}: the ${part.name} must come before the ${previous.name}; the order is ${INDEX_PARTS.map((item) => item.name).join(', ')}`
      )
    }
    found.push({ name: part.name, at })
  }
  if (/^#{1,6}\s*Exit criteria\b/im.test(text)) {
    problems.push(
      `${file}: write the exit criteria as the line \`**Exit criteria:** …\` of the template, not as a heading`
    )
  }
  return problems
}

/**
 * The work log link of the status line resolves; a phase that has a `log.md` links it (a phase with nothing to record yet may name the file without a link,
 * as the template says).
 */
export function workLogProblems({ file, text, exists }) {
  const link = /\*\*Work log:\*\*\s*\[[^\]]*\]\(([^)]+)\)/.exec(text)?.[1]
  if (!link) {
    return exists('log.md')
      ? [`${file}: the status line must link the work log, which exists (\`**Work log:** [log](./log.md)\`)`]
      : []
  }
  return exists(link.replace(/^\.\//, '')) ? [] : [`${file}: the work log ${link} does not exist`]
}

/**
 * A log (the phase's `log.md`, or the `<id>.log.md` of a task) links back to the document it belongs to, and the log of a task starts with a status line.
 */
export function logProblems({ file, text, expected, what, status }) {
  const problems = backLinkProblems({ file, text, expected, what })
  if (status && !/^\*\*Status:\*\*\s*(⬜|🟡|✅)/m.test(text)) {
    problems.push(`${file}: the log must have a \`**Status:** 🟡|✅\` line (core/plan/task-log-template.md)`)
  }
  return problems
}

/**
 * A done task has its record: a phase with per-task records has the log of the task; a phase that keeps a table in its implementation log has the task in
 * that table (the plan method, section 5).
 * @param {{ done: string[], section: string, hasLog: (id: string) => boolean, file: string }} input `section` is the text under the heading `Implementation log`
 */
export function recordProblems({ done, section, hasLog, file }) {
  const table = section.split('\n').filter((line) => /^\|/.test(line) && !/^\|\s*[-: |]+\|?\s*$/.test(line))
  const missing = done.filter((id) =>
    table.length > 1
      ? !new RegExp(`(?<![\\w.])${id.replace('.', '\\.')}(?![\\w.])`).test(table.join('\n'))
      : !hasLog(id)
  )
  return missing.length
    ? [
        table.length > 1
          ? `${file}: the done tasks ${missing.join(', ')} have no row in the implementation log`
          : `${file}: the done tasks ${missing.join(', ')} have no log of their own (\`<id>.log.md\`) and the implementation log keeps no table`
      ]
    : []
}

/** The text under the heading `## Implementation log` of a phase file, to its next heading. */
export function implementationSection(text) {
  const at = text.search(/^## Implementation log\s*$/m)
  if (at < 0) {
    return ''
  }
  const rest = text.slice(at).split('\n').slice(1)
  const end = rest.findIndex((line) => /^#{1,2} /.test(line))
  return (end < 0 ? rest : rest.slice(0, end)).join('\n')
}

const idsOf = (text) => [...text.replace(VERSION, ' ').matchAll(TASK_OR_ISSUE)].map((match) => match[0])
const phaseOf = (id) => (id.startsWith('I-') ? null : Number(id.split('.')[0]))

/**
 * The tasks that a task needs (its `Needs` field) must exist, in a phase or in the issue queue, and never in a later phase (the plan method, section 2).
 * @param {{ id: string, needs: string|null, file: string }[]} tasks the tasks whose `needs` are checked
 * @param {Set<string>} known every id of the plan: tasks, issues, and the ids an issue took over
 */
export function needsProblems({ tasks, known, phase }) {
  return tasks.flatMap((task) =>
    idsOf(task.needs ?? '').flatMap((id) => {
      if (!known.has(id)) {
        return [`${task.file}: the task needs ${id}, which exists in no phase and not in the issue queue`]
      }
      const later = phaseOf(id)
      return later !== null && later > phase
        ? [`${task.file}: the task needs ${id}, a task of a later phase; a task never depends on a later phase`]
        : []
    })
  )
}
