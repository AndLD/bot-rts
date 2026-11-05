// The release order of a plan kept in a file of its own (task 5.1; the profile role `paths.releases`): one table `Release | Status | Tasks, in order |
// Consumers | Notes` and a list "Not scheduled". The order the tools read is the column of the tasks; the other columns are for people, and the generated block of the
// plan index says which release is current and which is next. Pure functions on the text of the file, so a test passes it as a string. A plan without the
// role keeps the order as a section of its index (`next-task.mjs`).

export const RELEASES_START = '<!-- plan-releases:start -->'
export const RELEASES_END = '<!-- plan-releases:end -->'
/** The status of a release, as the legend of the file says it. */
export const RELEASE_STATUSES = {
  '⬜': 'planned',
  '🟡': 'developing',
  '🏷': 'a development version cut',
  '✅': 'released'
}
export const RELEASE_COLUMNS = ['Release', 'Status', 'Tasks, in order', 'Consumers', 'Notes']

const TASK_ID = /\b(?:Phase (\d+)|(\d+\.\d+[a-z]?)|([IB]-\d+))\b/g
// A version (`0.1.2`, `1.0.0-dev.1`) holds what looks like a task id, so it is taken out first
const VERSION = /`?\b\d+\.\d+\.\d+(?:-[\w.]+)?\b`?/g
const SEPARATOR = /^\|\s*[-: |]+\|?\s*$/

const cellsOf = (line) =>
  line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim())
const plain = (text) => text.replace(/\*\*|`|\[([^\]]*)\]\([^)]*\)/g, '$1').trim()

/**
 * The tokens that a cell names, in order: a task or an issue or a backlog item by its id, or `{ phase }` for "Phase N".
 * @returns {(string | { phase: number })[]}
 */
export function tokensOf(cell) {
  return [...cell.replace(VERSION, ' ').matchAll(TASK_ID)].map((match) =>
    match[1] ? { phase: Number(match[1]) } : (match[2] ?? match[3])
  )
}

/**
 * The text of a releases file as data: `{ rows: [{ release, status, tasks, consumers, notes }], notScheduled: string[], problems: string[] }`. The table is the
 * first one whose first column is "Release"; a column is found by its name, so a project may add its own. `notScheduled` holds the ids of the list under the
 * heading "Not scheduled" (they are checked to exist but never ordered).
 */
export function readReleases(text) {
  const lines = text.split('\n')
  const problems = []
  const header = lines.findIndex((line) => line.startsWith('|') && /^release\b/i.test(cellsOf(line)[0] ?? ''))
  const rows = []
  if (header < 0) {
    problems.push('has no table whose first column is "Release"')
  } else {
    const names = cellsOf(lines[header]).map((cell) => plain(cell).toLowerCase())
    const column = (pattern) => names.findIndex((name) => pattern.test(name))
    const at = {
      release: 0,
      status: column(/^status/),
      tasks: column(/^tasks/),
      consumers: column(/^consumer/),
      notes: column(/^notes/)
    }
    for (const missing of ['status', 'tasks']) {
      if (at[missing] < 0) {
        problems.push(`its table has no column "${missing === 'tasks' ? 'Tasks, in order' : 'Status'}"`)
      }
    }
    if (!problems.length) {
      for (const line of lines.slice(header + 1)) {
        if (!line.startsWith('|')) {
          break
        }
        if (SEPARATOR.test(line)) {
          continue
        }
        const cells = cellsOf(line)
        const cell = (key) => (at[key] >= 0 ? (cells[at[key]] ?? '') : '')
        const status = [...cell('status')].find((symbol) => symbol in RELEASE_STATUSES) ?? null
        if (status === null) {
          problems.push(
            `the release ${cells[0] || '(unnamed)'} has no status: one of ${Object.keys(RELEASE_STATUSES).join(' ')} in the column "Status"`
          )
        }
        rows.push({
          release: cells[0] ?? '',
          status,
          tasks: cell('tasks'),
          consumers: cell('consumers'),
          notes: cell('notes')
        })
      }
    }
  }
  const heading = lines.findIndex((line) => /^#{1,6}\s*not scheduled\b/i.test(line))
  const after = heading < 0 ? [] : lines.slice(heading + 1)
  const end = after.findIndex((line) => /^#{1,6} /.test(line))
  const notScheduled = (end < 0 ? after : after.slice(0, end))
    .filter((line) => /^\s*[-*]\s/.test(line))
    .flatMap((line) => tokensOf(line).filter((token) => typeof token === 'string'))
  return { rows, notScheduled, problems }
}

/** The order of development in a releases file: the tokens of the column of the tasks, row by row. */
export const releaseOrder = (text) => readReleases(text).rows.flatMap((row) => tokensOf(row.tasks))

/**
 * The current release (the first one being developed, or with a development version cut) and the next one (the first one planned after it, or the first one
 * planned when none is current); each `null` when there is none.
 */
export function currentAndNext(rows) {
  const current = rows.findIndex((row) => row.status === '🟡' || row.status === '🏷')
  const next = rows.findIndex((row, index) => index > current && row.status === '⬜')
  return { current: rows[current] ?? null, next: rows[next] ?? null }
}

/**
 * The line of the generated block of the plan index: the current release and its state, the next release, and the link to the releases file.
 * @param {ReturnType<typeof readReleases>['rows']} rows
 * @param {string} link the path of the releases file from the plan index
 */
export function releasesLine(rows, link) {
  const { current, next } = currentAndNext(rows)
  const state = (row) => `${row.release} (${row.status} ${RELEASE_STATUSES[row.status]})`
  const parts = [
    current ? `Current release: ${state(current)}.` : 'No release is being developed.',
    next ? `Next: ${state(next)}.` : 'No release is planned after it.',
    `The order of the releases and of their tasks: [releases](${link}).`
  ]
  return parts.join(' ')
}

/** The text of a releases file written by a migration: the table of the given rows, the notes that the old section held, and an empty "Not scheduled" list. */
export function releasesFile({ title, rows, notes = '', indexLink = './README.md' }) {
  const table = [
    `| ${RELEASE_COLUMNS.join(' | ')} |`,
    `| ${RELEASE_COLUMNS.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${[row.release, row.status, row.tasks, row.consumers, row.notes].join(' | ')} |`)
  ]
  return [
    `[← Development plan index](${indexLink})`,
    '',
    `# Releases of ${title}`,
    '',
    'The order of the releases and of the tasks in each, which the tools read to choose the next task. A row names tasks and',
    'issues, in order, or "Phase N" for the tasks of a phase in its own order; never a backlog item, which the owner promotes into a task first.',
    '',
    'Status: ⬜ planned · 🟡 developing · 🏷 a development version cut · ✅ released.',
    '',
    ...table,
    '',
    '## Not scheduled',
    '',
    '- None.',
    ...(notes.trim() ? ['', '## Notes', '', notes.trim()] : []),
    ''
  ].join('\n')
}
