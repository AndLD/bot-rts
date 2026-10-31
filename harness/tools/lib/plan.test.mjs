import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CONTENTS_END,
  CONTENTS_START,
  SUMMARY_END,
  SUMMARY_START,
  contentsList,
  parsePhase,
  phaseProblems,
  renderIndex,
  summaryTable
} from './plan.mjs'

const phaseFile = (number, theme, size, status, rows, note = '') =>
  `[← Index](../DEVELOPMENT-PLAN.md)\n\n# Phase ${number} — ${theme} (${size} SP${note})\n\n**Status:** ${status} · **Work log:** x\n\n` +
  '| # | Task | SP | Status |\n| --- | --- | --- | --- |\n' +
  rows.map(([id, points, mark]) => `| ${id} | text | ${points} | ${mark} |`).join('\n') +
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
