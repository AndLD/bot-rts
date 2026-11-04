// The structure checks of a phase (task 4.2): each check fails on a planted defect and passes on the template's form.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import { TASKS_END, TASKS_START } from './phase-files.mjs'
import {
  backLinkOf,
  backLinkProblems,
  implementationSection,
  indexPartsProblems,
  logProblems,
  needsProblems,
  recordProblems,
  workLogProblems
} from './phase-structure.mjs'
import { planSummary } from './plan.mjs'

const dirs = []
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

const INDEX = [
  '[← Development plan](../../README.md)',
  '',
  '# Phase 7 — Seventh (3 SP)',
  '',
  '**Status:** 🟡 In progress · **Work log:** [log](./log.md)',
  '',
  'Goal.',
  '',
  '**Execution order:** 7.1.',
  '',
  TASKS_START,
  TASKS_END,
  '',
  'Task status: ⬜ not started · 🟡 in progress · ✅ done.',
  '',
  '**Exit criteria:** all done.',
  '',
  '## Implementation log',
  '',
  'Printed from the merged pull requests.',
  ''
].join('\n')

test('the back-link is the first line and resolves to the document it names', () => {
  assert.equal(backLinkOf('\n[← Plan](../../README.md)\n\n# T'), '../../README.md')
  assert.equal(backLinkOf('# No link'), null)
  const check = (text) =>
    backLinkProblems({ file: 'plan/phases/p/README.md', text, expected: 'plan/README.md', what: 'the plan index' })
  assert.deepEqual(check('[← Plan](../../README.md#top)\n'), [])
  assert.match(
    check('# T\n')[0],
    /the first line must be a link back to the plan index \(`\[← …\]\(\.\.\/\.\.\/README\.md\)`\)/
  )
  assert.match(
    check('[← Plan](../README.md)\n')[0],
    /links to \.\.\/README\.md, which is not the plan index \(plan\/README\.md\)/
  )
})

