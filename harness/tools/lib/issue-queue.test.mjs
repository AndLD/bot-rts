// The issue queue (task 3.13): issue files, the two indexes, the archive of the issues that are done, the line in the plan index, the check that an order names
// only ids that exist, and the migration of the open-ended phase.
import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import migration from '../../migrations/0.2.0.mjs'
import { convertOpenEndedPhase, profileWithQueue } from './issue-migration.mjs'
import {
  archiveTable,
  nextIssueNumber,
  openTable,
  parseIssueFile,
  queueProblems,
  queueSummary,
  readQueue
} from './issue-queue.mjs'
import { planSummary } from './plan.mjs'

const dirs = []
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))
const FRAMEWORK = new URL('../..', import.meta.url).pathname

const issueFile = (
  id,
  title,
  { status = '⬜', agent = 'C1', size = 2, area = 'Git rules', reported = '[#7](https://h/7)', formerly, log } = {}
) =>
  `[← Issue queue](./README.md)\n\n# ${id} — ${title}\n\n**Status:** ${status} · **Agent:** ${agent} · **Size:** ${size} SP · **Area:** ${area} · **Reported:** ${reported}` +
  `${formerly ? ` · **Formerly:** ${formerly}` : ''}${log ? ` · **Log:** [${id}.log.md](./${log})` : ''}\n\nWhat ${id} is.\n`

test('an issue file is read for its area, reports, old id, marker, size and log, and a malformed one names its problems', () => {
  const issue = parseIssueFile(
    'I-3.md',
    issueFile('I-3', 'Third', {
      formerly: '12.5',
      log: 'I-3.log.md',
      status: '🟡',
      reported: '[#7](https://h/7), [#9](https://h/9)'
    })
  )
  assert.deepEqual(
    {
      id: issue.id,
      title: issue.title,
      status: issue.status,
      agent: issue.agent,
      points: issue.points,
      area: issue.area,
      reported: issue.reported,
      formerly: issue.formerly,
      log: issue.log
    },
    {
      id: 'I-3',
      title: 'Third',
      status: '🟡',
      agent: 'C1',
      points: 2,
      area: 'Git rules',
      reported: '[#7](https://h/7), [#9](https://h/9)',
      formerly: '12.5',
      log: './I-3.log.md'
    }
  )
  assert.deepEqual(issue.problems, [])
  const bad = parseIssueFile('I-4.md', '# I-5 — Other\n\nNo status line.\n')
  assert.equal(bad.problems.length, 5)
  assert.match(bad.problems.join('\n'), /names issue I-5, but the file is named for another/)
  assert.match(bad.problems.join('\n'), /\*\*Area:\*\*/)
  assert.match(bad.problems.join('\n'), /\*\*Reported:\*\*/)
})

function project() {
  const root = mkdtempSync(join(tmpdir(), 'issue-queue-'))
  dirs.push(root)
  const write = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  const read = (path) => readFileSync(join(root, path), 'utf8')
  const profile = {
    paths: { phases: 'plan/phases', planIndex: 'plan/README.md', issues: 'plan/issues', frameworkDir: '.' },
    plan: { complexity: { scale: { C1: 'a', C2: 'b' } } }
  }
  write('migrations/areas.json', JSON.stringify({ areas: { 'Git rules': [], 'plan format': [] } }))
  write(
    'plan/README.md',
    '# Plan\n\n<!-- plan-summary:start -->\n<!-- plan-summary:end -->\n\n<!-- plan-issues:start -->\n<!-- plan-issues:end -->\n\n**Order of development**\n\n| Release | Tasks, in order |\n| - | - |\n| `1.0.0` | 5.1, I-1 |\n\n---\n\n<!-- plan-contents:start -->\n<!-- plan-contents:end -->\n'
  )
  write(
    'plan/phases/phase-5-five.md',
    '# Phase 5 — Five (1 SP)\n\n**Status:** ✅ Done\n\n**Execution order:** 5.1.\n\n| # | Task | Agent | SP | Status |\n| - | - | - | - | - |\n| 5.1 | x | C1 | 1 | ✅ |\n'
  )
  write('plan/issues/README.md', '# Issue queue\n\n<!-- issue-queue:start -->\n<!-- issue-queue:end -->\n')
  write('plan/issues/archived/README.md', '# Archived\n\n<!-- issue-queue:start -->\n<!-- issue-queue:end -->\n')
  write('plan/issues/I-1.md', issueFile('I-1', 'First', { log: 'I-1.log.md' }))
  write('plan/issues/I-1.log.md', '[← I-1 — First](./I-1.md)\n\n# I-1 log\n')
  write('plan/issues/I-2.md', issueFile('I-2', 'Second', { agent: 'C2', area: 'plan format', size: 3, reported: '—' }))
  write(
    'docs/note.md',
    'See [the issue](../plan/issues/I-1.md#x) and [its log](../plan/issues/I-1.log.md), and `plan/issues/I-1.md`.\n'
  )
  return { root, profile, write, read }
}

