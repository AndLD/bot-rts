// The plan tools (design §7.1): the summary table and the contents of the plan index, written from the phase files (`harness plan summary`),
// and the implementation log of a phase, printed from the merged pull requests (`harness plan log`). The squash commits on the integration
// branch carry the plan task ids in a `Plan: <id>[, <id>]` line of their body, and the pull request number in the subject.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import {
  BACKLOG,
  archiveDone,
  archiveTable,
  finished,
  openTable,
  queueProblems,
  queueSummary,
  readQueue,
  withQueueBlock,
  ARCHIVE_FOLDER
} from './issue-queue.mjs'
import { ensureBacklog } from './backlog-setup.mjs'
import { ensureFlows, flowsLink, flowsProblems, readFlowsOf, withFlowsTable } from './flows.mjs'
import { inFramework } from './lock.mjs'
import { orderOfDevelopment, readPhases } from './next-task.mjs'
import { RELEASES_END, RELEASES_START, readReleases, releaseOrder, releasesLine } from './releases.mjs'
import { loadPhaseEntries, parsePhaseFolder, parseTaskFile } from './phase-files.mjs'
import { needsProblems } from './phase-structure.mjs'

export const SUMMARY_START = '<!-- plan-summary:start -->'
export const SUMMARY_END = '<!-- plan-summary:end -->'
export const CONTENTS_START = '<!-- plan-contents:start -->'
export const CONTENTS_END = '<!-- plan-contents:end -->'
export const ISSUES_START = '<!-- plan-issues:start -->'
export const ISSUES_END = '<!-- plan-issues:end -->'
export const BACKLOG_START = '<!-- plan-backlog:start -->'
export const BACKLOG_END = '<!-- plan-backlog:end -->'

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
    ids: rows.map((match) => match[1]),
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

