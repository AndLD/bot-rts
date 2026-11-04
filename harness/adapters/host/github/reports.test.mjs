import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  closeReport,
  commentReport,
  createReport,
  listReports,
  searchReports,
  showReport,
  slugOfUrl
} from './reports.mjs'

const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' })
const recorder = (answer) => {
  const calls = []
  return { calls, cli: (args, input) => (calls.push({ args, input }), answer(args)) }
}

const raw = (number, title) => ({
  number,
  title,
  url: `https://h/r/issues/${number}`,
  state: 'OPEN',
  body: 'b',
  createdAt: '2026-11-01',
  labels: [{ name: 'bug' }]
})

test('the open reports are listed oldest first, in a shape the tools use', () => {
  const { calls, cli } = recorder(() => ok(JSON.stringify([raw(9, 'Nine'), raw(3, 'Three')])))
  const reports = listReports({ slug: 'o/r', cli })
  assert.deepEqual(
    reports.map((report) => report.number),
    [3, 9]
  )
  assert.deepEqual(reports[0], {
    number: 3,
    title: 'Three',
    url: 'https://h/r/issues/3',
    state: 'open',
    body: 'b',
    createdAt: '2026-11-01',
    labels: ['bug']
  })
  assert.deepEqual(calls[0].args.slice(0, 6), ['issue', 'list', '--repo', 'o/r', '--state', 'open'])
})

test('a search, a view, a new report, a comment and a closing use the gh command line with the body on standard input', () => {
  const search = recorder(() => ok(JSON.stringify([raw(1, 'One')])))
  assert.equal(searchReports({ slug: 'o/r', text: 'the word', cli: search.cli })[0].title, 'One')
  assert.ok(
    search.calls[0].args.includes('--search') &&
      search.calls[0].args.includes('the word') &&
      search.calls[0].args.includes('all')
  )

  const view = recorder(() => ok(JSON.stringify(raw(4, 'Four'))))
  assert.equal(showReport({ slug: 'o/r', number: 4, cli: view.cli }).number, 4)
  assert.deepEqual(view.calls[0].args.slice(0, 3), ['issue', 'view', '4'])

  const create = recorder(() => ok('https://h/r/issues/5\n'))
  assert.equal(createReport({ slug: 'o/r', title: 'T', body: 'the body', cli: create.cli }), 'https://h/r/issues/5')
  assert.equal(create.calls[0].input, 'the body')
  assert.ok(create.calls[0].args.includes('--body-file'))

  const comment = recorder(() => ok())
  commentReport({ slug: 'o/r', number: 4, body: 'thanks', cli: comment.cli })
  assert.deepEqual([comment.calls[0].args.slice(0, 3), comment.calls[0].input], [['issue', 'comment', '4'], 'thanks'])

  const close = recorder(() => ok())
  closeReport({ slug: 'o/r', number: 4, cli: close.cli })
  assert.deepEqual(close.calls[0].args.slice(0, 3), ['issue', 'close', '4'])
})

test('a failure of the command line is an error that says what gh said', () => {
  const cli = () => ({ status: 1, stdout: '', stderr: 'no such repository' })
  assert.throws(() => listReports({ slug: 'o/r', cli }), /gh issue list failed: no such repository/)
})

test('the slug of a repository is read from its web or Git address', () => {
  assert.equal(slugOfUrl('https://github.com/AndLD/harness-framework'), 'AndLD/harness-framework')
  assert.equal(slugOfUrl('https://github.com/AndLD/harness-framework.git'), 'AndLD/harness-framework')
  assert.equal(slugOfUrl('git@github.com:AndLD/harness-framework.git'), 'AndLD/harness-framework')
  assert.equal(slugOfUrl('https://gitlab.com/a/b'), null)
  assert.equal(slugOfUrl(undefined), null)
})
