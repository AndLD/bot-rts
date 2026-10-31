import assert from 'node:assert/strict'
import { test } from 'node:test'
import { openItemProblems as check, registerRows } from './open-items.mjs'

// The file names of a fictitious project, as its profile file would give them
const OPTIONS = { register: '20-open-questions.md', backlog: '21-backlog.md', backlogSection: '21' }
const openItemProblems = (files) => check(files, OPTIONS)

const REGISTER = [
  '| Id | Question | Kind | Section | Blocks | Owner |',
  '| --- | --- | --- | --- | --- | --- |',
  '| Q1 | A question | needs a decision | §9.3 | none | owner |'
].join('\n')

const files = (extra = {}) => ({ '20-open-questions.md': REGISTER, '21-backlog.md': '- Later: terrain.', ...extra })

test('registerRows reads the rows of the register and ignores the header and code blocks', () => {
  assert.deepEqual(registerRows(`${REGISTER}\n\`\`\`\n| Q2 | x | y | z | w | v |\n\`\`\``), [
    ['Q1', 'A question', 'needs a decision', '§9.3', 'none', 'owner']
  ])
})

test('a design with decided rules, registered ids and backlog references has no problems', () => {
  assert.deepEqual(
    openItemProblems(
      files({
        '09-a.md':
          'The costs are initial values (Q1).\nA leaderboard is out of scope for now (backlog, §21).\nAll decided.'
      })
    ),
    []
  )
})

test('a build-status marker is a problem, also in a table cell', () => {
  const problems = openItemProblems(files({ '07-a.md': '| Scanner | ✅ |\n- 🟡 partial\n- 🔴 planned' }))
  assert.equal(problems.length, 3)
  assert.match(problems[0], /07-a\.md:1: a build-status marker/)
})

test('a marker word without an open-item id or a backlog entry is a problem', () => {
  for (const word of ['TODO', 'TBD', 'To be decided', 'not yet', 'for now', 'to be revisited', 'Known gap']) {
    const problems = openItemProblems(files({ '10-a.md': `ok\nThis is ${word} here.` }))
    assert.equal(problems.length, 1, word)
    assert.match(problems[0], /10-a\.md:2: a marker word/)
  }
})

test('marker words inside a code block are not scanned', () => {
  assert.deepEqual(openItemProblems(files({ '18-a.md': '```js\n// TODO for now\n```' })), [])
})

test('a cited id that is not in the register is a problem', () => {
  const problems = openItemProblems(files({ '12-a.md': 'Open (Q7).' }))
  assert.deepEqual(problems, ['12-a.md:1: Q7 is not registered in 20-open-questions.md'])
})

test('a register row must fill all columns and ids are unique', () => {
  const register = `${REGISTER}\n| Q1 | A twin | needs a decision | §1 | none | owner |\n| Q2 | No owner | needs a decision | §1 | none |  |`
  const problems = openItemProblems({ '20-open-questions.md': register })
  assert.deepEqual(problems, [
    '20-open-questions.md: id Q1 is registered twice',
    '20-open-questions.md: Q2 must fill all 6 columns (id, question, kind, section, blocks, owner)'
  ])
})

test('a missing register is a problem', () => {
  assert.deepEqual(openItemProblems({ '09-a.md': 'text' }), [
    '20-open-questions.md: the open-items register is missing'
  ])
})