// The phases of the total line: one phase, or the range from the first to the last
const phaseRange = (first, last) => (first === last ? `Phase ${last}` : `Phases ${first}–${last}`)

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
    `|  | **Total${sorted.length ? ` of ${phaseRange(sorted[0].number, last)}` : ''}** | **${total}**${grows.length ? ` (${grows.join(', ')} grows as issues are added)` : ''} |${marked ? ' | ' : ' '}|`
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
export function renderIndex(indexText, phases, { phasesLink, complexity, queueLine, backlogLine, releasesBlock } = {}) {
  const withSummary = replaceBetween(indexText, SUMMARY_START, SUMMARY_END, summaryTable(phases, { complexity }))
  const withContents = replaceBetween(withSummary, CONTENTS_START, CONTENTS_END, contentsList(phases, phasesLink))
  // The issue queue's line is written where the index has its block (a plan with no queue has none)
  const withQueue =
    queueLine && withContents.includes(ISSUES_START)
      ? replaceBetween(withContents, ISSUES_START, ISSUES_END, queueLine)
      : withContents
  const withBacklog =
    backlogLine && withQueue.includes(BACKLOG_START)
      ? replaceBetween(withQueue, BACKLOG_START, BACKLOG_END, backlogLine)
      : withQueue
  // The line of the releases is written where the index has its block (a plan with no releases file has none)
  return releasesBlock && withBacklog.includes(RELEASES_START)
    ? replaceBetween(withBacklog, RELEASES_START, RELEASES_END, releasesBlock)
    : withBacklog
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

/** The phases of a phases folder, each as a file (`parsePhase`) or as a folder (`parsePhaseFolder`), in the order of their names. */
export function readPhaseFiles({ root, phasesDir, complexity, planIndex }) {
  const entries = loadPhaseEntries({
    phasesDir,
    list: (path) => (existsSync(join(root, path)) ? readdirSync(join(root, path)) : []),
    readText: (path) => readFileSync(join(root, path), 'utf8')
  })
  return entries.map((entry) =>
    entry.layout === 'file'
      ? parsePhase(entry.name, entry.text)
      : parsePhaseFolder(entry.folder, entry.text, entry.taskFiles, {
          complexity,
          exists: (path) => existsSync(join(root, phasesDir, entry.folder, path)),
          structure: planIndex
            ? { phasesDir, planIndex, files: entry.files, logs: entry.logs, workLog: entry.workLog }
            : undefined
        })
  )
}

const listIn = (root) => (path) => (existsSync(join(root, path)) ? readdirSync(join(root, path)) : [])

/** The issue queue of the project (`paths.issues`), or null when it has none yet. */
export function readQueueOf(root, profile) {
  return profile.paths.issues
    ? readQueue({
        dir: profile.paths.issues,
        list: listIn(root),
        readText: (path) => readFileSync(join(root, path), 'utf8')
      })
    : null
}

/** The backlog of the project (`paths.backlog`), the queue of the feature requests, or null when it has none. */
export function readBacklogOf(root, profile) {
  return profile.paths.backlog
    ? readQueue({
        dir: profile.paths.backlog,
        list: listIn(root),
        readText: (path) => readFileSync(join(root, path), 'utf8'),
        kind: BACKLOG
      })
    : null
}

// The ids an entry of a queue took over from another place: a task (`3.19`) or an issue that moved to the backlog (`I-6`)
const FORMERLY = /\d+\.\d+[a-z]?|I-\d+/g

// The ids that the plan may name apart from the tasks of the phases: the entries of both queues, open and archived, and what they took over
function queueIds(...queues) {
  const known = new Set()
  for (const queue of queues) {
    for (const item of queue ? [...queue.open, ...queue.archived] : []) {
      known.add(item.id)
      for (const old of item.formerly?.match(FORMERLY) ?? []) known.add(old)
    }
  }
  return known
}

// The ids of the backlog items that wait for the owner's decision: no order, no execution order and no `Needs` may name one (task 3.21)
const proposedIds = (backlog) =>
  new Set(
    (backlog?.open ?? [])
      .filter((item) => !finished(item, BACKLOG))
      .flatMap((item) => [item.id, ...(item.formerly?.match(/I-\d+/g) ?? [])])
  )

// The areas of the migration notes (the names of `areas.json` of the framework tree); null where the project has no such list
function areasOf(root, profile) {
  const path = join(root, inFramework(profile, 'migrations'), 'areas.json')
  return existsSync(path) ? Object.keys(JSON.parse(readFileSync(path, 'utf8')).areas ?? {}) : null
}

/** The phases of the plan as `readPhases` reads them (the task files of a folder phase, the rows of a phase file): `{ number, status, tasks: [{ id, title, status }] }`. */
export function planPhases({ root, profile }) {
  const phasesDir = profile.paths.phases
  const entries = loadPhaseEntries({
    phasesDir,
    list: listIn(root),
    readText: (path) => readFileSync(join(root, path), 'utf8')
  }).map((entry) => ({
    file: `${phasesDir}/${entry.file}`,
    text: entry.text,
    tasks: entry.taskFiles?.map(({ file, text }) => parseTaskFile(file, text)).filter((task) => task.id)
  }))
  return readPhases(entries)
}

/** The tasks of the phases that are not done: `{ id, title, status }`, read from the task files and the rows of the phase files. */
export function openTasks({ root, profile }) {
  return planPhases({ root, profile }).flatMap((phase) => phase.tasks.filter((task) => task.status !== '✅'))
}

/**
 * The ids an order of development or an execution order may name: the tasks of the phases, the issues of the queue and its archive, and the ids an issue
 * took over from a task of a phase that was moved (`Formerly`). Names the ids that exist nowhere. The order is the releases file when the profile has the role
 * (`releasesText`), else the section of the index; a backlog item that is only proposed is refused in either.
 */
export function orderProblems({ root, profile, indexText, releasesText = null }) {
  const { planIndex, releases } = profile.paths
  const [orderFile, orderName, tokens] =
    releasesText === null
      ? [planIndex, 'the order of development', orderOfDevelopment(indexText)]
      : [releases, 'the release order', [...releaseOrder(releasesText), ...readReleases(releasesText).notScheduled]]
  const phases = planPhases({ root, profile })
  const known = new Set([
    ...phases.flatMap((phase) => phase.tasks.map((task) => task.id)),
    ...queueIds(readQueueOf(root, profile), readBacklogOf(root, profile))
  ])
  const proposed = proposedIds(readBacklogOf(root, profile))
  const notApproved = (where, id) =>
    `${where} names the backlog item ${id}, which is not approved work: the owner promotes it into a task of a phase first (\`harness plan promote ${id} --phase <n>\`), and the plan names that task`
  const problems = []
  for (const token of tokens) {
    if (typeof token === 'string' && proposed.has(token)) {
      problems.push(notApproved(`${orderFile}: ${orderName}`, token))
    } else if (typeof token === 'string' ? !known.has(token) : !phases.some((phase) => phase.number === token.phase)) {
      problems.push(
        `${orderFile}: ${orderName} names ${typeof token === 'string' ? `task ${token}` : `Phase ${token.phase}`}, which exists in no phase and not in the issue queue or the backlog (nor their archives, under its old id)`
      )
    }
  }
  for (const phase of phases.filter((item) => item.order !== null && !item.points)) {
    for (const id of new Set(phaseSequenceIds(phase.order))) {
      if (proposed.has(id)) {
        problems.push(notApproved(`${phase.file}: the execution order`, id))
      } else if (!known.has(id)) {
        problems.push(
          `${phase.file}: the execution order names task ${id}, which exists in no phase and not in the issue queue or the backlog (nor their archives, under its old id)`
        )
      }
    }
  }
  return problems
}

// The tasks that the task files of the folder phases need (`Needs`) exist, and none is in a later phase
function needProblems(phases, queue, backlog) {
  const known = new Set([
    ...phases.flatMap((phase) => phase.tasks?.map((task) => task.id) ?? phase.ids ?? []),
    ...queueIds(queue, backlog)
  ])
  const proposed = proposedIds(backlog)
  const notApproved = phases.flatMap((phase) =>
    (phase.tasks ?? []).flatMap((task) =>
      (task.needs?.match(/[IB]-\d+/g) ?? [])
        .filter((id) => proposed.has(id))
        .map(
          (id) =>
            `${phase.file}: task ${task.id} needs the backlog item ${id}, which is not approved work: promote it into a task of a phase first`
        )
    )
  )
  return [
    ...phases.flatMap((phase) => needsProblems({ tasks: phase.tasks ?? [], known, phase: phase.number })),
    ...notApproved
  ]
}

// An issue that moved to the backlog keeps its number (`B-1, formerly I-6`): the issue queue must not give that number to another issue
function movedIdProblems(queue, backlog) {
  const moved = new Set(
    (backlog ? [...backlog.open, ...backlog.archived] : []).flatMap((item) => item.formerly?.match(/I-\d+/g) ?? [])
  )
  return (queue ? [...queue.open, ...queue.archived] : [])
    .filter((issue) => moved.has(issue.id))
    .map(
      (issue) =>
        `${queue.dir}/${issue.file}: the id ${issue.id} moved to the backlog (a backlog item says "Formerly: ${issue.id}") and is never reused`
    )
}

const phaseSequenceIds = (order) =>
  [...order.replace(/`?\b\d+\.\d+\.\d+(?:-[\w.]+)?\b`?/g, ' ').matchAll(/\b(?:\d+\.\d+[a-z]?|[IB]-\d+)\b/g)].map(
    (match) => match[0]
  )

/**
 * The releases file of a plan whose profile has the role `paths.releases` (task 5.1): its text, the line of the generated block of the plan index, and the
 * problems of the file and of the index beside it; all empty where the profile has no such role (the order is then the section of the index).
 */
function releasesOf({ root, profile, indexText }) {
  const { releases, planIndex } = profile.paths
  const none = { text: null, block: null, problems: [] }
  if (!releases) {
    return none
  }
  if (!existsSync(join(root, releases))) {
    return {
      ...none,
      problems: [
        `${releases}: the profile names this file as the release order (\`paths.releases\`), but it does not exist`
      ]
    }
  }
  const text = readFileSync(join(root, releases), 'utf8')
  const read = readReleases(text)
  const problems = read.problems.map((problem) => `${releases}: ${problem}`)
  if (orderOfDevelopment(indexText).length) {
    problems.push(
      `${planIndex}: has a section "Order of development", but the order is kept in ${releases}; move it there (and keep none in the index)`
    )
  }
  if (!indexText.includes(RELEASES_START)) {
    problems.push(`${planIndex}: has no ${RELEASES_START} … ${RELEASES_END} block for the current release`)
  }
  const link = relative(dirname(planIndex), releases).split('\\').join('/')
  const block = read.problems.length ? null : releasesLine(read.rows, link.startsWith('.') ? link : `./${link}`)
  return { text, block, problems, names: read.rows.map((row) => row.release.replace(/`/g, '')) }
}

/**
 * The flows of a plan whose profile has the role `paths.flows` (task 5.2): their problems, and the sentence of the releases block that links their index. The
 * index is rewritten from the flow files, or with `check` only compared. Flows deliver releases, so the role needs `paths.releases`.
 */
function flowsOf({ root, profile, releases, check }) {
  const dir = profile.paths.flows
  if (!dir) return { problems: [], link: null }
  if (!profile.paths.releases) {
    return {
      problems: [
        `the profile names a flows folder (\`paths.flows\`) but no releases file (\`paths.releases\`); a flow delivers the releases of that file`
      ],
      link: null
    }
  }
  const read = readFlowsOf(root, profile)
  if (!read) {
    return {
      problems: [
        `${dir}: the profile names this folder for the flows, but it has no index (README.md); run \`harness plan summary\``
      ],
      link: null
    }
  }
  const problems = flowsProblems(read, releases.names ?? null)
  const expected = withFlowsTable(read.readme, read.flows)
  if (expected === null)
    problems.push(
      `${dir}/README.md: the flows table must sit between <!-- flows-index:start --> and <!-- flows-index:end -->`
    )
  else if (expected !== read.readme) {
    if (check)
      problems.push(`${dir}/README.md: the flows table disagrees with the flow files; run \`harness plan summary\``)
    else writeFileSync(join(root, dir, 'README.md'), expected)
  }
  return { problems, link: flowsLink(profile.paths.planIndex, dir) }
}

/**
 * `harness plan summary`: rewrites the generated blocks of the plan index, of the phase index of each phase kept as a folder, and of the two indexes of the
 * issue queue and of the backlog (archiving the entries that are done), from the phase, task, issue and backlog files, or with `check` only compares them. Also holds the layout of a
 * phase folder (the size in its title is the sum of its task files, each task file has a status, a size and, for an open task, a marker, and every log link
 * resolves), the layout of the queue, and that an order of development or an execution order names only ids that exist.
 * @returns {{ problems: string[], message: string }}
 */
export function planSummary({ root, profile, check = false }) {
  const { phases: phasesDir, planIndex } = profile.paths
  const complexity = profile.plan?.complexity
  const scale = Object.keys(complexity?.scale ?? {})
  const setup = check ? [] : [...ensureBacklog({ root, profile }), ...ensureFlows({ root, profile })]
  let phases = readPhaseFiles({ root, phasesDir, complexity, planIndex })
  let queue = readQueueOf(root, profile)
  let backlog = readBacklogOf(root, profile)

  if (!check) {
    for (const phase of phases.filter((item) => item.layout === 'folder' && item.expectedReadme)) {
      const path = join(root, phasesDir, phase.file)
      if (phase.expectedReadme !== readFileSync(path, 'utf8')) {
        writeFileSync(path, phase.expectedReadme)
      }
    }
    phases = readPhaseFiles({ root, phasesDir, complexity, planIndex })
    for (const read of [readQueueOf, readBacklogOf]) {
      const before = read(root, profile)
      if (!before) continue
      archiveDone({ root, queue: before })
      const { dir, kind, open, archived, archiveReadme } = read(root, profile)
      const write = (path, body) => {
        const text = readFileSync(join(root, path), 'utf8')
        const next = withQueueBlock(text, body, kind)
        if (next !== null && next !== text) writeFileSync(join(root, path), next)
      }
      write(`${dir}/README.md`, openTable(open, { marked: scale.length > 0, kind }))
      if (archiveReadme !== null) write(`${dir}/${ARCHIVE_FOLDER}/README.md`, archiveTable(archived, kind))
    }
    queue = readQueueOf(root, profile)
    backlog = readBacklogOf(root, profile)
  }
  const problems = phases.flatMap((phase) => [...phaseProblems(phase, complexity), ...(phase.problems ?? [])])
  for (const each of [queue, backlog].filter(Boolean)) {
    problems.push(
      ...queueProblems(each, {
        areas: areasOf(root, profile),
        scale,
        exists: (path) => existsSync(join(root, each.dir, path))
      })
    )
  }
  problems.push(...movedIdProblems(queue, backlog))
  const current = readFileSync(join(root, planIndex), 'utf8')
  const releases = releasesOf({ root, profile, indexText: current })
  problems.push(...releases.problems)
  problems.push(...orderProblems({ root, profile, indexText: current, releasesText: releases.text }))
  problems.push(...needProblems(phases, queue, backlog))
  const flows = flowsOf({ root, profile, releases, check })
  problems.push(...flows.problems)
  const link = relative(dirname(planIndex), phasesDir).split('\\').join('/')
  const lineOf = (each) => {
    if (!each) return null
    const to = relative(dirname(planIndex), `${each.dir}/README.md`).split('\\').join('/')
    return queueSummary(each, to.startsWith('.') ? to : `./${to}`)
  }
  const expected = renderIndex(current, phases, {
    phasesLink: link.startsWith('.') ? link : `./${link}`,
    complexity,
    queueLine: lineOf(queue),
    backlogLine: lineOf(backlog),
    releasesBlock: releases.block && flows.link ? `${releases.block} ${flows.link}` : releases.block
  })

  if (check) {
    if (expected !== current) {
      problems.push(
        `${planIndex}: the summary or the contents disagree with the phase files${queue ? ' and the issue queue' : ''}${backlog ? ' and the backlog' : ''}; run \`harness plan summary\``
      )
    }
    return { problems, message: `Checked the plan summary against ${phases.length} phase files.` }
  }
  writeFileSync(join(root, planIndex), expected)
  return { problems, message: [...setup, `Wrote the plan summary of ${phases.length} phases.`].join('\n') }
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