test('a phase index has every part, in order; the optional execution order is checked only where it is', () => {
  assert.deepEqual(indexPartsProblems({ file: 'p/README.md', text: INDEX }), [])
  assert.deepEqual(
    indexPartsProblems({ file: 'p/README.md', text: INDEX.replace('**Execution order:** 7.1.\n\n', '') }),
    []
  )

  const without = INDEX.replace(/^Task status:.*\n/m, '').replace(/## Implementation log[\s\S]*$/, '')
  const missing = indexPartsProblems({ file: 'p/README.md', text: without }).join('\n')
  assert.match(missing, /no task legend \(the line `Task status: …`\); start from core\/plan\/phase-index-template\.md/)
  assert.match(missing, /no implementation log \(the heading `## Implementation log`\)/)

  const moved = INDEX.replace('**Exit criteria:** all done.\n\n', '').replace(
    'Goal.\n',
    'Goal.\n\n**Exit criteria:** all done.\n'
  )
  assert.match(
    indexPartsProblems({ file: 'p/README.md', text: moved }).join('\n'),
    /the task table must come before the exit criteria|the exit criteria must come after|the order is title, status line/
  )
  const late = INDEX.replace('**Execution order:** 7.1.\n\n', '').replace(
    TASKS_END,
    `${TASKS_END}\n\n**Execution order:** 7.1.`
  )
  assert.match(
    indexPartsProblems({ file: 'p/README.md', text: late }).join('\n'),
    /the task table must come before the execution order/
  )
})

test('the exit criteria are the line of the template and not a heading', () => {
  const heading = INDEX.replace('**Exit criteria:** all done.', '## Exit criteria\n\nAll done.')
  const problems = indexPartsProblems({ file: 'p/README.md', text: heading }).join('\n')
  assert.match(problems, /no exit criteria/)
  assert.match(
    problems,
    /write the exit criteria as the line `\*\*Exit criteria:\*\* …` of the template, not as a heading/
  )
})

test('the work log is linked and exists when the phase has one, and a log links back and says its status', () => {
  const exists = (path) => path === 'log.md'
  assert.deepEqual(workLogProblems({ file: 'p/README.md', text: INDEX, exists }), [])
  assert.match(
    workLogProblems({ file: 'p/README.md', text: INDEX.replace('[log](./log.md)', '`log.md`'), exists }).join(''),
    /must link the work log, which exists/
  )
  assert.deepEqual(
    workLogProblems({ file: 'p/README.md', text: INDEX.replace('[log](./log.md)', '`log.md`'), exists: () => false }),
    []
  )
  assert.match(
    workLogProblems({ file: 'p/README.md', text: INDEX, exists: () => false }).join(''),
    /the work log \.\/log\.md does not exist/
  )

  const log = (text, status = true) =>
    logProblems({ file: 'p/7.1.log.md', text, expected: 'p/7.1.md', what: 'the task 7.1', status })
  assert.deepEqual(log('[← 7.1](./7.1.md)\n\n# 7.1 log\n\n**Status:** ✅ done\n'), [])
  assert.match(log('# 7.1 log\n').join('\n'), /the first line must be a link back to the task 7\.1/)
  assert.match(log('[← 7.1](./7.1.md)\n\n# log\n').join('\n'), /the log must have a `\*\*Status:\*\* 🟡\|✅` line/)
  assert.deepEqual(
    log('[← Phase](./README.md)\n\n# log\n', false).length,
    1,
    'the phase log has no status line but links back'
  )
})

test('a done task has its log, or its row when the implementation log keeps a table', () => {
  const hasLog = (id) => id === '7.1'
  const input = (done, section) => ({ done, section, hasLog, file: 'p/README.md' })
  assert.deepEqual(recordProblems(input(['7.1'], 'Printed from the merged pull requests.\n')), [])
  assert.match(
    recordProblems(input(['7.1', '7.2'], 'Printed.\n'))[0],
    /the done tasks 7\.2 have no log of their own \(`<id>\.log\.md`\) and the implementation log keeps no table/
  )
  const table = '| Tasks | PR |\n| ----- | -- |\n| 7.1, 7.3 | #4 |\n'
  assert.deepEqual(recordProblems(input(['7.1', '7.3'], table)), [])
  assert.match(
    recordProblems(input(['7.1', '7.2'], table))[0],
    /the done tasks 7\.2 have no row in the implementation log/
  )
  assert.match(recordProblems(input(['7.1', '7.10'], table))[0], /7\.10 have no row/, '7.1 is not 7.10')
  assert.equal(implementationSection(INDEX), '\nPrinted from the merged pull requests.\n')
  assert.equal(implementationSection('# No section'), '')
})

test('a task needs only tasks that exist and that are not in a later phase', () => {
  const known = new Set(['6.2', '7.1', '8.1', 'I-3'])
  const task = (needs) => ({ file: 'p/7.2.md', id: '7.2', needs })
  assert.deepEqual(needsProblems({ tasks: [task('6.2, 7.1, I-3 (and `0.2.0`)'), task(null)], known, phase: 7 }), [])
  assert.deepEqual(needsProblems({ tasks: [task('7.9')], known, phase: 7 }), [
    'p/7.2.md: the task needs 7.9, which exists in no phase and not in the issue queue'
  ])
  assert.match(
    needsProblems({ tasks: [task('8.1')], known, phase: 7 })[0],
    /the task needs 8\.1, a task of a later phase; a task never depends on a later phase/
  )
})

// A phase folder in a project, checked end to end by `plan summary --check`
function project() {
  const root = mkdtempSync(join(tmpdir(), 'phase-structure-'))
  dirs.push(root)
  const write = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  write(
    'plan/README.md',
    `# Plan\n\n<!-- plan-summary:start -->\n<!-- plan-summary:end -->\n\n<!-- plan-contents:start -->\n<!-- plan-contents:end -->\n`
  )
  const folder = 'plan/phases/phase-7-seventh'
  write(`${folder}/README.md`, INDEX.replace('(3 SP)', '(3 SP)'))
  write(
    `${folder}/7.1.md`,
    '[← Phase 7](./README.md)\n\n# 7.1 — First\n\n**Status:** ✅ · **Size:** 3 SP · **Log:** [7.1.log.md](./7.1.log.md)\n'
  )
  write(`${folder}/7.1.log.md`, '[← 7.1](./7.1.md)\n\n# 7.1 — First — log\n\n**Status:** ✅ done\n')
  write(`${folder}/log.md`, '[← Phase 7](./README.md)\n\n# Phase 7 log\n')
  const profile = { paths: { phases: 'plan/phases', planIndex: 'plan/README.md' } }
  planSummary({ root, profile })
  return { root, profile, write, folder }
}

const problemsOf = ({ root, profile }) => planSummary({ root, profile, check: true }).problems.join('\n')

test('plan summary --check holds the structure of a phase folder and names each planted defect', () => {
  const ctx = project()
  const { write, folder } = ctx
  assert.equal(problemsOf(ctx), '')

  write(`${folder}/7.1.md`, '# 7.1 — First\n\n**Status:** ✅ · **Size:** 3 SP · **Log:** [7.1.log.md](./7.1.log.md)\n')
  assert.match(
    problemsOf(ctx),
    /phases\/phase-7-seventh\/7\.1\.md: the first line must be a link back to the phase index/
  )
  write(
    `${folder}/7.1.md`,
    '[← Phase 7](./README.md)\n\n# 7.1 — First\n\n**Status:** ✅ · **Size:** 3 SP · **Log:** [7.1.log.md](./7.1.log.md)\n'
  )

  write(`${folder}/7.1.log.md`, '# 7.1 — First — log\n')
  assert.match(problemsOf(ctx), /7\.1\.log\.md: the first line must be a link back to the task 7\.1/)
  assert.match(problemsOf(ctx), /7\.1\.log\.md: the log must have a `\*\*Status:\*\*/)
  write(`${folder}/7.1.log.md`, '[← 7.1](./7.1.md)\n\n# 7.1 — First — log\n\n**Status:** ✅ done\n')

  write(
    `${folder}/7.2.md`,
    '[← Phase 7](./README.md)\n\n# 7.2 — Second\n\n**Status:** ⬜ · **Size:** 0 SP · **Needs:** 7.9, 9.1\n'
  )
  assert.match(problemsOf(ctx), /7\.2\.md: the task needs 7\.9, which exists in no phase/)
  rmSync(join(ctx.root, folder, '7.2.md'))

  rmSync(join(ctx.root, folder, '7.1.log.md'))
  assert.match(problemsOf(ctx), /the done tasks 7\.1 have no log of their own/)
})
