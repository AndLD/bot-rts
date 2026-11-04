// A phase kept as a folder (task 3.10): the task files, the generated task table, the checks of the layout, the next task, and the session start message.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import { sessionStartMessage, newestNextStep } from '../runtime-hooks/session-start.mjs'
import { nextTask, readPhases } from './next-task.mjs'
import { loadPhaseEntries, parsePhaseFolder, parseTaskFile, taskTable, TASKS_END, TASKS_START } from './phase-files.mjs'
import { planSummary } from './plan.mjs'

const dirs = []
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

const COMPLEXITY = { scale: { C1: 'small', C2: 'standard' } }

const taskFile = (id, title, { status = '⬜', agent = 'C2', size = 3, needs, log } = {}) =>
  `[← Phase 7](./README.md)\n\n# ${id} — ${title}\n\n**Status:** ${status} · **Agent:** ${agent} · **Size:** ${size} SP` +
  `${needs ? ` · **Needs:** ${needs}` : ''}${log ? ` · **Log:** [${id}.log.md](./${log})` : ''}\n\nWhat ${id} delivers.\n`

const readme = (size, table = '', status = '🟡 In progress') =>
  `[← Development plan](../../README.md)\n\n# Phase 7 — Seventh (${size} SP)\n\n**Status:** ${status} · **Work log:** [log](./log.md)\n\n` +
  `${TASKS_START}\n${table}\n${TASKS_END}\n\nTask status: ⬜ not started · 🟡 in progress · ✅ done.\n\n**Exit criteria:** all done.\n\n## Implementation log\n\nPrinted from the merged pull requests.\n`

const tasks = (files) => files.map(([id, ...rest]) => parseTaskFile(`${id}.md`, taskFile(id, `Task ${id}`, ...rest)))

test('a task file is read for its title, status, marker, size, dependencies and log, and a malformed one names its problems', () => {
  const task = parseTaskFile(
    '7.2.md',
    taskFile('7.2', 'Second', { status: '🟡', agent: 'C1', size: 2, needs: '7.1', log: '7.2.log.md' })
  )
  assert.deepEqual(
    {
      id: task.id,
      title: task.title,
      status: task.status,
      agent: task.agent,
      points: task.points,
      needs: task.needs,
      log: task.log
    },
    { id: '7.2', title: 'Second', status: '🟡', agent: 'C1', points: 2, needs: '7.1', log: './7.2.log.md' }
  )
  const bad = parseTaskFile('7.3.md', '# 7.4 — Other\n\nNo status line.\n')
  assert.deepEqual(
    bad.problems.map((problem) => problem.replace(/^7\.3\.md: /, '')),
    [
      'the title names task 7.4, but the file is named for another',
      'the status line must hold "**Status:** ⬜|🟡|✅"',
      'the status line must hold "**Size:** <n> SP"'
    ]
  )
})

