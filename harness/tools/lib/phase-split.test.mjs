// Splitting a phase into a folder (task 3.10): the files it makes, the links it rewrites across the repository (anchors included), and that it runs twice.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import migration from '../../migrations/0.2.0.mjs'
import { run } from '../harness.mjs'
import { checkLinks } from './links.mjs'
import { rewriteLinks, splitPhases, readTaskTable } from './phase-split.mjs'
import { planSummary } from './plan.mjs'

const dirs = []
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

const PHASE = `[← Development plan index](../README.md)

# Phase 5 — Fifth theme (5 SP, grows as issues are added)

**Status:** 🟡 In progress · **Branches:** see the [implementation log](#implementation-log) · **Work log:** [phase-5-log](./work-logs/phase-5-log.md), and one fragment per task in \`work-logs/phase-5/\`

The goal, with a [spec link](../../../spec/spec.md#section-two) and a path in code: \`docs/plan/phases/work-logs/phase-5-log.md\`.

**Execution order:** 5.2 first.

| #   | Task | Agent | SP  | Status |
| --- | ---- | ----- | --- | ------ |
| 5.1 | **First task**: delivers the first thing, see [the spec](../../../spec/spec.md). | C1 | 2 | ✅ |
| 5.2 | **Second task**: delivers more, with a pipe \\| inside. Needs 5.1 first. | C2 | 3 | 🟡 |

Task status: ⬜ not started · 🟡 in progress · ✅ done.

**Exit criteria:** everything works.

## Implementation log

| Tasks | PR | Change | Merged |
| ----- | -- | ------ | ------ |
| 5.1 | [#9](https://example.test/pull/9) | The first thing | 2026-11-01 |
`

const LOG = `[← Phase 5](../phase-5-fifth.md)

# Phase 5 — work log

### 2026-11-03 — start
- **Next step:** do 5.2
`
const TASK_LOG = `[← Phase 5](../../phase-5-fifth.md)

# 5.2 — Second — work log

**Status:** 🟡 in progress

### 2026-11-04 — work
- **Next step:** finish it. See [the phase](../../phase-5-fifth.md#implementation-log) and [the spec](../../../../../spec/spec.md).
`

function project() {
  const root = mkdtempSync(join(tmpdir(), 'phase-split-'))
  dirs.push(root)
  const write = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  write(
    'docs/plan/README.md',
    '# Plan\n\n<!-- plan-summary:start -->\nold\n<!-- plan-summary:end -->\n\n<!-- plan-contents:start -->\nold\n<!-- plan-contents:end -->\n\nSee [phase 5](./phases/phase-5-fifth.md#implementation-log) and [its log](./phases/work-logs/phase-5-log.md#2026-11-03--start).\n'
  )
  write('docs/plan/phases/phase-5-fifth.md', PHASE)
  write('docs/plan/phases/work-logs/phase-5-log.md', LOG)
  write('docs/plan/phases/work-logs/phase-5/5.2.md', TASK_LOG)
  write('docs/plan/phases/work-logs/phase-5/notes.md', 'not a task log\n')
  write(
    'docs/plan/phases/phase-6-done.md',
    '# Phase 6 — Done (1 SP)\n\n**Status:** ✅ Done\n\n| # | Task | SP | Status |\n| - | - | - | - |\n| 6.1 | x | 1 | ✅ |\n'
  )
  write('spec/spec.md', '# Spec\n\n## Section two\n')
  write(
    'docs/guide.md',
    'Read [the plan](plan/phases/phase-5-fifth.md) and `docs/plan/phases/work-logs/phase-5/5.2.md`.\n'
  )
  execFileSync('git', ['init', '-q'], { cwd: root })
  execFileSync('git', ['add', '-A'], { cwd: root })
  return {
    root,
    profile: {
      paths: { phases: 'docs/plan/phases', planIndex: 'docs/plan/README.md' },
      plan: { complexity: { scale: { C1: 'a', C2: 'b' } } }
    },
    read: (path) => readFileSync(join(root, path), 'utf8')
  }
}

test('a link is followed to where its target moved, and written relative to where the text now stands', () => {
  const moves = new Map([
    ['a/phase.md', 'a/phase/README.md'],
    ['a/logs/x.md', 'a/phase/x.log.md']
  ])
  assert.equal(
    rewriteLinks(
      '[p](./phase.md#top) [l](logs/x.md) [s](../spec.md) [u](https://x/y)',
      'a/other.md',
      'a/other.md',
      moves
    ),
    '[p](./phase/README.md#top) [l](phase/x.log.md) [s](../spec.md) [u](https://x/y)'
  )
  assert.equal(
    rewriteLinks('[s](../spec.md) [p](phase.md)', 'a/phase.md', 'a/phase/README.md', moves),
    '[s](../../spec.md) [p](README.md)'
  )
  assert.equal(
    rewriteLinks('[#x](#x)\n[ref]: ../spec.md', 'a/phase.md', 'a/phase/README.md', moves),
    '[#x](#x)\n[ref]: ../../spec.md'
  )
})

test('the task table of a phase file is read with its agent column and escaped pipes', () => {
  const { rows, hasAgent } = readTaskTable(PHASE.split('\n'))
  assert.equal(hasAgent, true)
  assert.deepEqual(
    rows.map((row) => [row.id, row.agent, row.points, row.status]),
    [
      ['5.1', 'C1', 2, '✅'],
      ['5.2', 'C2', 3, '🟡']
    ]
  )
  assert.match(rows[1].description, /with a pipe \\\| inside/)
  assert.throws(() => readTaskTable(['no table']), /no task table/)
})

