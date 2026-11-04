// The issue queue (task 3.13): the defects and improvements found in use, kept next to the phases and not among them. `paths.issues` is a folder with
// `README.md` (the index of the open and in-progress issues, generated), `I-<n>.md` for each issue, `I-<n>.log.md` beside it, and `archived/` for the
// finished ones with its own generated `README.md`. An agent that works the queue reads the open index and never the archive. The plan-summary command
// archives an issue that is done (moving its file and its log, and following every link to them) and writes both indexes.
//
// The backlog (task 3.20) is the same queue for the feature requests: `paths.backlog`, items `B-<n>.md`, and a `Source:` field in place of `Reported:`. A
// queue is read with a `kind` (`ISSUES` or `BACKLOG`), which the queue carries, so the functions below serve both. An item of the backlog is a proposal the
// owner has not approved (task 3.21): it is `Proposed` and never started as it is, and when the owner promotes it into a task of a phase it is `Promoted`
// (`Promoted to: <task id>`) and moves to the archive, which is where a finished issue goes; `finished` says which statuses end an entry in each queue.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { followMoves, replacePaths, rewriteLinks } from './link-moves.mjs'

/** The two queues: what differs between them (the id prefix, the markers of the generated index, the field that says where an entry came from). */
export const ISSUES = Object.freeze({
  prefix: 'I',
  noun: 'issue',
  heading: 'Issue',
  start: '<!-- issue-queue:start -->',
  end: '<!-- issue-queue:end -->',
  sourceField: 'Reported',
  archiveTitle: 'Archived issues'
})
export const BACKLOG = Object.freeze({
  prefix: 'B',
  noun: 'item',
  heading: 'Item',
  start: '<!-- backlog:start -->',
  end: '<!-- backlog:end -->',
  sourceField: 'Source',
  archiveTitle: 'Archived backlog items'
})

export const QUEUE_START = ISSUES.start
export const QUEUE_END = ISSUES.end
export const ARCHIVE_FOLDER = 'archived'
export const UNCLASSIFIED = 'Unclassified'

/** Where a backlog item came from: a report on the host (`report`, with its link), the owner, or an agent. */
export const SOURCES = Object.freeze(['report', 'owner', 'agent'])
const SOURCE_START = new RegExp(`^(?:${SOURCES.join('|')})\\b`)

export const ISSUE_FILE = /^(I-\d+)\.md$/
export const ISSUE_LOG_FILE = /^(I-\d+)\.log\.md$/

/** The statuses of an item of the backlog: it waits for the owner's decision, or it became a task of a phase. */
export const PROPOSED = 'Proposed'
export const PROMOTED = 'Promoted'

/** Whether an entry has left the open index of its queue: an issue that is done, an item that was promoted. */
export const finished = (item, kind = ISSUES) => item.status === (kind === BACKLOG ? PROMOTED : '✅')

const itemFile = (kind) => new RegExp(`^(${kind.prefix}-\\d+)\\.md$`)
const kindOf = (queue) => queue.kind ?? ISSUES
const SYMBOL = /(⬜|🟡|✅)/
const field = (text, name) => new RegExp(`\\*\\*${name}:\\*\\*\\s*([^\\n]*?)\\s*(?:·|$)`, 'm').exec(text)?.[1] ?? null

/** The number of an issue or item id (`I-12` gives 12). */
export const issueNumber = (id) => Number(id.slice(2))

/**
 * One issue file (or backlog item, with `kind`): `{ id, title, status, agent, points, area, reported, formerly, log }`, and the `problems` of its shape.
 * `reported` holds the `Reported:` line of an issue and the `Source:` line of a backlog item: where the entry came from.
 */
