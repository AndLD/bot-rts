// The issue queue (task 3.13): the defects and improvements found in use, kept next to the phases and not among them. `paths.issues` is a folder with
// `README.md` (the index of the open and in-progress issues, generated), `I-<n>.md` for each issue, `I-<n>.log.md` beside it, and `archived/` for the
// finished ones with its own generated `README.md`. An agent that works the queue reads the open index and never the archive. The plan-summary command
// archives an issue that is done (moving its file and its log, and following every link to them) and writes both indexes.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { followMoves, replacePaths, rewriteLinks } from './link-moves.mjs'

export const QUEUE_START = '<!-- issue-queue:start -->'
export const QUEUE_END = '<!-- issue-queue:end -->'
export const ARCHIVE_FOLDER = 'archived'
export const UNCLASSIFIED = 'Unclassified'

export const ISSUE_FILE = /^(I-\d+)\.md$/
export const ISSUE_LOG_FILE = /^(I-\d+)\.log\.md$/

const TITLE = /^# (I-\d+) — (.+?)\s*$/m
const SYMBOL = /(⬜|🟡|✅)/
const field = (text, name) => new RegExp(`\\*\\*${name}:\\*\\*\\s*([^\\n]*?)\\s*(?:·|$)`, 'm').exec(text)?.[1] ?? null

/** The number of an issue id (`I-12` gives 12). */
export const issueNumber = (id) => Number(id.slice(2))

/** One issue file: `{ id, title, status, agent, points, area, reported, formerly, log }`, and the `problems` of its shape. */
export function parseIssueFile(file, text) {
  const heading = TITLE.exec(text)
  const size = field(text, 'Size')?.match(/^(\d+) SP$/)
  const status = field(text, 'Status')?.match(SYMBOL)?.[1] ?? null
  const area = field(text, 'Area')
  const reported = /\*\*Reported:\*\*\s*(.+?)\s*(?:\s·\s\*\*|$)/m.exec(text)?.[1] ?? null
  const problems = []
  if (!heading) {
    problems.push(`${file}: the title must read "# I-<n> — <title>"`)
  } else if (`${heading[1]}.md` !== file.split('/').at(-1)) {
    problems.push(`${file}: the title names issue ${heading[1]}, but the file is named for another`)
  }
  if (!status) problems.push(`${file}: the status line must hold "**Status:** ⬜|🟡|✅"`)
  if (!size) problems.push(`${file}: the status line must hold "**Size:** <n> SP"`)
  if (!area)
    problems.push(`${file}: the status line must hold "**Area:** <an area of the migration notes, or ${UNCLASSIFIED}>"`)
  if (!reported) {
    problems.push(
      `${file}: the status line must hold "**Reported:** <every report that points to this issue>" (— for none)`
    )
  }
  return {
    id: heading?.[1] ?? null,
    title: heading?.[2] ?? null,
    status,
    agent: field(text, 'Agent')?.match(/C\d+/)?.[0] ?? null,
    points: size ? Number(size[1]) : null,
    area,
    reported,
    formerly: field(text, 'Formerly'),
    fixedIn: field(text, 'Fixed in'),
    log: /\*\*Log:\*\*\s*\[[^\]]*\]\(([^)]+)\)/.exec(text)?.[1] ?? null,
    file,
    problems
  }
}

const cell = (text) => (text ?? '—').replace(/\|/g, '\\|')

/** The table of the open issues, in order of id. */
export function openTable(issues, { marked }) {
  const head = marked
    ? [
        '| Issue | Title | Area | Agent | SP | Status | Reported |',
        '| ----- | ----- | ---- | ----- | -- | ------ | -------- |'
      ]
    : ['| Issue | Title | Area | SP | Status | Reported |', '| ----- | ----- | ---- | -- | ------ | -------- |']
  const rows = issues.map((issue) => {
    const link = `[${issue.id}](./${issue.id}.md)`
    const common = [cell(issue.title), cell(issue.area)]
    const rest = [issue.points ?? '—', issue.status ?? '—', cell(issue.reported)]
    return `| ${[link, ...common, ...(marked ? [issue.agent ?? '—'] : []), ...rest].join(' | ')} |`
  })
  return [...head, ...rows].join('\n')
}

