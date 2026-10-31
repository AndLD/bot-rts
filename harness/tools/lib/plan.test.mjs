import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import {
  CONTENTS_END,
  CONTENTS_START,
  SUMMARY_END,
  SUMMARY_START,
  complexityRange,
  contentsList,
  parsePhase,
  phaseProblems,
  planSummary,
  renderIndex,
  summaryTable
} from './plan.mjs'

const phaseFile = (number, theme, size, status, rows, note = '') =>
  `[← Index](../DEVELOPMENT-PLAN.md)\n\n# Phase ${number} — ${theme} (${size} SP${note})\n\n**Status:** ${status} · **Work log:** x\n\n` +
  '| # | Task | SP | Status |\n| --- | --- | --- | --- |\n' +
  rows
    .map(([id, points, mark, marker]) => `| ${id} | text | ${marker ? `${marker} | ` : ''}${points} | ${mark} |`)
    .join('\n') +
  '\n'

const ZERO = parsePhase(
  'phase-0-a.md',
  phaseFile(0, 'Start', 8, '✅ Done', [
    ['0.1', 3, '✅'],
    ['0.2', 5, '✅']
  ])
)
const TWO = parsePhase(
  'phase-2-b.md',
  phaseFile(2, 'Open ended', 5, '🟡 In progress', [['2.1', 5, '🟡 ']], ', grows as issues are added')
)
const ONE = parsePhase(
  'phase-1-c.md',
  phaseFile(1, 'Middle', 13, '⬜ Not started', [
    ['1.1', 8, '⬜'],
    ['1.1a', 5, '⬜']
  ])
)

test('parsePhase reads the number, theme, size, note, status and the sum of the task sizes', () => {
  assert.deepEqual(
    { number: ZERO.number, theme: ZERO.theme, points: ZERO.points, status: ZERO.status, taskPoints: ZERO.taskPoints },
    { number: 0, theme: 'Start', points: 8, status: '✅ Done', taskPoints: 8 }
  )
  assert.equal(TWO.note, 'grows as issues are added')
  assert.equal(TWO.title, 'Phase 2 — Open ended (5 SP, grows as issues are added)')
  assert.equal(ONE.taskPoints, 13)
})

test('parsePhase names the file when the title or the status line is malformed', () => {
  assert.throws(() => parsePhase('x.md', '# Not a phase\n**Status:** ✅ Done'), /x\.md: the title/)
  assert.throws(() => parsePhase('y.md', '# Phase 1 — A (3 SP)\n\nno status'), /y\.md: the status line/)
})

test('phaseProblems flags a title size that is not the sum of the tasks', () => {
  assert.deepEqual(phaseProblems(ZERO), [])
  const wrong = parsePhase('phase-3-d.md', phaseFile(3, 'Wrong', 10, '✅ Done', [['3.1', 3, '✅']]))
  assert.deepEqual(phaseProblems(wrong), ['phase-3-d.md: the title says 10 SP but the tasks add up to 3 SP'])
})

test('the summary lists the phases in order with their statuses, marks a growing phase and totals the sizes', () => {
  assert.equal(
    summaryTable([TWO, ZERO, ONE]),
    [
      '| Phase | Theme | Story points | Status |',
      '| ----- | ----- | ------------ | ------ |',
      '| 0 | Start | 8 | ✅ Done |',
      '| 1 | Middle | 13 | ⬜ Not started |',
      '| 2 | Open ended | 5 (grows) | 🟡 In progress |',
      '|  | **Total of Phases 0–2** | **26** (Phase 2 grows as issues are added) | |'
    ].join('\n')
  )
})

test('the contents link every phase file with its title', () => {
  assert.equal(
    contentsList([ONE, ZERO]),
    '- [Phase 0 — Start (8 SP)](./phases/phase-0-a.md)\n- [Phase 1 — Middle (13 SP)](./phases/phase-1-c.md)'
  )
})