test('plan summary writes the open index, shows the queue in the plan index apart from the phases, and check holds it', () => {
  const { root, profile, read } = project()
  assert.match(
    planSummary({ root, profile, check: true }).problems.join('\n'),
    /the issue table disagrees with the issue files/
  )
  assert.deepEqual(planSummary({ root, profile }).problems, [])
  const index = read('plan/issues/README.md')
  assert.match(index, /\| \[I-1\]\(\.\/I-1\.md\) \| First \| Git rules \| C1 \| 2 \| ⬜ \| \[#7\]\(https:\/\/h\/7\) \|/)
  assert.match(index, /\| \[I-2\]\(\.\/I-2\.md\) \| Second \| plan format \| C2 \| 3 \| ⬜ \| — \|/)
  assert.match(
    read('plan/README.md'),
    /\*\*Issue queue\*\* \(not a phase; its size is not in the totals above\): \[2 open\]\(\.\/issues\/README\.md\), 5 SP; 0 archived\./
  )
  assert.match(read('plan/README.md'), /\| 5 \| Five \| 1 \| C1 \| ✅ Done \|/)
  assert.deepEqual(planSummary({ root, profile, check: true }).problems, [])
})

test('an issue that is done is archived with its log, every link to them follows, and both indexes list it', () => {
  const { root, profile, write, read } = project()
  planSummary({ root, profile })
  write('plan/issues/I-1.md', issueFile('I-1', 'First', { status: '✅', log: 'I-1.log.md' }))
  assert.match(
    planSummary({ root, profile, check: true }).problems.join('\n'),
    /I-1\.md: the issue is done and not archived/
  )

  planSummary({ root, profile })
  assert.ok(!existsSync(join(root, 'plan/issues/I-1.md')) && !existsSync(join(root, 'plan/issues/I-1.log.md')))
  assert.match(read('plan/issues/archived/I-1.md'), /^\[← Archived issues\]\(\.\/README\.md\)/)
  assert.match(read('plan/issues/archived/I-1.log.md'), /^\[← I-1 — First\]\(\.\/I-1\.md\)/)
  assert.equal(
    read('docs/note.md'),
    'See [the issue](../plan/issues/archived/I-1.md#x) and [its log](../plan/issues/archived/I-1.log.md), and `plan/issues/archived/I-1.md`.\n'
  )
  assert.doesNotMatch(read('plan/issues/README.md'), /I-1/)
  assert.match(
    read('plan/issues/archived/README.md'),
    /\| \[I-1\]\(\.\/I-1\.md\) \| First \| Git rules \| 2 \| \[#7\]\(https:\/\/h\/7\) \|/
  )
  assert.match(read('plan/README.md'), /\[1 open\]\(\.\/issues\/README\.md\), 3 SP; 1 archived\./)
  assert.deepEqual(planSummary({ root, profile, check: true }).problems, [])
})

test('the check of a queue names an area off the list, a marker off the scale, a missing log, a duplicate id and a stale table', () => {
  const { root, profile, write } = project()
  planSummary({ root, profile })
  write('plan/issues/I-2.md', issueFile('I-2', 'Second', { agent: 'C9', area: 'Made up', log: 'gone.md' }))
  write('plan/issues/archived/I-1.md', issueFile('I-1', 'Again', { status: '⬜' }))
  const problems = planSummary({ root, profile, check: true }).problems.join('\n')
  assert.match(
    problems,
    /the area "Made up" is not an area of the migration notes \(Git rules, plan format\), nor Unclassified/
  )
  assert.match(problems, /I-2\.md: the marker C9 is not on the scale \(C1, C2\)/)
  assert.match(problems, /I-2\.md: the log \.\/gone\.md does not exist/)
  assert.match(problems, /the id I-1 is used twice/)
  assert.match(problems, /archived\/I-1\.md: an archived issue must be done/)
  assert.match(problems, /the table disagrees with the archived issues/)
})

test('an order of development or an execution order may name only ids that exist: tasks, issues, and the old id of a task that moved', () => {
  const { root, profile, write, read } = project()
  planSummary({ root, profile })
  assert.deepEqual(planSummary({ root, profile, check: true }).problems, [])

  const index = read('plan/README.md')
  write('plan/README.md', index.replace('5.1, I-1', '5.1, 5.9, I-1, I-7'))
  const named = planSummary({ root, profile, check: true }).problems.join('\n')
  assert.match(named, /the order of development names task 5\.9, which exists in no phase/)
  assert.match(named, /names task I-7/)

  // 5.9 moved to the queue and keeps its old id there
  write('plan/issues/I-3.md', issueFile('I-3', 'Moved', { formerly: '5.9' }))
  write('plan/README.md', index.replace('5.1, I-1', '5.1, 5.9, I-1, I-3'))
  planSummary({ root, profile })
  assert.deepEqual(planSummary({ root, profile, check: true }).problems, [])

  write(
    'plan/phases/phase-5-five.md',
    read('plan/phases/phase-5-five.md').replace('**Execution order:** 5.1.', '**Execution order:** 5.1, then 5.8.')
  )
  assert.match(
    planSummary({ root, profile, check: true }).problems.join('\n'),
    /phase-5-five\.md: the execution order names task 5\.8/
  )
})

test('the numbers, tables and summary line of a queue', () => {
  const queue = {
    dir: 'q',
    open: [parseIssueFile('I-2.md', issueFile('I-2', 'B', { status: '🟡', size: 3 }))],
    archived: [parseIssueFile('I-9.md', issueFile('I-9', 'A', { status: '✅' }))]
  }
  assert.equal(nextIssueNumber(queue), 10, 'above every open and archived issue')
  assert.equal(nextIssueNumber({ open: [], archived: [] }), 1)
  assert.match(openTable(queue.open, { marked: false }), /^\| Issue \| Title \| Area \| SP \| Status \| Reported \|/)
  assert.match(archiveTable(queue.archived), /\| \[I-9\]\(\.\/I-9\.md\) \| A \|/)
  assert.equal(
    queueSummary(queue, './q/README.md'),
    '**Issue queue** (not a phase; its size is not in the totals above): [1 open](./q/README.md), 3 SP, 1 in progress; 1 archived.'
  )
  assert.deepEqual(
    queueProblems(
      { ...queue, readme: 'x', archiveReadme: null, names: [], archiveNames: [] },
      { exists: () => true }
    ).filter((p) => /table must sit/.test(p)).length,
    1
  )
  assert.equal(
    readQueue({ dir: 'q', list: () => [], readText: () => '' }),
    null,
    'a folder without an index is no queue'
  )
})

const OLD_PROFILE = `{
  "paths": {
    "plan": "plan",
    "phases": "plan/phases",
    "planIndex": "plan/README.md",
    "changelog": "CHANGELOG.md"
  },
  "plan": {
    "taskId": "x",
    "complexity": { "scale": { "C1": "a", "C2": "b" } },
    "openEndedPhase": "Phase 5 (issues found in use); its size grows",
    "openEndedPhaseNumber": 5
  }
}
`

test('the profile file loses the roles of the open-ended phase and gains the queue path, with its formatting', () => {
  const next = profileWithQueue(OLD_PROFILE, 'plan/issues')
  assert.deepEqual(JSON.parse(next), {
    paths: {
      plan: 'plan',
      phases: 'plan/phases',
      planIndex: 'plan/README.md',
      issues: 'plan/issues',
      changelog: 'CHANGELOG.md'
    },
    plan: { taskId: 'x', complexity: { scale: { C1: 'a', C2: 'b' } } }
  })
  assert.match(next, /"scale": \{ "C1": "a", "C2": "b" \} \}\n  \}/, 'no comma is left before the closing brace')
  assert.equal(profileWithQueue(next, 'plan/issues'), next, 'run twice, it changes nothing')
  assert.equal(profileWithQueue('{ not json', 'q'), null)
})

function oldProject() {
  const { root, write, read } = project()
  rmSync(join(root, 'plan/issues'), { recursive: true })
  rmSync(join(root, 'plan/phases/phase-5-five.md'))
  cpSync(join(FRAMEWORK, 'core/templates'), join(root, 'core/templates'), { recursive: true })
  write('harness-profile.json', OLD_PROFILE)
  write(
    'plan/README.md',
    '# Plan\n\n<!-- plan-summary:start -->\n<!-- plan-summary:end -->\n\n**Order of development**\n\n| Release | Tasks, in order |\n| - | - |\n| `1.0.0` | 5.3 |\n\n---\n\n<!-- plan-contents:start -->\n<!-- plan-contents:end -->\n'
  )
  write(
    'plan/phases/phase-5-issues.md',
    '[← Plan](../README.md)\n\n# Phase 5 — Issues and stabilization (11 SP, grows as issues are added)\n\n**Status:** 🟡 In progress · **Work log:** x\n\nThe open-ended phase: a defect or an improvement found in use becomes a task of this phase, and its size\ngrows with its tasks.\n\n| # | Task | Agent | SP | Status |\n| - | ---- | ----- | -- | ------ |\n| 5.1 | **Done defect**: fixed. | C1 | 1 | ✅ |\n| 5.2 | **Defect under way**: in progress. | C1 | 2 | 🟡 |\n| 5.3 | **Planned improvement**: named by the order. | C2 | 3 | ⬜ |\n| 5.4 | **Not started defect**: see [the plan](../README.md). | C1 | 2 | ⬜ |\n| 5.5 | **Another one**: x. | C2 | 3 | ⬜ |\n\nTask status: ⬜ not started.\n\n**Exit criteria:** none; the phase stays open.\n\n## Implementation log\n\n| Tasks | PR | Change | Merged |\n| ----- | -- | ------ | ------ |\n| 5.1 | #9 | The defect | 2026-11-01 |\n'
  )
  const profile = {
    paths: {
      phases: 'plan/phases',
      planIndex: 'plan/README.md',
      issues: 'plan/issues',
      profileFile: 'harness-profile.json',
      frameworkDir: '.'
    },
    plan: { openEndedPhaseNumber: 5, complexity: { scale: { C1: 'a', C2: 'b' } } }
  }
  return { root, profile, write, read }
}

test('the open-ended phase becomes a normal phase that keeps its ids; only its defects that have not started become issues, under their old ids', async () => {
  const { root, profile, read } = oldProject()
  const messages = await migration({ root, profile })
  assert.match(messages.join('\n'), /Moved to the issue queue plan\/issues: 5\.4 became I-1, 5\.5 became I-2/)

  const folder = 'plan/phases/phase-5-issues'
  const readme = read(`${folder}/README.md`)
  assert.match(readme, /^# Phase 5 — Issues and stabilization \(6 SP\)$/m)
  assert.match(readme, /\*\*Status:\*\* 🟡 In progress/)
  assert.match(
    readme,
    /Stabilization work that was planned or under way when the issue queue replaced the open-ended phase/
  )
  assert.match(readme, /\*\*Exit criteria:\*\* the tasks of this phase are done \(5\.1, 5\.2, 5\.3\)\./)
  for (const id of ['5.1', '5.2', '5.3'])
    assert.ok(existsSync(join(root, `${folder}/${id}.md`)), `${id} keeps its place`)
  assert.ok(!existsSync(join(root, `${folder}/5.4.md`)) && !existsSync(join(root, `${folder}/5.5.md`)))

  const first = read('plan/issues/I-1.md')
  assert.match(
    first,
    /^\[← Issue queue\]\(\.\/README\.md\)\n\n# I-1 — Not started defect\n\n\*\*Status:\*\* ⬜ · \*\*Agent:\*\* C1 · \*\*Size:\*\* 2 SP · \*\*Area:\*\* Unclassified · \*\*Reported:\*\* — · \*\*Formerly:\*\* 5\.4\n/
  )
  assert.match(first, /\[the plan\]\(\.\.\/README\.md\)/, 'a link in the text is made right for the queue folder')
  assert.match(read('plan/issues/I-2.md'), /\*\*Formerly:\*\* 5\.5/)
  assert.match(
    read('plan/issues/README.md'),
    /\| \[I-1\]\(\.\/I-1\.md\) \| Not started defect \| Unclassified \| C1 \| 2 \| ⬜ \| — \|/
  )
  assert.match(read('plan/README.md'), /\*\*Issue queue\*\*.*\[2 open\]\(\.\/issues\/README\.md\), 5 SP/)

  const profileFile = JSON.parse(read('harness-profile.json'))
  assert.equal(profileFile.plan.openEndedPhaseNumber, undefined)
  assert.equal(profileFile.plan.openEndedPhase, undefined)
  assert.equal(profileFile.paths.issues, 'plan/issues')

  assert.deepEqual(
    planSummary({ root, profile: { ...profile, plan: { complexity: profile.plan.complexity } }, check: true }).problems,
    []
  )
  const before = read(`${folder}/README.md`)
  assert.deepEqual(
    await migration({ root, profile: { ...profile, plan: { complexity: profile.plan.complexity } } }),
    [],
    'a second run changes nothing'
  )
  assert.equal(read(`${folder}/README.md`), before)
})

test('convertOpenEndedPhase has nothing to do for a profile without the open-ended phase', () => {
  const { root, profile } = oldProject()
  assert.deepEqual(convertOpenEndedPhase({ root, profile: { ...profile, plan: {} } }), [])
})