export function parseIssueFile(file, text, kind = ISSUES) {
  const heading = new RegExp(`^# (${kind.prefix}-\\d+) — (.+?)\\s*$`, 'm').exec(text)
  const sized = field(text, 'Size')
  const size = sized?.match(/^(\d+) SP$/)
  const status =
    kind === BACKLOG
      ? (field(text, 'Status')?.match(/^(Proposed|Promoted)\b/)?.[1] ?? null)
      : (field(text, 'Status')?.match(SYMBOL)?.[1] ?? null)
  const promotedTo = field(text, 'Promoted to')?.match(/^\d+\.\d+[a-z]?$/)?.[0] ?? null
  const area = field(text, 'Area')
  const reported =
    new RegExp(`\\*\\*${kind.sourceField}:\\*\\*\\s*(.+?)\\s*(?:\\s·\\s\\*\\*|$)`, 'm').exec(text)?.[1] ?? null
  const problems = []
  if (!heading) {
    problems.push(`${file}: the title must read "# ${kind.prefix}-<n> — <title>"`)
  } else if (`${heading[1]}.md` !== file.split('/').at(-1)) {
    problems.push(`${file}: the title names ${kind.noun} ${heading[1]}, but the file is named for another`)
  }
  if (kind === BACKLOG) {
    if (!status) problems.push(`${file}: the status line must hold "**Status:** ${PROPOSED}|${PROMOTED}"`)
    if (sized && sized !== '—' && !size) problems.push(`${file}: the size, when given, reads "<n> SP"`)
    if (status === PROMOTED && !promotedTo) {
      problems.push(`${file}: a promoted item must hold "**Promoted to:** <the id of the task it became>"`)
    }
    if (status === PROPOSED && field(text, 'Promoted to')) {
      problems.push(`${file}: a proposed item has not been promoted, so it holds no "Promoted to"`)
    }
  } else {
    if (!status) problems.push(`${file}: the status line must hold "**Status:** ⬜|🟡|✅"`)
    if (!size) problems.push(`${file}: the status line must hold "**Size:** <n> SP"`)
  }
  if (!area)
    problems.push(`${file}: the status line must hold "**Area:** <an area of the migration notes, or ${UNCLASSIFIED}>"`)
  if (!reported) {
    problems.push(
      kind === BACKLOG
        ? `${file}: the status line must hold "**Source:** <${SOURCES.join(' | ')}>" (a report with its link)`
        : `${file}: the status line must hold "**Reported:** <every report that points to this issue>" (— for none)`
    )
  } else if (kind === BACKLOG && !SOURCE_START.test(reported)) {
    problems.push(`${file}: the source "${reported}" must start with one of ${SOURCES.join(', ')}`)
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
    promotedTo,
    fixedIn: field(text, 'Fixed in'),
    log: /\*\*Log:\*\*\s*\[[^\]]*\]\(([^)]+)\)/.exec(text)?.[1] ?? null,
    file,
    problems
  }
}

const cell = (text) => (text ?? '—').replace(/\|/g, '\\|')

/** The table of the open issues, in order of id. */
export function openTable(issues, { marked: withMarkers, kind = ISSUES }) {
  // An item of the backlog is not approved work, so it has no marker: the estimate, when given, is a hint for the task it may become
  const marked = withMarkers && kind !== BACKLOG
  const [name, source] = [kind.heading, kind.sourceField === 'Source' ? 'Source' : 'Reported']
  const line = (cells) => `| ${cells.join(' | ')} |`
  const head = marked
    ? [
        line([name, 'Title', 'Area', 'Agent', 'SP', 'Status', source]),
        line(['-'.repeat(name.length), '-----', '----', '-----', '--', '------', '-'.repeat(source.length)])
      ]
    : [
        line([name, 'Title', 'Area', 'SP', 'Status', source]),
        line(['-'.repeat(name.length), '-----', '----', '--', '------', '-'.repeat(source.length)])
      ]
  const rows = issues.map((issue) => {
    const link = `[${issue.id}](./${issue.id}.md)`
    const common = [cell(issue.title), cell(issue.area)]
    const rest = [issue.points ?? '—', issue.status ?? '—', cell(issue.reported)]
    return `| ${[link, ...common, ...(marked ? [issue.agent ?? '—'] : []), ...rest].join(' | ')} |`
  })
  return [...head, ...rows].join('\n')
}

/** The table of the archived issues. */
export function archiveTable(issues, kind = ISSUES) {
  const [name, source] = [kind.heading, kind.sourceField]
  const third = kind === BACKLOG ? 'Promoted to' : 'SP'
  const rows = issues.map(
    (issue) =>
      `| [${issue.id}](./${issue.id}.md) | ${cell(issue.title)} | ${cell(issue.area)} | ${kind === BACKLOG ? cell(issue.promotedTo) : (issue.points ?? '—')} | ${cell(issue.reported)} |`
  )
  return [
    `| ${name} | Title | Area | ${third} | ${source} |`,
    `| ${'-'.repeat(name.length)} | ----- | ---- | ${'-'.repeat(third.length)} | ${'-'.repeat(source.length)} |`,
    ...rows
  ].join('\n')
}

const byNumber = (a, b) => issueNumber(a.id) - issueNumber(b.id)

/** The text with the block between the queue markers replaced; null when the markers are missing. */
export function withQueueBlock(text, body, kind = ISSUES) {
  const from = text.indexOf(kind.start)
  const to = text.indexOf(kind.end)
  return from < 0 || to < from ? null : `${text.slice(0, from + kind.start.length)}\n${body}\n${text.slice(to)}`
}

/**
 * The queue at `dir`: `null` when the folder has no `README.md`; otherwise its open and archived issues, read from `list(path)` (the names in a folder) and
 * `readText(path)`.
 */
export function readQueue({ list, readText, dir, kind = ISSUES }) {
  const names = list(dir)
  if (!names.includes('README.md')) {
    return null
  }
  const issuesIn = (folder) =>
    list(folder)
      .filter((name) => itemFile(kind).test(name))
      .map((name) =>
        parseIssueFile(`${folder === dir ? '' : `${ARCHIVE_FOLDER}/`}${name}`, readText(`${folder}/${name}`), kind)
      )
      .sort(byNumber)
  const archive = `${dir}/${ARCHIVE_FOLDER}`
  return {
    dir,
    kind,
    readme: readText(`${dir}/README.md`),
    archiveReadme: list(archive).includes('README.md') ? readText(`${archive}/README.md`) : null,
    open: issuesIn(dir),
    archived: issuesIn(archive),
    names,
    archiveNames: list(archive)
  }
}

