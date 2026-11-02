import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { scaffoldProblems } from './scaffold.mjs'
import { STACKS } from './stacks.mjs'

const dirs = []
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))
const profile = { adapters: { stacks: ['node-ts'] } }

function project(files, { vendored = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'scaffold-'))
  dirs.push(root)
  if (vendored) {
    mkdirSync(join(root, 'harness'))
  }
  for (const [path, text] of Object.entries(files)) {
    writeFileSync(join(root, path), text)
  }
  return root
}
const problems = (root) => scaffoldProblems({ root, profile, stacks: STACKS })

test('the ignore file that excludes the vendored framework passes, in each form of the exclusion', () => {
  for (const line of ['harness', 'harness/', '/harness', '/harness/', 'harness/**']) {
    assert.deepEqual(problems(project({ '.prettierignore': `node_modules\n${line}\ndist\n` })), [], line)
  }
})

test('an ignore file that does not exclude it fails, naming the file and the line to add', () => {
  const found = problems(project({ '.prettierignore': 'node_modules\nharness.lock.json\nharness-adapters\n' }))
  assert.equal(found.length, 1)
  assert.match(found[0], /^\.prettierignore: does not exclude harness\/.*add the line "harness\/"/)
})

test('a missing ignore file fails, unless the stack marks it optional', () => {
  const found = problems(project({}))
  assert.equal(found.length, 1)
  assert.match(found[0], /^\.prettierignore: the node-ts stack expects this ignore file, and it is missing/)
  assert.deepEqual(problems(project({ '.prettierignore': 'harness/\n' })), [], 'the ESLint ignore file is optional')
  assert.match(
    problems(project({ '.prettierignore': 'harness/\n', '.eslintignore': 'dist\n' }))[0],
    /^\.eslintignore: does not exclude harness\//
  )
})

test('a project without a vendored framework, or with a stack the framework does not have, has nothing to hold', () => {
  assert.deepEqual(problems(project({}, { vendored: false })), [])
  assert.deepEqual(
    scaffoldProblems({ root: project({}), profile: { adapters: { stacks: ['nowhere'] } }, stacks: STACKS }),
    []
  )
})