test('renderIndex rewrites both blocks and leaves the rest alone; a missing block is an error', () => {
  const index = `intro\n${SUMMARY_START}\nold\n${SUMMARY_END}\nmiddle\n${CONTENTS_START}\nold\n${CONTENTS_END}\nend\n`
  const rendered = renderIndex(index, [ZERO])
  assert.match(rendered, /^intro\n/)
  assert.match(rendered, /\| 0 \| Start \| 8 \| ✅ Done \|/)
  assert.match(rendered, /middle\n.*\n- \[Phase 0/s)
  assert.match(rendered, /end\n$/)
  assert.equal(renderIndex(rendered, [ZERO]), rendered)
  assert.throws(() => renderIndex('no blocks', [ZERO]), /no <!-- plan-summary:start -->/)
})

// The agent-complexity markers (design §3.4)
const SCALE = { scale: { C1: 'routine', C2: 'standard', C3: 'judgment' } }
const MARKED = parsePhase(
  'phase-4-e.md',
  phaseFile(4, 'Marked', 12, '🟡 In progress', [
    ['4.1', 3, '✅'],
    ['4.2', 4, '🟡', 'C3'],
    ['4.3', 5, '⬜', 'C1']
  ])
)

test('parsePhase reads the marker before the size, and lists the open tasks without one; a done task is exempt', () => {
  assert.deepEqual(MARKED.markers, ['C3', 'C1'])
  assert.deepEqual(MARKED.unmarked, [])
  assert.equal(MARKED.taskPoints, 12)
  assert.deepEqual(ONE.markers, [])
  assert.deepEqual(ONE.unmarked, ['1.1', '1.1a'])
  assert.deepEqual(ZERO.unmarked, [])
})

test('a done task without a marker passes and an open one fails, once the plan has markers', () => {
  const mixed = parsePhase(
    'phase-5-f.md',
    phaseFile(5, 'Mixed', 6, '🟡 In progress', [
      ['5.1', 3, '✅'],
      ['5.2', 3, '⬜']
    ])
  )
  assert.deepEqual(phaseProblems(mixed, SCALE), [
    'phase-5-f.md: open tasks without an agent-complexity marker (C1, C2, C3): 5.2'
  ])
  assert.deepEqual(phaseProblems(mixed), [])
  assert.deepEqual(phaseProblems(ZERO, SCALE), [])
  assert.deepEqual(phaseProblems(MARKED, SCALE), [])
})

test('a marker that is not on the scale is a problem', () => {
  const odd = parsePhase('phase-6-g.md', phaseFile(6, 'Odd', 3, '⬜ Not started', [['6.1', 3, '⬜', 'C9']]))
  assert.deepEqual(phaseProblems(odd, SCALE), ['phase-6-g.md: markers that are not on the scale (C1, C2, C3): C9'])
})

test('complexityRange shows one level, or the lowest and the highest, in the order of the scale', () => {
  assert.equal(complexityRange(['C2', 'C2'], SCALE), 'C2')
  assert.equal(complexityRange(['C3', 'C1', 'C2'], SCALE), 'C1–C3')
  assert.equal(complexityRange([], SCALE), '—')
  assert.equal(complexityRange(['C1'], undefined), '—')
})

test('the summary gains an Agent complexity column with each range when the plan has markers, and keeps its shape otherwise', () => {
  const table = summaryTable([ZERO, MARKED, ONE], { complexity: SCALE })
  assert.equal(
    table,
    [
      '| Phase | Theme | Story points | Agent complexity | Status |',
      '| ----- | ----- | ------------ | ---------------- | ------ |',
      '| 0 | Start | 8 | — | ✅ Done |',
      '| 1 | Middle | 13 | — | ⬜ Not started |',
      '| 4 | Marked | 12 | C1–C3 | 🟡 In progress |',
      '|  | **Total of Phases 0–4** | **33** | | |'
    ].join('\n')
  )
  assert.equal(summaryTable([ZERO, MARKED, ONE]).split('\n')[0], '| Phase | Theme | Story points | Status |')
})

const root = mkdtempSync(join(tmpdir(), 'harness-plan-'))
after(() => rmSync(root, { recursive: true, force: true }))

test('plan summary and its check on a project: the ranges are written, and an open task without a marker fails the check', () => {
  const phases = 'docs/plan/phases'
  mkdirSync(join(root, phases), { recursive: true })
  const index = `# Plan\n${SUMMARY_START}\n${SUMMARY_END}\n${CONTENTS_START}\n${CONTENTS_END}\n`
  writeFileSync(join(root, 'docs/plan/INDEX.md'), index)
  writeFileSync(
    join(root, phases, 'phase-1-a.md'),
    phaseFile(1, 'First', 8, '🟡 In progress', [
      ['1.1', 3, '✅'],
      ['1.2', 5, '⬜']
    ])
  )
  const profile = { paths: { phases, planIndex: 'docs/plan/INDEX.md' }, plan: { complexity: SCALE } }

  const failing = planSummary({ root, profile, check: true })
  assert.match(failing.problems.join('\n'), /phase-1-a\.md: open tasks without an agent-complexity marker .*: 1\.2/)

  writeFileSync(
    join(root, phases, 'phase-1-a.md'),
    phaseFile(1, 'First', 8, '🟡 In progress', [
      ['1.1', 3, '✅'],
      ['1.2', 5, '⬜', 'C2']
    ])
  )
  assert.deepEqual(planSummary({ root, profile }).problems, [])
  assert.match(
    readFileSync(join(root, 'docs/plan/INDEX.md'), 'utf8'),
    /^\| 1 \| First \| 8 \| C2 \| 🟡 In progress \|$/m
  )
  assert.deepEqual(planSummary({ root, profile, check: true }).problems, [])

  const off = { paths: profile.paths }
  assert.match(planSummary({ root, profile: off, check: true }).problems.join('\n'), /disagree with the phase files/)
})