test('an open phase becomes a folder: the phase index, a file per task, the logs beside them, and every link follows', () => {
  const { root, profile, read } = project()
  const { messages } = splitPhases({ root, profile, numbers: null })
  assert.match(
    messages.join('\n'),
    /Split Phase 5: docs\/plan\/phases\/phase-5-fifth\.md is now docs\/plan\/phases\/phase-5-fifth\/ with 2 task file\(s\), 1 task log\(s\) and log\.md/
  )
  assert.ok(
    !existsSync(join(root, 'docs/plan/phases/phase-5-fifth.md')) &&
      !existsSync(join(root, 'docs/plan/phases/work-logs/phase-5-log.md'))
  )
  assert.ok(existsSync(join(root, 'docs/plan/phases/work-logs/phase-5/notes.md')), 'a file that is no task log stays')
  assert.ok(existsSync(join(root, 'docs/plan/phases/phase-6-done.md')), 'a finished phase is not split')

  const folder = 'docs/plan/phases/phase-5-fifth'
  const readme = read(`${folder}/README.md`)
  assert.match(readme, /^\[← Development plan index\]\(\.\.\/\.\.\/README\.md\)/)
  assert.match(readme, /\*\*Work log:\*\* \[log\]\(\.\/log\.md\), and a log beside each task/)
  assert.match(readme, /\[spec link\]\(\.\.\/\.\.\/\.\.\/\.\.\/spec\/spec\.md#section-two\)/)
  assert.match(readme, /`docs\/plan\/phases\/phase-5-fifth\/log\.md`/, 'a path in a code span follows')
  assert.match(readme, /\| \[5\.1\]\(\.\/5\.1\.md\) \| First task \| C1 \| 2 \| ✅ \|/)
  assert.match(readme, /\*\*Exit criteria:\*\* everything works\./)

  const task = read(`${folder}/5.2.md`)
  assert.match(
    task,
    /^\[← Phase 5 — Fifth theme\]\(\.\/README\.md\)\n\n# 5\.2 — Second task\n\n\*\*Status:\*\* 🟡 · \*\*Agent:\*\* C2 · \*\*Size:\*\* 3 SP · \*\*Needs:\*\* 5\.1 · \*\*Log:\*\* \[5\.2\.log\.md\]\(\.\/5\.2\.log\.md\)/
  )
  assert.doesNotMatch(read(`${folder}/5.1.md`), /\*\*Log:\*\*/, 'a task with no log has no log link')
  assert.match(read(`${folder}/5.1.md`), /\[the spec\]\(\.\.\/\.\.\/\.\.\/\.\.\/spec\/spec\.md\)/)

  const log = read(`${folder}/5.2.log.md`)
  assert.match(log, /^\[← 5\.2 — Second task\]\(\.\/5\.2\.md\)/)
  assert.match(
    log,
    /\[the phase\]\(\.\/README\.md#implementation-log\) and \[the spec\]\(\.\.\/\.\.\/\.\.\/\.\.\/spec\/spec\.md\)/
  )
  assert.match(read(`${folder}/log.md`), /^\[← Phase 5\]\(\.\/README\.md\)/)

  assert.match(
    read('docs/plan/README.md'),
    /\[phase 5\]\(\.\/phases\/phase-5-fifth\/README\.md#implementation-log\) and \[its log\]\(\.\/phases\/phase-5-fifth\/log\.md#2026-11-03--start\)/
  )
  assert.equal(
    read('docs/guide.md'),
    'Read [the plan](plan/phases/phase-5-fifth/README.md) and `docs/plan/phases/phase-5-fifth/5.2.log.md`.\n'
  )
  assert.match(read('docs/plan/README.md'), /\| 5 \| Fifth theme \| 5 \(grows\) \| C1–C2 \| 🟡 In progress \|/)
  assert.match(
    read('docs/plan/README.md'),
    /\[Phase 5 — Fifth theme \(5 SP, grows as issues are added\)\]\(\.\/phases\/phase-5-fifth\/README\.md\)/
  )

  execFileSync('git', ['add', '-A'], { cwd: root })
  assert.deepEqual(checkLinks({ root }), { problems: [], count: checkLinks({ root }).count }, 'no link is left broken')
  assert.deepEqual(planSummary({ root, profile, check: true }).problems, [])
})

test('the split runs twice without change, as the migration script of 0.2.0, and by choice for one phase through the command line', async () => {
  const { root, profile, read } = project()
  const first = await migration({ root, profile })
  assert.match(first.join('\n'), /Split Phase 5/)
  const before = read('docs/plan/phases/phase-5-fifth/README.md')
  const second = await migration({ root, profile })
  assert.deepEqual(second, [])
  assert.equal(read('docs/plan/phases/phase-5-fifth/README.md'), before)

  // A finished phase is split when asked for
  const lines = []
  const code = await run(['plan', 'split', '6', '--root', root], {
    out: (line) => lines.push(line),
    err: (line) => lines.push(line)
  })
  assert.equal(code, 1, 'the root has no profile file here')
  assert.equal(splitPhases({ root, profile, numbers: [6] }).messages.length, 1)
  assert.ok(existsSync(join(root, 'docs/plan/phases/phase-6-done/6.1.md')))
  assert.equal(splitPhases({ root, profile, numbers: [6] }).messages[0], 'Phase 6 is a folder already.')
  assert.equal(splitPhases({ root, profile, numbers: [9] }).messages[0], 'Phase 9 has no phase file.')
})
