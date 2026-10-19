import assert from 'node:assert/strict'
import { test } from 'node:test'
import { implementationLog, implementationRows } from './plan-log-lib.mjs'

const REPO = 'https://github.com/o/r'

const COMMITS = [
  {
    subject: 'feat(x): third (#12)',
    body: 'Details\n\nPlan: 15.10\nCo-Authored-By: A',
    date: '2026-10-21T10:00:00+03:00'
  },
  { subject: 'docs: other phase (#11)', body: 'Plan: 14.2', date: '2026-10-20T10:00:00+03:00' },
  { subject: 'fix: two tasks (#10)', body: 'Plan: 15.4, 15.9\nPlan: 15.4', date: '2026-10-19T10:00:00+03:00' },
  { subject: 'chore: no pull request number', body: 'Plan: 15.1', date: '2026-10-18T10:00:00+03:00' },
  { subject: 'docs: no plan line (#9)', body: 'Just text', date: '2026-10-17T10:00:00+03:00' },
  { subject: 'docs: first | pipe (#8)', body: 'Plan: 15.2', date: '2026-10-16T10:00:00+03:00' }
]

test('rows of a phase come oldest first, with their tasks sorted numerically and without repeats', () => {
  assert.deepEqual(implementationRows(COMMITS, '15'), [
    { tasks: ['15.2'], pr: '8', title: 'docs: first | pipe', date: '2026-10-16' },
    { tasks: ['15.4', '15.9'], pr: '10', title: 'fix: two tasks', date: '2026-10-19' },
    { tasks: ['15.10'], pr: '12', title: 'feat(x): third', date: '2026-10-21' }
  ])
})

test('another phase has its own rows, and a phase with none has none', () => {
  assert.deepEqual(implementationRows(COMMITS, '14'), [
    { tasks: ['14.2'], pr: '11', title: 'docs: other phase', date: '2026-10-20' }
  ])
  assert.deepEqual(implementationRows(COMMITS, '1'), [])
})

test('the table links the pull requests and escapes a pipe in a title', () => {
  const table = implementationLog(implementationRows(COMMITS, '15').slice(0, 1), REPO)
  assert.equal(
    table,
    '| Tasks | PR | Change | Merged |\n| ----- | -- | ------ | ------ |\n| 15.2 | [#8](https://github.com/o/r/pull/8) | docs: first \\| pipe | 2026-10-16 |'
  )
})
