// The plan tools (design §7.1): the summary table and the contents of the plan index, written from the phase files (`harness plan summary`),
// and the implementation log of a phase, printed from the merged pull requests (`harness plan log`). The squash commits on the integration
// branch carry the plan task ids in a `Plan: <id>[, <id>]` line of their body, and the pull request number in the subject.
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

export const SUMMARY_START = '<!-- plan-summary:start -->'
export const SUMMARY_END = '<!-- plan-summary:end -->'
export const CONTENTS_START = '<!-- plan-contents:start -->'
export const CONTENTS_END = '<!-- plan-contents:end -->'

const TITLE = /^# Phase (\d+) — (.+?) \((\d+) SP(?:, ([^)]*))?\)\s*$/m
const STATUS = /\*\*Status:\*\*\s*((?:⬜|🟡|✅)\s*[A-Za-z ]+?)\s*(?:·|$)/m
// A task row: its id, the agent-complexity marker in the cell before the size (when it has one), the size and the status symbol
const TASK_ROW = /^\| (\d+\.\d+[a-z]?) \|.*?\|(?: (C\d+) \|)? (\d+) \| (⬜|🟡|✅)[^|]*\|\s*$/gm

// { number, theme, points, note, status, file, title, taskPoints, markers, unmarked } of a phase file, or throws with the file name.
// `markers` are the agent-complexity markers of its tasks (of done ones too, where they were recorded); `unmarked` are the ids of its open
// tasks (⬜ or 🟡) without one, since a done task is exempt.
export function parsePhase(file, text) {
  const title = TITLE.exec(text)
  const status = STATUS.exec(text)
  if (!title) {
    throw new Error(`${file}: the title must read "# Phase <n> — <theme> (<size> SP)"`)
  }
  if (!status) {
    throw new Error(`${file}: the status line must start with "**Status:** ⬜|🟡|✅ <words>"`)
  }
  const rows = [...text.matchAll(TASK_ROW)]
  const taskPoints = rows.reduce((sum, match) => sum + Number(match[3]), 0)

  return {
    number: Number(title[1]),
    theme: title[2],
    points: Number(title[3]),
    note: title[4] ?? '',
    status: status[1].replace(/\s+/g, ' '),
    file,
    title: `Phase ${title[1]} — ${title[2]} (${title[3]} SP${title[4] ? `, ${title[4]}` : ''})`,
    taskPoints,
    markers: rows.filter((match) => match[2]).map((match) => match[2]),
    unmarked: rows.filter((match) => !match[2] && match[4] !== '✅').map((match) => match[1])
  }
}

/** The markers of a complexity scale (`plan.complexity.scale`), lightest first; empty when the plan has no markers. */
export const markersOf = (complexity) => Object.keys(complexity?.scale ?? {})

/**
 * Problems of one phase: the size in the title is the sum of the sizes of its tasks, and, when the plan has agent-complexity markers
 * (`complexity` is `plan.complexity`), every open task carries one from the scale.
 */
export function phaseProblems(phase, complexity) {
  const problems = []
  if (phase.taskPoints !== phase.points) {
    problems.push(`${phase.file}: the title says ${phase.points} SP but the tasks add up to ${phase.taskPoints} SP`)
  }
  const scale = markersOf(complexity)
  if (scale.length) {
    if (phase.unmarked.length) {
      problems.push(
        `${phase.file}: open tasks without an agent-complexity marker (${scale.join(', ')}): ${phase.unmarked.join(', ')}`
      )
    }
    const unknown = [...new Set(phase.markers)].filter((marker) => !scale.includes(marker))
    if (unknown.length) {
      problems.push(`${phase.file}: markers that are not on the scale (${scale.join(', ')}): ${unknown.join(', ')}`)
    }
  }
  return problems
}

/** The range of a phase's markers on the scale: `C2`, `C1–C3`, or `—` when it has none. */
export function complexityRange(markers, complexity) {
  const scale = markersOf(complexity)
  const levels = [...new Set(markers)]
    .filter((marker) => scale.includes(marker))
    .sort((a, b) => scale.indexOf(a) - scale.indexOf(b))
  if (!levels.length) {
    return '—'
  }
  return levels.length === 1 ? levels[0] : `${levels[0]}–${levels.at(-1)}`
}

export function summaryTable(phases, { complexity } = {}) {
  const marked = markersOf(complexity).length > 0
  const sorted = [...phases].sort((a, b) => a.number - b.number)
  const total = sorted.reduce((sum, phase) => sum + phase.points, 0)
  const grows = sorted.filter((phase) => phase.note.includes('grows')).map((phase) => `Phase ${phase.number}`)
  const last = sorted.at(-1)?.number ?? 0
  const lines = marked
    ? [
        '| Phase | Theme | Story points | Agent complexity | Status |',
        '| ----- | ----- | ------------ | ---------------- | ------ |'
      ]
    : ['| Phase | Theme | Story points | Status |', '| ----- | ----- | ------------ | ------ |']

  for (const phase of sorted) {
    const range = marked ? ` ${complexityRange(phase.markers, complexity)} |` : ''
    lines.push(
      `| ${phase.number} | ${phase.theme} | ${phase.points}${phase.note.includes('grows') ? ' (grows)' : ''} |${range} ${phase.status} |`
    )
  }
  lines.push(
    `|  | **Total of Phases 0–${last}** | **${total}**${grows.length ? ` (${grows.join(', ')} grows as issues are added)` : ''} |${marked ? ' | ' : ' '}|`
  )

  return lines.join('\n')
}

