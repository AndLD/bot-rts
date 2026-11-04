// The backlog (tasks 3.20 and 3.21): the queue of the feature requests, which is the issue queue's module read with another kind: its items and their `Source:`,
// their statuses (an item is proposed, never started as it is, and promoted into a task of a phase by the owner), the two indexes, the archive, the line in the
// plan index, the numbers an item took over from the issue queue, and what the triage of reports and the session start say about it.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import { run } from '../harness.mjs'
import { sessionStartMessage } from '../runtime-hooks/session-start.mjs'
import { promoteItem } from './backlog-promote.mjs'
import { BACKLOG, nextIssueNumber, parseIssueFile, readQueue } from './issue-queue.mjs'
import { planSummary, readBacklogOf } from './plan.mjs'
import { candidates, recordedReports, triagePlan } from './reports.mjs'

const dirs = []
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

const itemFile = (
  id,
  title,
  { status = 'Proposed', agent, size, area = 'procedures', source = 'owner', formerly, promotedTo } = {}
) =>
  `[← Backlog](./README.md)\n\n# ${id} — ${title}\n\n**Status:** ${status}${promotedTo ? ` · **Promoted to:** ${promotedTo}` : ''}` +
  `${agent ? ` · **Agent:** ${agent}` : ''}${size ? ` · **Size:** ${size} SP` : ''} · **Area:** ${area} · **Source:** ${source}` +
  `${formerly ? ` · **Formerly:** ${formerly}` : ''}\n\nWhat ${id} is.\n`

const issueFile = (id, title) =>
  `[← Issue queue](./README.md)\n\n# ${id} — ${title}\n\n**Status:** ⬜ · **Agent:** C1 · **Size:** 2 SP · **Area:** procedures · **Reported:** —\n\nWhat ${id} is.\n`