/** The table of the archived issues. */
export function archiveTable(issues) {
  const rows = issues.map(
    (issue) =>
      `| [${issue.id}](./${issue.id}.md) | ${cell(issue.title)} | ${cell(issue.area)} | ${issue.points ?? '—'} | ${cell(issue.reported)} |`
  )
  return ['| Issue | Title | Area | SP | Reported |', '| ----- | ----- | ---- | -- | -------- |', ...rows].join('\n')
}

const byNumber = (a, b) => issueNumber(a.id) - issueNumber(b.id)

/** The text with the block between the queue markers replaced; null when the markers are missing. */
export function withQueueBlock(text, body) {
  const from = text.indexOf(QUEUE_START)
  const to = text.indexOf(QUEUE_END)
  return from < 0 || to < from ? null : `${text.slice(0, from + QUEUE_START.length)}\n${body}\n${text.slice(to)}`
}

/**
 * The queue at `dir`: `null` when the folder has no `README.md`; otherwise its open and archived issues, read from `list(path)` (the names in a folder) and
 * `readText(path)`.
 */
export function readQueue({ list, readText, dir }) {
  const names = list(dir)
  if (!names.includes('README.md')) {
    return null
  }
  const issuesIn = (folder) =>
    list(folder)
      .filter((name) => ISSUE_FILE.test(name))
      .map((name) =>
        parseIssueFile(`${folder === dir ? '' : `${ARCHIVE_FOLDER}/`}${name}`, readText(`${folder}/${name}`))
      )
      .sort(byNumber)
  const archive = `${dir}/${ARCHIVE_FOLDER}`
  return {
    dir,
    readme: readText(`${dir}/README.md`),
    archiveReadme: list(archive).includes('README.md') ? readText(`${archive}/README.md`) : null,
    open: issuesIn(dir),
    archived: issuesIn(archive),
    names,
    archiveNames: list(archive)
  }
}

/** The next free issue number: above every open and archived issue, and above the numbers a migration took (`I-3, formerly 12.5`). */
export const nextIssueNumber = (queue) =>
  Math.max(0, ...[...queue.open, ...queue.archived].map((issue) => issueNumber(issue.id))) + 1

/**
 * The problems of a queue: the shape of each issue file, an area off the list, a marker off the scale, a log link that does not resolve, a done issue
 * that is not archived (or an archived one that is not done), ids used twice, and the two indexes disagreeing with the files.
 * @param {{ areas?: string[], scale?: string[], exists: (path: string) => boolean }} options `exists` takes a path relative to the queue's folder
 */
