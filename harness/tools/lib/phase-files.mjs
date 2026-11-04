// A phase as a folder (task 3.10): `phases/phase-<n>-<slug>/` holds `README.md` (the phase index: goal, order, exit criteria and a task table generated from
// the task files), `<id>.md` for each task (its description, status, size, agent marker, dependencies and the link to its log), `<id>.log.md` (the
// task's append-only log) and `log.md` (what concerns the whole phase). The tools still read the one-file layout (`phases/phase-<n>-<slug>.md`), so a phase
// that is finished need not be split. Pure functions on texts; the loader takes the file system as `list` and `readText` so that a test passes strings.

import {
  backLinkProblems,
  implementationSection,
  indexPartsProblems,
  logProblems,
  recordProblems,
  workLogProblems
} from './phase-structure.mjs'

export const TASKS_START = '<!-- phase-tasks:start -->'
export const TASKS_END = '<!-- phase-tasks:end -->'

export const PHASE_FILE = /^phase-\d+-.+\.md$/
export const PHASE_FOLDER = /^phase-\d+-[^./]+$/
export const TASK_FILE = /^(\d+\.\d+[a-z]?)\.md$/
export const TASK_LOG_FILE = /^(\d+\.\d+[a-z]?)\.log\.md$/

const TITLE = /^# Phase (\d+) — (.+?) \((\d+) SP(?:, ([^)]*))?\)\s*$/m
const STATUS = /\*\*Status:\*\*\s*((?:⬜|🟡|✅)\s*[A-Za-z ]+?)\s*(?:·|$)/m
const TASK_TITLE = /^# (\d+\.\d+[a-z]?) — (.+?)\s*$/m
const SYMBOL = /(⬜|🟡|✅)/

const field = (text, name) => new RegExp(`\\*\\*${name}:\\*\\*\\s*([^\\n]*?)\\s*(?:·|$)`, 'm').exec(text)?.[1] ?? null

/**
 * One task file: `{ id, title, status, agent, points, needs, log }` (`null` for what the file does not say) and the `problems` of its shape.
 */
export function parseTaskFile(file, text) {
  const heading = TASK_TITLE.exec(text)
  const status = field(text, 'Status')?.match(SYMBOL)?.[1] ?? null
  const agent = field(text, 'Agent')?.match(/C\d+/)?.[0] ?? null
  const size = field(text, 'Size')?.match(/^(\d+) SP$/)
  const needs = field(text, 'Needs')
  const log = /\*\*Log:\*\*\s*\[[^\]]*\]\(([^)]+)\)/.exec(text)?.[1] ?? null
  const id = heading?.[1] ?? null
  const problems = []
  if (!heading) {
    problems.push(`${file}: the title must read "# <task id> — <title>"`)
  } else if (`${id}.md` !== file.split('/').at(-1)) {
    problems.push(`${file}: the title names task ${id}, but the file is named for another`)
  }
  if (!status) {
    problems.push(`${file}: the status line must hold "**Status:** ⬜|🟡|✅"`)
  }
  if (!size) {
    problems.push(`${file}: the status line must hold "**Size:** <n> SP"`)
  }
  return {
    id,
    title: heading?.[2] ?? null,
    status,
    agent,
    points: size ? Number(size[1]) : null,
    needs: needs && needs !== '—' ? needs : null,
    log,
    file,
    problems
  }
}

/** The task table of a phase index, from its task files; the Agent column only where the plan has markers. */
export function taskTable(tasks, { marked }) {
  const cell = (text) => (text ?? '').replace(/\|/g, '\\|')
  const head = marked ? '| # | Task | Agent | SP | Status |' : '| # | Task | SP | Status |'
  const rule = marked ? '| - | ---- | ----- | -- | ------ |' : '| - | ---- | -- | ------ |'
  const rows = tasks.map((task) => {
    const link = `[${task.id}](./${task.id}.md)`
    return marked
      ? `| ${link} | ${cell(task.title)} | ${task.agent ?? '—'} | ${task.points ?? '—'} | ${task.status ?? '—'} |`
      : `| ${link} | ${cell(task.title)} | ${task.points ?? '—'} | ${task.status ?? '—'} |`
  })
  return [head, rule, ...rows].join('\n')
}

/** 7.2 before 7.10, 7.9 before 7.9a. */
export const compareIds = (a, b) => {
  const [, minorA = ''] = a.split('.')
  const [, minorB = ''] = b.split('.')
  return parseInt(minorA, 10) - parseInt(minorB, 10) || minorA.localeCompare(minorB)
}

/** The text of a phase index with its task table rewritten between the markers; null when the markers are missing. */
export function withTaskTable(text, table) {
  const from = text.indexOf(TASKS_START)
  const to = text.indexOf(TASKS_END)
  if (from < 0 || to < from) {
    return null
  }
  return `${text.slice(0, from + TASKS_START.length)}\n${table}\n${text.slice(to)}`
}

// The checks of the structure of a phase folder (core/plan/phases.md, section 9): its index, the back-links and logs of its tasks, the work log, the
// record of every done task
function folderStructureProblems({
  folder,
  file,
  readme,
  tasks,
  taskFiles,
  exists,
  phasesDir,
  planIndex,
  files,
  logs,
  workLog
}) {
  const at = `${phasesDir}/${folder}`
  const problems = [
    ...backLinkProblems({ file: `${at}/README.md`, text: readme, expected: planIndex, what: 'the plan index' }),
    ...indexPartsProblems({ file, text: readme }),
    ...workLogProblems({ file, text: readme, exists })
  ]
  for (const task of tasks) {
    const text = taskFiles.find(({ file: name }) => name === `${task.id}.md`)?.text ?? ''
    problems.push(
      ...backLinkProblems({ file: `${at}/${task.id}.md`, text, expected: `${at}/README.md`, what: 'the phase index' })
    )
  }
  for (const log of logs) {
    const id = TASK_LOG_FILE.exec(log.file)?.[1]
    problems.push(
      ...logProblems({
        file: `${at}/${log.file}`,
        text: log.text,
        expected: `${at}/${id}.md`,
        what: `the task ${id}`,
        status: true
      })
    )
  }
  if (workLog !== null) {
    problems.push(
      ...logProblems({ file: `${at}/log.md`, text: workLog, expected: `${at}/README.md`, what: 'the phase index' })
    )
  }
  problems.push(
    ...recordProblems({
      done: tasks.filter((task) => task.status === '✅').map((task) => task.id),
      section: implementationSection(readme),
      hasLog: (id) => files.includes(`${id}.log.md`),
      file
    })
  )
  return problems
}