test('the task table is generated from the task files, with the Agent column only where the plan has markers', () => {
  const list = tasks([['7.1', { status: '✅', agent: 'C1', size: 2 }], ['7.2']])
  assert.equal(
    taskTable(list, { marked: true }),
    '| # | Task | Agent | SP | Status |\n| - | ---- | ----- | -- | ------ |\n| [7.1](./7.1.md) | Task 7.1 | C1 | 2 | ✅ |\n| [7.2](./7.2.md) | Task 7.2 | C2 | 3 | ⬜ |'
  )
  assert.match(taskTable(list, { marked: false }), /^\| # \| Task \| SP \| Status \|/)
})

const folderFiles = (size, table) => [
  { file: '7.1.md', text: taskFile('7.1', 'First', { status: '✅', size: 2 }) },
  { file: '7.2.md', text: taskFile('7.2', 'Second', { size: 3, log: '7.2.log.md' }) },
  { file: '7.10.md', text: taskFile('7.10', 'Tenth', { agent: 'C2', size: 1 }) }
]

test('a phase folder is checked: the size of the title, the table, the log links and the markers', () => {
  const table = taskTable(
    folderFiles().map(({ file, text }) => parseTaskFile(file, text)),
    { marked: true }
  )
  const phase = (text, exists) =>
    parsePhaseFolder('phase-7-seventh', text, folderFiles(), { complexity: COMPLEXITY, exists })

  const wrong = phase(readme(5, 'stale table'), (path) => path === 'log.md')
  assert.equal(wrong.taskPoints, 6)
  assert.equal(wrong.points, 5)
  assert.deepEqual(
    wrong.tasks.map((task) => task.id),
    ['7.1', '7.2', '7.10'],
    'ids in task order, 7.2 before 7.10'
  )
  assert.deepEqual(wrong.problems, [
    'phase-7-seventh/7.2.md: the log ./7.2.log.md does not exist',
    'phase-7-seventh/README.md: the task table disagrees with the task files; run `harness plan summary`'
  ])
  assert.deepEqual(wrong.unmarked, [])
  assert.deepEqual(wrong.markers, ['C2', 'C2', 'C2'])

  assert.deepEqual(phase(readme(6, table), () => true).problems, [])
  assert.match(phase(`${readme(6)}`.replace(TASKS_START, ''), () => true).problems.join('\n'), /must sit between/)
  assert.match(
    phase(readme(6, table), (path) => path !== 'log.md').problems.join('\n'),
    /work log \.\/log\.md does not exist/
  )
  assert.throws(() => parsePhaseFolder('phase-7-x', '# Not a phase', [], {}), /phase-7-x\/README\.md: the title/)
})

// The files under `dir` as a map from path to text, and the `list` of a folder over it, so that the hook runs without a disk
function snapshot(root, dir) {
  const files = new Map()
  const visit = (current) => {
    for (const entry of readdirSync(join(root, current), { withFileTypes: true })) {
      const path = `${current}/${entry.name}`
      if (entry.isDirectory()) visit(path)
      else files.set(path, readFileSync(join(root, path), 'utf8'))
    }
  }
  visit(dir)
  return files
}
const lister = (files) => (path) => [
  ...new Set(
    [...files.keys()]
      .filter((file) => file.startsWith(`${path}/`))
      .map((file) => file.slice(path.length + 1).split('/')[0])
  )
]

function project() {
  const root = mkdtempSync(join(tmpdir(), 'phase-folder-'))
  dirs.push(root)
  const write = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  write(
    'plan/README.md',
    `# Plan\n\n${'<!-- plan-summary:start -->'}\nold\n${'<!-- plan-summary:end -->'}\n\n${'<!-- plan-contents:start -->'}\nold\n${'<!-- plan-contents:end -->'}\n`
  )
  write('plan/phases/phase-7-seventh/README.md', readme(6))
  write('plan/phases/phase-7-seventh/log.md', '[← Phase 7](./README.md)\n\n# Phase 7 log\n')
  for (const { file, text } of folderFiles()) write(`plan/phases/phase-7-seventh/${file}`, text)
  write('plan/phases/phase-7-seventh/7.1.log.md', '[← 7.1](./7.1.md)\n\n# 7.1 log\n\n**Status:** ✅ done\n')
  write('plan/phases/phase-7-seventh/7.2.log.md', '[← 7.2](./7.2.md)\n\n# 7.2 log\n\n**Status:** 🟡 in progress\n')
  write(
    'plan/phases/phase-1-first.md',
    '# Phase 1 — First (2 SP)\n\n**Status:** ✅ Done\n\n| 1.1 | text | C1 | 2 | ✅ |\n'
  )
  return {
    root,
    profile: { paths: { phases: 'plan/phases', planIndex: 'plan/README.md' }, plan: { complexity: COMPLEXITY } },
    write
  }
}

test('plan summary writes the phase index and the plan index, and check holds the layout of phases in both layouts', () => {
  const { root, profile, write } = project()
  assert.match(
    planSummary({ root, profile, check: true }).problems.join('\n'),
    /the task table disagrees with the task files/
  )

  const written = planSummary({ root, profile })
  assert.deepEqual(written.problems, [])
  const index = readFileSync(join(root, 'plan/phases/phase-7-seventh/README.md'), 'utf8')
  assert.match(index, /\| \[7\.2\]\(\.\/7\.2\.md\) \| Task? ?|Second/)
  assert.match(index, /\| \[7\.10\]\(\.\/7\.10\.md\) \| Tenth \| C2 \| 1 \| ⬜ \|/)
  const plan = readFileSync(join(root, 'plan/README.md'), 'utf8')
  assert.match(plan, /\| 7 \| Seventh \| 6 \| C2 \| 🟡 In progress \|/)
  assert.match(plan, /- \[Phase 7 — Seventh \(6 SP\)\]\(\.\/phases\/phase-7-seventh\/README\.md\)/)
  assert.match(plan, /- \[Phase 1 — First \(2 SP\)\]\(\.\/phases\/phase-1-first\.md\)/)
  assert.deepEqual(planSummary({ root, profile, check: true }).problems, [])

  // An open task without a marker, a size that is not the sum, and a broken log link are found
  write(
    'plan/phases/phase-7-seventh/7.2.md',
    taskFile('7.2', 'Second', { agent: '', size: 4, log: 'gone.md' }).replace(' · **Agent:** ', '')
  )
  const problems = planSummary({ root, profile, check: true }).problems.join('\n')
  assert.match(problems, /open tasks without an agent-complexity marker \(C1, C2\): 7\.2/)
  assert.match(problems, /the title says 6 SP but the tasks add up to 7 SP/)
  assert.match(problems, /7\.2\.md: the log \.\/gone\.md does not exist/)
})

test('the next task and the session start message read a phase folder: the newest next step across the logs and the open tasks', () => {
  const { root, profile } = project()
  planSummary({ root, profile })
  const files = snapshot(root, 'plan')
  const list = lister(files)
  const readText = (path) => files.get(path) ?? ''
  files.set(
    'plan/phases/phase-7-seventh/log.md',
    '# Phase 7 log\n\n### 2026-11-02 — start\n- **Next step:** open 7.2 on the 3rd\n'
  )
  files.set(
    'plan/phases/phase-7-seventh/7.2.log.md',
    '# 7.2 log\n\n### 2026-11-03 — first\n- **Next step:** write the tests\n\n### 2026-11-04 — second\n- **Next step:** ask the owner\n'
  )

  // On the same day, the log of the task with the higher id is the later one (7.10 after 7.2, not before)
  files.set(
    'plan/phases/phase-7-seventh/7.10.log.md',
    '# 7.10 log\n\n### 2026-11-04 — third\n- **Next step:** ship 7.10\n'
  )
  const tied = sessionStartMessage('develop', readText, list, 'plan/phases', 'docs/method.md', 'plan/README.md')
  assert.match(tied, /Last next step \(plan\/phases\/phase-7-seventh\/7\.10\.log\.md, 2026-11-04\): ship 7\.10/)
  files.delete('plan/phases/phase-7-seventh/7.10.log.md')

  const message = sessionStartMessage('develop', readText, list, 'plan/phases', 'docs/method.md', 'plan/README.md')
  assert.match(message, /Phase in progress: Phase 7 — Seventh \(6 SP\) \(plan\/phases\/phase-7-seventh\/README\.md\)/)
  assert.match(message, /Last next step \(plan\/phases\/phase-7-seventh\/7\.2\.log\.md, 2026-11-04\): ask the owner/)
  assert.match(message, /Open tasks: 7\.2 Second; 7\.10 Tenth/)
  assert.doesNotMatch(message, /7\.1 First/)

  // No phase in progress: the next task comes from the task files
  files.set(
    'plan/phases/phase-7-seventh/README.md',
    files.get('plan/phases/phase-7-seventh/README.md').replace('🟡 In progress', '⬜ Not started')
  )
  const next = sessionStartMessage('develop', readText, list, 'plan/phases', 'docs/method.md', 'plan/README.md')
  assert.match(next, /Next task: 7\.2 Second \(plan\/phases\/phase-7-seventh\/README\.md\), by the table/)
})

test('the newest next step is chosen by the date of its entry, a tie going to the later log', () => {
  const log = (date, step) => `### ${date} — x\n- **Next step:** ${step}\n`
  assert.deepEqual(
    newestNextStep([
      { file: 'log.md', text: log('2026-11-05', 'phase') },
      { file: '1.log.md', text: log('2026-11-04', 'old task') },
      { file: '2.log.md', text: `${log('2026-11-05', 'same day')}${log('2026-11-03', 'older')}` }
    ]),
    { file: '2.log.md', step: 'same day', date: '2026-11-05' }
  )
  assert.equal(newestNextStep([{ file: 'log.md', text: '# empty' }]), null)
})

test('readPhases takes the tasks of a folder phase from its files, and the loader tells the two layouts apart', () => {
  const entries = loadPhaseEntries({
    phasesDir: 'p',
    list: (path) =>
      ({
        p: ['phase-1-a.md', 'phase-2-b', 'work-logs'],
        'p/phase-2-b': ['README.md', '2.1.md', '2.1.log.md', 'log.md']
      })[path] ?? [],
    readText: (path) =>
      path.endsWith('2.1.md') ? taskFile('2.1', 'One') : '# Phase 2 — B (3 SP)\n\n**Status:** ⬜ Not started\n'
  })
  assert.deepEqual(
    entries.map((entry) => [entry.layout, entry.file]),
    [
      ['file', 'phase-1-a.md'],
      ['folder', 'phase-2-b/README.md']
    ]
  )
  assert.deepEqual(
    entries[1].taskFiles.map((item) => item.file),
    ['2.1.md']
  )

  const phases = readPhases([
    {
      file: 'p/phase-2-b/README.md',
      text: '# Phase 2 — B (3 SP)\n\n**Status:** ⬜ Not started\n',
      tasks: [parseTaskFile('2.1.md', taskFile('2.1', 'One'))]
    }
  ])
  assert.equal(nextTask({ phases }).id, '2.1')
})