export function queueProblems(queue, { areas = null, scale = [], exists }) {
  const where = `${queue.dir}/README.md`
  const problems = [...queue.open, ...queue.archived].flatMap((issue) => issue.problems.map((p) => `${queue.dir}/${p}`))
  const seen = new Set()
  for (const issue of [...queue.open, ...queue.archived]) {
    const path = `${queue.dir}/${issue.file}`
    if (issue.id && seen.has(issue.id)) problems.push(`${path}: the id ${issue.id} is used twice (open and archived)`)
    seen.add(issue.id)
    if (areas && issue.area && issue.area !== UNCLASSIFIED && !areas.includes(issue.area)) {
      problems.push(
        `${path}: the area "${issue.area}" is not an area of the migration notes (${areas.join(', ')}), nor ${UNCLASSIFIED}`
      )
    }
    if (
      issue.log &&
      !exists(
        `${issue.file.split('/').slice(0, -1).join('/')}${issue.file.includes('/') ? '/' : ''}${issue.log.replace(/^\.\//, '')}`
      )
    ) {
      problems.push(`${path}: the log ${issue.log} does not exist`)
    }
  }
  for (const issue of queue.open) {
    if (issue.status === '✅')
      problems.push(`${queue.dir}/${issue.file}: the issue is done and not archived; run \`harness plan summary\``)
    if (scale.length && issue.status && issue.status !== '✅') {
      if (!issue.agent)
        problems.push(`${queue.dir}/${issue.file}: an open issue needs "**Agent:** <marker>" (${scale.join(', ')})`)
      else if (!scale.includes(issue.agent))
        problems.push(`${queue.dir}/${issue.file}: the marker ${issue.agent} is not on the scale (${scale.join(', ')})`)
    }
  }
  for (const issue of queue.archived) {
    if (issue.status && issue.status !== '✅') {
      problems.push(`${queue.dir}/${issue.file}: an archived issue must be done (✅)`)
    }
  }
  const expectedOpen = withQueueBlock(queue.readme, openTable(queue.open, { marked: scale.length > 0 }))
  if (expectedOpen === null) problems.push(`${where}: the issue table must sit between ${QUEUE_START} and ${QUEUE_END}`)
  else if (expectedOpen !== queue.readme)
    problems.push(`${where}: the issue table disagrees with the issue files; run \`harness plan summary\``)
  if (queue.archiveReadme !== null) {
    const expected = withQueueBlock(queue.archiveReadme, archiveTable(queue.archived))
    if (expected === null)
      problems.push(
        `${queue.dir}/${ARCHIVE_FOLDER}/README.md: the table must sit between ${QUEUE_START} and ${QUEUE_END}`
      )
    else if (expected !== queue.archiveReadme)
      problems.push(
        `${queue.dir}/${ARCHIVE_FOLDER}/README.md: the table disagrees with the archived issues; run \`harness plan summary\``
      )
  } else if (queue.archived.length) {
    problems.push(`${queue.dir}/${ARCHIVE_FOLDER}/README.md is missing, and issues are archived`)
  }
  return problems
}

/** The line of the plan index about the queue: the open issues and their size, apart from the phases' totals. */
export function queueSummary(queue, link) {
  const open = queue.open.filter((issue) => issue.status !== '✅')
  const points = open.reduce((sum, issue) => sum + (issue.points ?? 0), 0)
  const started = open.filter((issue) => issue.status === '🟡').length
  return (
    `**Issue queue** (not a phase; its size is not in the totals above): [${open.length} open](${link}), ${points} SP` +
    `${started ? `, ${started} in progress` : ''}; ${queue.archived.length} archived.`
  )
}

/**
 * Archives the issues that are done: moves `I-<n>.md` and `I-<n>.log.md` into `archived/` and follows every link to them across the repository.
 * @returns {{ moves: Map<string, string>, touched: string[] }}
 */
export function archiveDone({ root, queue }) {
  const done = queue.open.filter((issue) => issue.status === '✅')
  const moves = new Map()
  for (const issue of done) {
    for (const name of [`${issue.id}.md`, `${issue.id}.log.md`]) {
      if (existsSync(join(root, queue.dir, name))) {
        moves.set(`${queue.dir}/${name}`, `${queue.dir}/${ARCHIVE_FOLDER}/${name}`)
      }
    }
  }
  if (!moves.size) {
    return { moves, touched: [] }
  }
  mkdirSync(join(root, queue.dir, ARCHIVE_FOLDER), { recursive: true })
  for (const [from, to] of moves) {
    const text = rewriteLinks(readFileSync(join(root, from), 'utf8'), from, to, moves)
    // The back-link of an archived issue is the archive's index
    const next = replacePaths(text, moves).replace(/^\[← [^\]]*\]\([^)]*\)/, (link) =>
      to.endsWith('.log.md') ? link : '[← Archived issues](./README.md)'
    )
    mkdirSync(dirname(join(root, to)), { recursive: true })
    writeFileSync(join(root, to), next)
    rmSync(join(root, from))
  }
  const touched = followMoves({ root, moves })
  return { moves, touched }
}
