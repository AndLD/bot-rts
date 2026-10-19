import assert from 'node:assert/strict'
import { test } from 'node:test'
import { productKnowledgeProblems, stackPattern } from './product-knowledge-lib.mjs'

const PROFILE = "```bash\nSTACK='postgres|socket\\.io|\\bnpm\\b|\\btypescript\\b|quickjs'\n```\n"

test('stackPattern reads the term list of the profile, case-insensitively', () => {
  assert.ok(stackPattern(PROFILE).test('Runs on PostgreSQL'))
  assert.ok(!stackPattern(PROFILE).test('A plain sentence'))
  assert.throws(() => stackPattern('no list here'), /no STACK term list/)
})

test('a file with no stack term, plan reference or implementation path has no problems', () => {
  assert.deepEqual(
    productKnowledgeProblems({ 'game-design/04-a.md': 'A cell holds a resource.\nSee §12.' }, PROFILE),
    []
  )
})

test('a stack term is a problem, with its place', () => {
  assert.deepEqual(productKnowledgeProblems({ 'game-design/04-a.md': 'ok\nStored in PostgreSQL.' }, PROFILE), [
    'game-design/04-a.md:2: the stack term "PostgreS" does not belong in the product knowledge'
  ])
})

test('plan task and phase references are problems', () => {
  for (const text of [
    'Plan 5.4 did it',
    'done in task 11.4',
    'tasks 10.11 and 10.15',
    'shipped in Phase 9',
    'delivered (task 9.16)'
  ]) {
    assert.equal(productKnowledgeProblems({ 'game-design/04-a.md': text }, PROFILE).length, 1, text)
  }
})

test('code paths and test files are problems; a path into lib or a link to a document is not', () => {
  for (const text of ['`api/src/engine/x.ts`', 'see client/src/app', 'covered by `x.test.ts`', 'in module-catalog']) {
    assert.equal(productKnowledgeProblems({ 'game-design/04-a.md': text }, PROFILE).length, 1, text)
  }
  assert.deepEqual(
    productKnowledgeProblems({ 'game-design/10-a.md': '[map](../../../lib/utils/interfaces/map.ts)' }, PROFILE),
    []
  )
})

test('a listed term is allowed in its own file only', () => {
  assert.deepEqual(
    productKnowledgeProblems({ 'game-design/10-the-script-api.md': 'Players write TypeScript.' }, PROFILE),
    []
  )
  assert.equal(productKnowledgeProblems({ 'game-design/11-a.md': 'Players write TypeScript.' }, PROFILE).length, 1)
  assert.equal(
    productKnowledgeProblems({ 'game-design/10-the-script-api.md': 'Stored in PostgreSQL.' }, PROFILE).length,
    1
  )
  assert.deepEqual(
    productKnowledgeProblems({ 'integrations/MCP.md': '```bash\nnpm run build -w mcp\n```' }, PROFILE),
    []
  )
})

test('stack words in a code block are not scanned in files that may not show them either', () => {
  assert.deepEqual(productKnowledgeProblems({ 'game-design/04-a.md': '```js\nconst postgres = 1\n```' }, PROFILE), [])
})

test('history, the changelog, the register and the backlog are not scanned', () => {
  const text = 'Phase 9 and PostgreSQL, task 9.1'
  assert.deepEqual(
    productKnowledgeProblems(
      {
        'archived-docs/a.md': text,
        'CHANGELOG.md': text,
        'game-design/20-open-questions.md': text,
        'game-design/21-backlog.md': text
      },
      PROFILE
    ),
    []
  )
})