/**
 * The next free number of a queue: above every open and archived entry, and above the numbers `moved` names (the ids of entries that left this queue for
 * another, such as an issue that became a backlog item: `B-1, formerly I-6`). A number is never reused.
 */
export const nextIssueNumber = (queue, moved = []) =>
  Math.max(0, ...[...queue.open, ...queue.archived].map((issue) => issueNumber(issue.id)), ...moved.map(issueNumber)) +
  1

/**
 * The problems of a queue: the shape of each issue file, an area off the list, a marker off the scale, a log link that does not resolve, a done issue
 * that is not archived (or an archived one that is not done), ids used twice, and the two indexes disagreeing with the files.
 * @param {{ areas?: string[], scale?: string[], exists: (path: string) => boolean }} options `exists` takes a path relative to the queue's folder
 */
export function queueProblems(queue, { areas = null, scale = [], exists }) {
  const kind = kindOf(queue)
  const noun = kind.noun
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
    if (finished(issue, kind))
      problems.push(
        `${queue.dir}/${issue.file}: the ${noun} is ${kind === BACKLOG ? 'promoted' : 'done'} and not archived; run \`harness plan summary\``
      )
    if (kind !== BACKLOG && scale.length && issue.status && issue.status !== '✅') {
      if (!issue.agent)
        problems.push(`${queue.dir}/${issue.file}: an open ${noun} needs "**Agent:** <marker>" (${scale.join(', ')})`)
      else if (!scale.includes(issue.agent))
        problems.push(`${queue.dir}/${issue.file}: the marker ${issue.agent} is not on the scale (${scale.join(', ')})`)
    }
  }
  for (const issue of queue.archived) {
    if (issue.status && !finished(issue, kind)) {
      problems.push(
        `${queue.dir}/${issue.file}: an archived ${noun} must be ${kind === BACKLOG ? `promoted (${PROMOTED})` : 'done (✅)'}`
      )
    }
  }
  const expectedOpen = withQueueBlock(queue.readme, openTable(queue.open, { marked: scale.length > 0, kind }), kind)
  if (expectedOpen === null) problems.push(`${where}: the ${noun} table must sit between ${kind.start} and ${kind.end}`)
  else if (expectedOpen !== queue.readme)
    problems.push(`${where}: the ${noun} table disagrees with the ${noun} files; run \`harness plan summary\``)
  if (queue.archiveReadme !== null) {
    const expected = withQueueBlock(queue.archiveReadme, archiveTable(queue.archived, kind), kind)
    if (expected === null)
      problems.push(
        `${queue.dir}/${ARCHIVE_FOLDER}/README.md: the table must sit between ${kind.start} and ${kind.end}`
      )
    else if (expected !== queue.archiveReadme)
      problems.push(
        `${queue.dir}/${ARCHIVE_FOLDER}/README.md: the table disagrees with the archived ${noun}s; run \`harness plan summary\``
      )
  } else if (queue.archived.length) {
    problems.push(`${queue.dir}/${ARCHIVE_FOLDER}/README.md is missing, and ${noun}s are archived`)
  }
  return problems
}

/** The line of the plan index about the queue: the open issues and their size, apart from the phases' totals (for the backlog: how many proposals wait and how many were promoted). */
export function queueSummary(queue, link) {
  if (kindOf(queue) === BACKLOG) {
    const waiting = queue.open.filter((item) => !finished(item, BACKLOG)).length
    return `**Backlog** (proposals the owner has not approved; not a phase, and not in the totals above): [${waiting} proposed](${link}); ${queue.archived.length} promoted.`
  }
  const open = queue.open.filter((issue) => issue.status !== '✅')
  const points = open.reduce((sum, issue) => sum + (issue.points ?? 0), 0)
  const started = open.filter((issue) => issue.status === '🟡').length
  const name = kindOf(queue) === BACKLOG ? 'Backlog' : 'Issue queue'
  return (
    `**${name}** (not a phase; its size is not in the totals above): [${open.length} open](${link}), ${points} SP` +
    `${started ? `, ${started} in progress` : ''}; ${queue.archived.length} archived.`
  )
}

/**
 * Archives the issues that are done: moves `I-<n>.md` and `I-<n>.log.md` into `archived/` and follows every link to them across the repository.
 * @returns {{ moves: Map<string, string>, touched: string[] }}
 */
export function archiveDone({ root, queue }) {
  const done = queue.open.filter((issue) => finished(issue, kindOf(queue)))
  const archiveTitle = kindOf(queue).archiveTitle
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
      to.endsWith('.log.md') ? link : `[← ${archiveTitle}](./README.md)`
    )
    mkdirSync(dirname(join(root, to)), { recursive: true })
    writeFileSync(join(root, to), next)
    rmSync(join(root, from))
  }
  const touched = followMoves({ root, moves })
  return { moves, touched }
}