/**
 * A phase kept as a folder, read the way `parsePhase` reads a phase file, with its tasks from their files.
 * @param {string} folder the folder's name (`phase-3-issues`)
 * @param {string} readme the text of its `README.md`
 * @param {{ file: string, text: string }[]} taskFiles
 * @param {{ complexity?: object, exists?: (path: string) => boolean, structure?: object }} options `exists` tells whether a path relative to the folder is there.
 *   `structure` (`{ phasesDir, planIndex, files, logs, workLog }`) switches on the checks of the structure of the phase (phase-structure.mjs): the names of the
 *   files in the folder, the logs of the tasks as `{ file, text }`, and the text of the phase's work log (null when missing)
 */
export function parsePhaseFolder(folder, readme, taskFiles, { complexity, exists = () => true, structure } = {}) {
  const file = `${folder}/README.md`
  const title = TITLE.exec(readme)
  const status = STATUS.exec(readme)
  if (!title) {
    throw new Error(`${file}: the title must read "# Phase <n> — <theme> (<size> SP)"`)
  }
  if (!status) {
    throw new Error(`${file}: the status line must start with "**Status:** ⬜|🟡|✅ <words>"`)
  }
  const parsed = taskFiles
    .filter(({ file: name }) => TASK_FILE.test(name))
    .map(({ file: name, text }) => parseTaskFile(`${folder}/${name}`, text))
    .sort((a, b) => compareIds(a.id ?? '', b.id ?? ''))
  const tasks = parsed.filter((task) => task.id)
  const scale = Object.keys(complexity?.scale ?? {})

  const problems = parsed.flatMap((task) => task.problems)
  for (const task of tasks) {
    if (task.log && !exists(task.log.replace(/^\.\//, ''))) {
      problems.push(`${task.file}: the log ${task.log} does not exist`)
    }
  }
  const table = taskTable(tasks, { marked: scale.length > 0 })
  const expected = withTaskTable(readme, table)
  if (expected === null) {
    problems.push(`${file}: the task table must sit between ${TASKS_START} and ${TASKS_END}`)
  } else if (expected !== readme) {
    problems.push(`${file}: the task table disagrees with the task files; run \`harness plan summary\``)
  }
  const logLink = /\*\*Work log:\*\*\s*\[[^\]]*\]\(([^)]+)\)/.exec(readme)?.[1]
  if (logLink && !exists(logLink.replace(/^\.\//, ''))) {
    problems.push(`${file}: the work log ${logLink} does not exist`)
  }

  if (structure) {
    problems.push(...folderStructureProblems({ folder, file, readme, tasks, taskFiles, exists, ...structure }))
  }

  return {
    number: Number(title[1]),
    theme: title[2],
    points: Number(title[3]),
    note: title[4] ?? '',
    status: status[1].replace(/\s+/g, ' '),
    file,
    folder,
    layout: 'folder',
    title: `Phase ${title[1]} — ${title[2]} (${title[3]} SP${title[4] ? `, ${title[4]}` : ''})`,
    taskPoints: tasks.reduce((sum, task) => sum + (task.points ?? 0), 0),
    markers: tasks.filter((task) => task.agent).map((task) => task.agent),
    unmarked: tasks.filter((task) => !task.agent && task.status !== '✅').map((task) => task.id),
    tasks,
    expectedReadme: expected,
    problems
  }
}

/**
 * The phases of a phases folder, as entries `{ name, layout, file, text, folder?, taskFiles? }`: a file `phase-<n>-<slug>.md`, or a folder
 * `phase-<n>-<slug>/` with a `README.md`. `list(path)` gives the names in a folder (empty when it is missing), `readText(path)` a file's text.
 */
export function loadPhaseEntries({ list, readText, phasesDir }) {
  const names = list(phasesDir)
  const entries = []
  for (const name of names) {
    if (PHASE_FILE.test(name)) {
      entries.push({ name, layout: 'file', file: name, text: readText(`${phasesDir}/${name}`) })
    } else if (PHASE_FOLDER.test(name) && list(`${phasesDir}/${name}`).includes('README.md')) {
      const inside = list(`${phasesDir}/${name}`)
      entries.push({
        name,
        layout: 'folder',
        file: `${name}/README.md`,
        text: readText(`${phasesDir}/${name}/README.md`),
        folder: name,
        taskFiles: inside
          .filter((item) => TASK_FILE.test(item))
          .sort((a, b) => compareIds(a.replace(/\.md$/, ''), b.replace(/\.md$/, '')))
          .map((item) => ({ file: item, text: readText(`${phasesDir}/${name}/${item}`) })),
        files: inside,
        logs: inside
          .filter((item) => TASK_LOG_FILE.test(item))
          .map((item) => ({ file: item, text: readText(`${phasesDir}/${name}/${item}`) })),
        workLog: inside.includes('log.md') ? readText(`${phasesDir}/${name}/log.md`) : null
      })
    }
  }
  return entries
}
