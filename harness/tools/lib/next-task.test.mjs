import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nextTask, orderOfDevelopment, phaseSequence, readPhases } from './next-task.mjs'

const phase = (number, { status = '⬜', order, rows }) => ({
  file: `plan/phases/phase-${number}-x.md`,
  text: [
    `# Phase ${number} — X`,
    '',
    `**Status:** ${status} In progress`,
    ...(order ? ['', `**Execution order:** ${order}`] : []),
    '',
    '| #   | Task | Agent | SP  | Status |',
    '| --- | ---- | ----- | --- | ------ |',
    ...rows.map(([id, title, mark]) => `| ${id} | **${title}**: details | C1 | 1 | ${mark} |`)
  ].join('\n')
})

const INDEX = [
  '# Plan',
  '',
  '**Order of development** (decided on a date). Releases group the tasks:',
  '',
  '| Release | Tasks, in order | The first consumer |',
  '| ------- | --------------- | ------------------ |',
  '| `0.1.1` | 3.6, 3.7 | takes it |',
  '| `0.1.2` | 3.17, 3.1 (a note), then 3.2 | skips it |',
  '| `0.2.0` | 3.5, then Phase 4 | takes it |',
  '',
  '---',
  '',
  'Later text about 3.99.'
].join('\n')

test('the phases are read from their files: tasks with their titles and marks, the execution order line, the status', () => {
  const [one] = readPhases([
    phase(1, {
      status: '🟡',
      order: 'the plan index says',
      rows: [
        ['1.1', 'First', '✅'],
        ['1.2a', 'Second', '⬜']
      ]
    })
  ])
  assert.deepEqual(
    [one.number, one.status, one.points, one.tasks],
    [
      1,
      '🟡',
      true,
      [
        { id: '1.1', title: 'First', status: '✅' },
        { id: '1.2a', title: 'Second', status: '⬜' }
      ]
    ]
  )
})

test('a phase is in the order of its Execution order line, then its table; a line that sends to the plan index leaves the table order', () => {
  const rows = [
    ['1.1', 'A', '⬜'],
    ['1.2', 'B', '⬜'],
    ['1.3', 'C', '⬜']
  ]
  const sequence = (order) => phaseSequence(readPhases([phase(1, { order, rows })])[0])
  assert.deepEqual(sequence(undefined), ['1.1', '1.2', '1.3'])
  assert.deepEqual(sequence('1.3, then 1.1 (because of the data); 1.9 does not exist'), ['1.3', '1.1', '1.2'])
  assert.deepEqual(sequence('when the order of development in the plan index says'), ['1.1', '1.2', '1.3'])
  assert.deepEqual(sequence('as the reason says, nothing named'), ['1.1', '1.2', '1.3'])
})

test('the order of development counts the tasks column only, not versions, and expands "Phase N"', () => {
  assert.deepEqual(orderOfDevelopment(INDEX), ['3.6', '3.7', '3.17', '3.1', '3.2', '3.5', { phase: 4 }])
  assert.deepEqual(orderOfDevelopment('# Plan\n\nNo order here: 1.2 and 1.3.'), [])
})

test('with an order of development the next task is the first one in it that is not started, whatever the table says', () => {
  const phases = readPhases([
    phase(3, {
      order: 'not the order of the table: the plan index says',
      rows: [
        ['3.1', 'One', '⬜'],
        ['3.2', 'Two', '⬜'],
        ['3.5', 'Five', '⬜'],
        ['3.6', 'Six', '✅'],
        ['3.7', 'Seven', '🟡'],
        ['3.17', 'Seventeen', '⬜']
      ]
    }),
    phase(4, { rows: [['4.1', 'Four one', '⬜']] })
  ])
  assert.deepEqual(nextTask({ phases, indexText: INDEX }), {
    id: '3.17',
    title: 'Seventeen',
    file: 'plan/phases/phase-3-x.md',
    source: 'order of development'
  })
  phases[0].tasks.find((task) => task.id === '3.17').status = '✅'
  assert.equal(nextTask({ phases, indexText: INDEX }).id, '3.1')
  for (const id of ['3.1', '3.2', '3.5']) {
    phases[0].tasks.find((task) => task.id === id).status = '✅'
  }
  assert.equal(nextTask({ phases, indexText: INDEX }).id, '4.1', '"Phase 4" opens its tasks')
})

test('without an order of development the next task is in the execution order of the first phase that has one, else in the table', () => {
  const phases = readPhases([
    phase(1, { status: '✅', rows: [['1.1', 'Done', '✅']] }),
    phase(2, {
      order: '2.3, 2.1, 2.2',
      rows: [
        ['2.1', 'A', '⬜'],
        ['2.2', 'B', '⬜'],
        ['2.3', 'C', '⬜']
      ]
    })
  ])
  assert.deepEqual(nextTask({ phases }), {
    id: '2.3',
    title: 'C',
    file: 'plan/phases/phase-2-x.md',
    source: 'execution order'
  })
  const plain = readPhases([
    phase(1, {
      rows: [
        ['1.1', 'A', '✅'],
        ['1.2', 'B', '⬜']
      ]
    })
  ])
  assert.equal(nextTask({ phases: plain }).source, 'table')
  assert.equal(nextTask({ phases: plain }).id, '1.2')
})

test('a task the order does not name still comes after the ones it names, and a finished plan has no next task', () => {
  const phases = readPhases([
    phase(3, {
      rows: [
        ['3.6', 'Six', '✅'],
        ['3.40', 'Unnamed', '⬜']
      ]
    })
  ])
  assert.equal(nextTask({ phases, indexText: INDEX }).id, '3.40')
  phases[0].tasks[1].status = '✅'
  assert.equal(nextTask({ phases, indexText: INDEX }), null)
  assert.equal(nextTask({ phases: [] }), null)
})