test('a backlog item says where it came from, and a source that is none of the three is a problem', () => {
  const report = parseIssueFile(
    'B-1.md',
    itemFile('B-1', 'A switch', {
      source: 'report — [GitHub issue 65](https://h/65), [GitHub issue 70](https://h/70)',
      formerly: 'I-6'
    }),
    BACKLOG
  )
  assert.deepEqual(report.problems, [])
  assert.equal(report.id, 'B-1')
  assert.equal(report.formerly, 'I-6')
  assert.match(report.reported, /^report — /)
  for (const source of ['owner', 'agent']) {
    assert.deepEqual(parseIssueFile('B-2.md', itemFile('B-2', 'x', { source }), BACKLOG).problems, [])
  }
  const bad = parseIssueFile('B-3.md', itemFile('B-3', 'x', { source: 'a friend' }), BACKLOG)
  assert.match(bad.problems.join('\n'), /the source "a friend" must start with one of report, owner, agent/)
  const none = parseIssueFile(
    'B-4.md',
    '# B-4 — x\n\n**Status:** Proposed · **Size:** 1 SP · **Area:** procedures\n',
    BACKLOG
  )
  assert.match(none.problems.join('\n'), /\*\*Source:\*\*/)
  assert.doesNotMatch(none.problems.join('\n'), /Reported/)
  // A proposal has no marker and no size to begin with, and the statuses of a task are not the statuses of an item
  assert.deepEqual(parseIssueFile('B-5.md', itemFile('B-5', 'x'), BACKLOG).problems, [])
  const task = parseIssueFile('B-5.md', itemFile('B-5', 'x', { status: '🟡' }), BACKLOG)
  assert.match(task.problems.join('\n'), /the status line must hold "\*\*Status:\*\* Proposed\|Promoted"/)
  const noTask = parseIssueFile('B-6.md', itemFile('B-6', 'x', { status: 'Promoted' }), BACKLOG)
  assert.match(noTask.problems.join('\n'), /a promoted item must hold "\*\*Promoted to:\*\*/)
  const early = parseIssueFile('B-7.md', itemFile('B-7', 'x', { promotedTo: '5.2' }), BACKLOG)
  assert.match(early.problems.join('\n'), /a proposed item has not been promoted, so it holds no "Promoted to"/)
  const done = parseIssueFile('B-8.md', itemFile('B-8', 'x', { status: 'Promoted', promotedTo: '5.2' }), BACKLOG)
  assert.deepEqual([done.problems, done.promotedTo], [[], '5.2'])
  // An issue file is not a backlog item, and the other way round
  assert.match(
    parseIssueFile('I-1.md', itemFile('B-1', 'x'), undefined).problems.join('\n'),
    /title must read "# I-<n>/
  )
})

function project() {
  const root = mkdtempSync(join(tmpdir(), 'backlog-'))
  dirs.push(root)
  const write = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  const read = (path) => readFileSync(join(root, path), 'utf8')
  const profile = {
    paths: {
      phases: 'plan/phases',
      planIndex: 'plan/README.md',
      issues: 'plan/issues',
      backlog: 'plan/backlog',
      frameworkDir: '.'
    },
    plan: { complexity: { scale: { C1: 'a', C2: 'b' } } }
  }
  write('migrations/areas.json', JSON.stringify({ areas: { procedures: [], 'plan format': [] } }))
  write(
    'plan/README.md',
    '# Plan\n\n<!-- plan-summary:start -->\n<!-- plan-summary:end -->\n\n<!-- plan-issues:start -->\n<!-- plan-issues:end -->\n\n<!-- plan-backlog:start -->\n<!-- plan-backlog:end -->\n\n**Order of development**\n\n| Release | Tasks, in order |\n| - | - |\n| `1.0.0` | 5.1 |\n\n---\n\n<!-- plan-contents:start -->\n<!-- plan-contents:end -->\n'
  )
  write(
    'plan/phases/phase-5-five.md',
    '# Phase 5 — Five (1 SP)\n\n**Status:** ✅ Done\n\n**Execution order:** 5.1.\n\n| # | Task | Agent | SP | Status |\n| - | - | - | - | - |\n| 5.1 | x | C1 | 1 | ✅ |\n'
  )
  write('plan/issues/README.md', '# Issue queue\n\n<!-- issue-queue:start -->\n<!-- issue-queue:end -->\n')
  write('plan/backlog/README.md', '# Backlog\n\n<!-- backlog:start -->\n<!-- backlog:end -->\n')
  write('plan/backlog/archived/README.md', '# Archived\n\n<!-- backlog:start -->\n<!-- backlog:end -->\n')
  write(
    'plan/backlog/B-1.md',
    itemFile('B-1', 'A switch', {
      size: 5,
      source: 'report — [GitHub issue 65](https://h/issues/65)',
      formerly: 'I-6'
    })
  )
  write('plan/backlog/B-2.md', itemFile('B-2', 'Another', { source: 'agent' }))
  return { root, profile, write, read }
}

test('plan summary writes the index of the backlog with its Source column and no marker, shows it in the plan index apart from the phases, and check holds it', () => {
  const { root, profile, read } = project()
  assert.match(
    planSummary({ root, profile, check: true }).problems.join('\n'),
    /the item table disagrees with the item files/
  )
  assert.deepEqual(planSummary({ root, profile }).problems, [])
  const index = read('plan/backlog/README.md')
  assert.match(index, /\| Item \| Title \| Area \| SP \| Status \| Source \|/)
  assert.match(
    index,
    /\| \[B-1\]\(\.\/B-1\.md\) \| A switch \| procedures \| 5 \| Proposed \| report — \[GitHub issue 65\]\(https:\/\/h\/issues\/65\) \|/
  )
  assert.match(index, /\| \[B-2\]\(\.\/B-2\.md\) \| Another \| procedures \| — \| Proposed \| agent \|/)
  assert.match(
    read('plan/README.md'),
    /\*\*Backlog\*\* \(proposals the owner has not approved; not a phase, and not in the totals above\): \[2 proposed\]\(\.\/backlog\/README\.md\); 0 promoted\./
  )
  assert.deepEqual(planSummary({ root, profile, check: true }).problems, [])
  // The issue queue is untouched by the backlog
  assert.doesNotMatch(read('plan/issues/README.md'), /B-1/)
})

test('an item that was promoted is archived with the back-link of the backlog archive and its task in the index', () => {
  const { root, profile, write, read } = project()
  planSummary({ root, profile })
  write('plan/backlog/B-2.md', itemFile('B-2', 'Another', { source: 'agent', status: 'Promoted', promotedTo: '5.2' }))
  assert.match(
    planSummary({ root, profile, check: true }).problems.join('\n'),
    /B-2\.md: the item is promoted and not archived/
  )
  planSummary({ root, profile })
  assert.ok(!existsSync(join(root, 'plan/backlog/B-2.md')))
  assert.match(read('plan/backlog/archived/B-2.md'), /^\[← Archived backlog items\]\(\.\/README\.md\)/)
  assert.match(
    read('plan/backlog/archived/README.md'),
    /\| Item \| Title \| Area \| Promoted to \| Source \|\n\| ---- \| ----- \| ---- \| ----------- \| ------ \|\n\| \[B-2\]\(\.\/B-2\.md\) \| Another \| procedures \| 5\.2 \| agent \|/
  )
  assert.match(read('plan/README.md'), /\[1 proposed\]\(\.\/backlog\/README\.md\); 1 promoted\./)
  assert.deepEqual(planSummary({ root, profile, check: true }).problems, [])
  const archived = readBacklogOf(root, profile).archived
  assert.deepEqual(
    archived.map((item) => [item.id, item.status, item.promotedTo]),
    [['B-2', 'Promoted', '5.2']]
  )
})

test('an order, an execution order or a Needs that names an item nobody has approved is a problem; once the item is promoted the plan names its task', () => {
  const { root, profile, write, read } = project()
  planSummary({ root, profile })
  const order = (names) =>
    write('plan/README.md', read('plan/README.md').replace(/\| `1\.0\.0` \| .*? \|/, `| \`1.0.0\` | ${names} |`))
  order('5.1, B-1')
  assert.match(
    planSummary({ root, profile, check: true }).problems.join('\n'),
    /plan\/README\.md: the order of development names the backlog item B-1, which is not approved work: the owner promotes it into a task of a phase first/
  )
  // The number the item took over from the issue queue is not approved work either
  order('5.1, I-6')
  assert.match(planSummary({ root, profile, check: true }).problems.join('\n'), /names the backlog item I-6/)
  // An id that exists nowhere keeps its old message
  order('5.1, B-9')
  assert.match(
    planSummary({ root, profile, check: true }).problems.join('\n'),
    /names task B-9, which exists in no phase/
  )

  order('5.1')
  write(
    'plan/phases/phase-5-five.md',
    read('plan/phases/phase-5-five.md').replace('**Execution order:** 5.1.', '**Execution order:** 5.1, B-2.')
  )
  assert.match(
    planSummary({ root, profile, check: true }).problems.join('\n'),
    /the execution order names the backlog item B-2/
  )

  write(
    'plan/backlog/B-1.md',
    itemFile('B-1', 'A switch', { size: 5, formerly: 'I-6', status: 'Promoted', promotedTo: '5.1' })
  )
  write('plan/phases/phase-5-five.md', read('plan/phases/phase-5-five.md').replace('5.1, B-2.', '5.1.'))
  planSummary({ root, profile })
  order('5.1, B-1, I-6')
  assert.deepEqual(planSummary({ root, profile, check: true }).problems, [], 'a promoted item and its old id resolve')
})

test('a number that left the issue queue is never given again', () => {
  const { root, profile, write } = project()
  planSummary({ root, profile })
  assert.deepEqual(planSummary({ root, profile, check: true }).problems, [])
  write('plan/issues/I-6.md', issueFile('I-6', 'Reused'))
  const problems = planSummary({ root, profile, check: true }).problems.join('\n')
  assert.match(
    problems,
    /I-6\.md: the id I-6 moved to the backlog \(a backlog item says "Formerly: I-6"\) and is never reused/
  )

  const issues = readQueue({
    dir: 'plan/issues',
    list: (path) => (path === 'plan/issues' ? ['README.md', 'I-1.md'] : []),
    readText: (path) => (path.endsWith('I-1.md') ? issueFile('I-1', 'One') : '')
  })
  assert.equal(nextIssueNumber(issues), 2)
  assert.equal(nextIssueNumber(issues, ['I-6']), 7)
  const backlog = readBacklogOf(root, profile)
  assert.equal(backlog.kind, BACKLOG)
  assert.equal(nextIssueNumber(backlog), 3)
})

test('a project without the role has no backlog', () => {
  const { root, profile } = project()
  assert.equal(readBacklogOf(root, { paths: { ...profile.paths, backlog: undefined } }), null)
})

test('a feature request is a backlog item: the triage plan says so, the candidates include the backlog, and a report in an item’s Source is triaged', () => {
  const steps = triagePlan({ relation: 'feature' }).steps.join('\n')
  assert.match(steps, /add a new item to the backlog, as proposed/)
  assert.match(steps, /Source: report/)
  assert.match(steps, /waits for the owner’s decision/)
  const held = triagePlan({ relation: 'feature', candidate: { id: 'B-1', where: 'open' } }).steps.join('\n')
  assert.match(held, /add the report to the `Source:` of the backlog item B-1/)
  assert.throws(
    () => triagePlan({ relation: 'wish' }),
    /the relation is one of same, close, different, not-a-defect, feature/
  )

  const { root, profile } = project()
  const backlog = readBacklogOf(root, profile)
  const found = candidates({
    report: { title: 'A switch for the procedures of a migration', body: '' },
    backlog
  })
  assert.equal(found[0].id, 'B-1')
  assert.equal(found[0].where, 'open')
  assert.deepEqual([...recordedReports({ backlog })], [65])
  assert.deepEqual([...recordedReports({})], [])
})

test('the session start says how many proposals the backlog holds and that none is started as it is; a project without one gets no line', () => {
  const files = { 'plan/backlog/README.md': '', 'plan/backlog/B-1.md': '', 'plan/backlog/B-2.md': '' }
  const list = (path) => (path === 'plan/backlog' ? ['README.md', 'B-1.md', 'B-2.md'] : [])
  const message = sessionStartMessage(
    'main',
    (path) => files[path] ?? '',
    list,
    'plan/phases',
    'm',
    null,
    null,
    [],
    'plan/backlog'
  )
  assert.match(
    message,
    /Backlog: 2 proposed item\(s\) \(plan\/backlog\/README\.md\); none is started as it is: the owner promotes an item into a task of a phase first/
  )
  assert.doesNotMatch(
    sessionStartMessage(
      'main',
      () => '',
      () => [],
      'plan/phases'
    ),
    /Backlog/
  )
})

test('a project that names the role after its plan exists gets the folder, its two indexes and the block of the plan index from plan summary, once', () => {
  const { root, profile, write, read } = project()
  const FRAMEWORK = new URL('../..', import.meta.url).pathname
  for (const name of ['backlog-queue.md', 'backlog-archive.md']) {
    write(`core/templates/scaffold/${name}`, readFileSync(join(FRAMEWORK, 'core/templates/scaffold', name), 'utf8'))
  }
  rmSync(join(root, 'plan/backlog'), { recursive: true })
  write(
    'plan/README.md',
    read('plan/README.md').replace(/<!-- plan-backlog:start -->\n<!-- plan-backlog:end -->\n\n/, '')
  )
  const bare = { ...profile, paths: { ...profile.paths, backlog: undefined } }
  assert.equal(planSummary({ root, profile: bare }).message, 'Wrote the plan summary of 1 phases.')
  assert.ok(!existsSync(join(root, 'plan/backlog')), 'no role, no backlog')

  const named = { ...profile, paths: { ...profile.paths, backlog: 'plan/backlog', issues: 'plan/issues' } }
  assert.deepEqual(planSummary({ root, profile: named, check: true }).problems, [])
  const { message, problems } = planSummary({ root, profile: named })
  assert.match(
    message,
    /Set up the backlog: created plan\/backlog\/README\.md, plan\/backlog\/archived\/README\.md, the block of the backlog in plan\/README\.md\./
  )
  assert.deepEqual(problems, [])
  assert.match(read('plan/backlog/README.md'), /^\[← Development plan\]\(\.\.\/README\.md\)\n\n# Backlog/)
  assert.match(read('plan/backlog/archived/README.md'), /^\[← Backlog\]\(\.\.\/README\.md\)/)
  assert.match(read('plan/README.md'), /<!-- plan-issues:end -->\n\n<!-- plan-backlog:start -->\n\*\*Backlog\*\*/)
  assert.deepEqual(planSummary({ root, profile: named, check: true }).problems, [])
  assert.equal(
    planSummary({ root, profile: named }).message,
    'Wrote the plan summary of 1 phases.',
    'the second run creates nothing'
  )
})

// A project whose Phase 5 is a folder, with one task, and a backlog of two proposals
function promotionProject() {
  const made = project()
  const { root, write, read } = made
  const phase = 'plan/phases/phase-5-five'
  rmSync(join(root, 'plan/phases/phase-5-five.md'))
  write(
    `${phase}/README.md`,
    '[← Development plan](../../README.md)\n\n# Phase 5 — Five (1 SP)\n\n**Status:** ⬜ Not started · **Work log:** [log](./log.md)\n\nThe fifth phase.\n\n<!-- phase-tasks:start -->\n<!-- phase-tasks:end -->\n\nTask status: ⬜ not started · 🟡 in progress · ✅ done.\n\n**Exit criteria:** every task is done.\n\n## Implementation log\n\nPrinted from the merged pull requests.\n'
  )
  write(`${phase}/log.md`, '[← Phase 5 — Five](./README.md)\n\n# Phase 5 log\n')
  write(
    `${phase}/5.1.md`,
    '[← Phase 5 — Five](./README.md)\n\n# 5.1 — First\n\n**Status:** ⬜ · **Agent:** C1 · **Size:** 1 SP\n\nThe first task.\n'
  )
  write(
    'plan/backlog/B-1.md',
    '[← Backlog](./README.md)\n\n# B-1 — A switch\n\n**Status:** Proposed · **Size:** 5 SP · **Area:** procedures · **Source:** report — [GitHub issue 65](https://h/issues/65) · **Formerly:** I-6\n\nA switch for the probes, see [the first task](../phases/phase-5-five/5.1.md).\n'
  )
  planSummary({ root, profile: made.profile })
  return { ...made, phase, read }
}

test('promoting an item makes the next task of the phase, sets the item to promoted, moves it to the archive and updates the size and the indexes', () => {
  const { root, profile, phase, read } = promotionProject()
  assert.deepEqual(planSummary({ root, profile, check: true }).problems, [])
  const lines = promoteItem({ root, profile, id: 'B-1', phase: 5, agent: 'C2', approved: true })
  assert.equal(
    lines[0],
    'Promoted B-1 to task 5.2 of Phase 5 (5 SP, C2); the item moved to plan/backlog/archived/B-1.md.'
  )
  assert.deepEqual(lines.slice(1), [], lines.join('\n'))

  const task = read(`${phase}/5.2.md`)
  assert.match(
    task,
    /^\[← Phase 5 — Five\]\(\.\/README\.md\)\n\n# 5\.2 — A switch\n\n\*\*Status:\*\* ⬜ · \*\*Agent:\*\* C2 · \*\*Size:\*\* 5 SP\n/
  )
  assert.match(
    task,
    /Promoted from the backlog item \[B-1\]\(\.\.\/\.\.\/backlog\/archived\/B-1\.md\), whose source is report — \[GitHub issue 65\]\(https:\/\/h\/issues\/65\)\./
  )
  assert.match(
    task,
    /A switch for the probes, see \[the first task\]\(\.\/5\.1\.md\)\./,
    'the links of the body follow the move'
  )
  assert.ok(!existsSync(join(root, 'plan/backlog/B-1.md')))
  const item = read('plan/backlog/archived/B-1.md')
  assert.match(item, /\*\*Status:\*\* Promoted · \*\*Promoted to:\*\* 5\.2 · \*\*Size:\*\* 5 SP/)
  assert.match(
    read('plan/backlog/archived/README.md'),
    /\| \[B-1\]\(\.\/B-1\.md\) \| A switch \| procedures \| 5\.2 \| report — /
  )
  assert.doesNotMatch(read('plan/backlog/README.md'), /B-1/)
  assert.match(read(`${phase}/README.md`), /# Phase 5 — Five \(6 SP\)/)
  assert.match(read(`${phase}/README.md`), /\| \[5\.2\]\(\.\/5\.2\.md\) \| A switch \| C2 \| 5 \| ⬜ \|/)
  assert.deepEqual(planSummary({ root, profile, check: true }).problems, [])
  // The task is plan work now; the item cannot be promoted twice
  assert.throws(
    () => promoteItem({ root, profile, id: 'B-1', phase: 5, agent: 'C2', approved: true }),
    /B-1 was promoted already \(to task 5\.2\)/
  )
})

test('a promotion needs the owner’s approval, an existing item and phase, a marker and a size', () => {
  const { root, profile, phase, read } = promotionProject()
  const before = read(`${phase}/README.md`)
  const promote = (options) => () => promoteItem({ root, profile, id: 'B-1', phase: 5, approved: true, ...options })
  assert.throws(promote({ approved: false }), /the owner’s decision: ask, then run the command again with --approved/)
  assert.throws(promote({ id: 'B-9' }), /the backlog has no open item B-9; it has B-1, B-2/)
  assert.throws(promote({ phase: 9 }), /has no folder for Phase 9/)
  assert.throws(promote({}), /a task needs an agent marker \(C1, C2\)/)
  assert.throws(promote({ agent: 'C9' }), /the marker C9 is not on the scale/)
  assert.throws(promote({ agent: 'C1', id: 'B-2' }), /a task needs a size in story points/)
  assert.throws(promote({ agent: 'C1', size: 0 }), /a task needs a size/)
  assert.equal(read(`${phase}/README.md`), before, 'a refused promotion changes nothing')
  assert.ok(existsSync(join(root, 'plan/backlog/B-1.md')) && !existsSync(join(root, `${phase}/5.2.md`)))

  const sized = promoteItem({ root, profile, id: 'B-2', phase: 5, agent: 'C1', size: 2, approved: true })
  assert.match(
    sized[0],
    /Promoted B-2 to task 5\.2 of Phase 5 \(2 SP, C1\)/,
    'the size and the marker may come from the owner'
  )
})

test('`harness plan promote` takes the phase, the marker and the size as flags, and is refused without --approved', async () => {
  const { root, profile, write, phase } = promotionProject()
  write('harness-profile.json', JSON.stringify(profile))
  const lines = []
  const io = { out: (line) => lines.push(line), err: (line) => lines.push(line) }
  const refused = await run(['plan', 'promote', 'B-1', '--phase', '5', '--agent', 'C2', '--root', root], io)
  assert.notEqual(refused.valueOf(), 0)
  assert.match(lines.join('\n'), /with --approved/)
  assert.ok(!existsSync(join(root, `${phase}/5.2.md`)))

  lines.length = 0
  const code = await run(['plan', 'promote', 'B-1', '--phase', '5', '--agent', 'C2', '--approved', '--root', root], io)
  assert.equal(code, 0, lines.join('\n'))
  assert.match(lines.join('\n'), /Promoted B-1 to task 5\.2 of Phase 5 \(5 SP, C2\)/)
  assert.ok(existsSync(join(root, `${phase}/5.2.md`)))
})