// `phasesLink` is the link from the plan index to the folder of the phase files
export function contentsList(phases, phasesLink = './phases') {
  return [...phases]
    .sort((a, b) => a.number - b.number)
    .map((phase) => `- [${phase.title}](${phasesLink}/${phase.file})`)
    .join('\n')
}

function replaceBetween(text, start, end, body) {
  const from = text.indexOf(start)
  const to = text.indexOf(end)
  if (from < 0 || to < from) {
    throw new Error(`The plan index has no ${start} … ${end} block`)
  }
  return `${text.slice(0, from + start.length)}\n${body}\n${text.slice(to)}`
}

// The index text with both generated blocks rewritten
export function renderIndex(indexText, phases, { phasesLink, complexity } = {}) {
  const withSummary = replaceBetween(indexText, SUMMARY_START, SUMMARY_END, summaryTable(phases, { complexity }))
  return replaceBetween(withSummary, CONTENTS_START, CONTENTS_END, contentsList(phases, phasesLink))
}

const PLAN_LINE = /^Plan:\s*(.+)$/gm

// `commits` are { subject, body, date } of the commits on the integration branch, newest first. Returns the rows of the phase,
// oldest first: { tasks, pr, title, date }.
export function implementationRows(commits, phase) {
  const rows = []

  for (const { subject, body, date } of commits) {
    const tasks = [...body.matchAll(PLAN_LINE)]
      .flatMap((match) => match[1].split(/[,\s]+/))
      .filter((task) => task.startsWith(`${phase}.`))
    const pr = /\(#(\d+)\)\s*$/.exec(subject)?.[1]
    if (!tasks.length || !pr) {
      continue
    }
    rows.push({
      tasks: [...new Set(tasks)].sort(compareTasks),
      pr,
      title: subject.replace(/\s*\(#\d+\)\s*$/, ''),
      date: date.slice(0, 10)
    })
  }

  return rows.reverse()
}

// 15.4 before 15.10, 15.9 before 15.9a
function compareTasks(a, b) {
  const [, minorA = '0'] = a.split('.')
  const [, minorB = '0'] = b.split('.')
  return parseInt(minorA, 10) - parseInt(minorB, 10) || minorA.localeCompare(minorB)
}

// The table, with links to the pull requests of `repoUrl`
export function implementationLog(rows, repoUrl) {
  const lines = ['| Tasks | PR | Change | Merged |', '| ----- | -- | ------ | ------ |']

  for (const { tasks, pr, title, date } of rows) {
    lines.push(`| ${tasks.join(', ')} | [#${pr}](${repoUrl}/pull/${pr}) | ${title.replace(/\|/g, '\\|')} | ${date} |`)
  }

  return lines.join('\n')
}

const PHASE_FILE = /^phase-\d+-.+\.md$/

/**
 * `harness plan summary`: rewrites the generated blocks of the plan index from the phase files, or with `check` only compares them.
 * @returns {{ problems: string[], message: string }}
 */
export function planSummary({ root, profile, check = false }) {
  const { phases: phasesDir, planIndex } = profile.paths
  const phases = readdirSync(join(root, phasesDir))
    .filter((name) => PHASE_FILE.test(name))
    .map((name) => parsePhase(name, readFileSync(join(root, phasesDir, name), 'utf8')))

  const complexity = profile.plan?.complexity
  const problems = phases.flatMap((phase) => phaseProblems(phase, complexity))
  const current = readFileSync(join(root, planIndex), 'utf8')
  const link = relative(dirname(planIndex), phasesDir).split('\\').join('/')
  const expected = renderIndex(current, phases, { phasesLink: link.startsWith('.') ? link : `./${link}`, complexity })

  if (check) {
    if (expected !== current) {
      problems.push(
        `${planIndex}: the summary or the contents disagree with the phase files; run \`harness plan summary\``
      )
    }
    return { problems, message: `Checked the plan summary against ${phases.length} phase files.` }
  }
  writeFileSync(join(root, planIndex), expected)
  return { problems, message: `Wrote the plan summary of ${phases.length} phases.` }
}

/** `harness plan log <phase> [ref]`: the implementation log of a phase from the commits of `ref` (default: the integration branch on the remote). */
export function planLog({ root, profile, phase, ref = `origin/${profile.branches.integration}` }) {
  if (!/^\d+$/.test(phase ?? '')) {
    throw new Error('the phase is a number: harness plan log <phase> [ref]')
  }
  const SEPARATOR = '\u001e'
  const FIELD = '\u001f'
  const output = execFileSync(
    'git',
    ['log', ref, `--grep=^Plan: ${phase}\\.`, `--format=%s${FIELD}%b${FIELD}%cI${SEPARATOR}`],
    {
      cwd: root,
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
  return implementationLog(implementationRows(commits, phase), profile.repository.url)
}
