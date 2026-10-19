import assert from 'node:assert/strict'
import { test } from 'node:test'
import { coreFiles, coreLeakProblems, profilePattern } from './core-leaks-lib.mjs'

const PROFILE = [
  "STACK='postgres|\\bnpm\\b'",
  "PRODUCT='\\bbots?\\b|\\bscripts?\\b|\\bbase\\b'",
  "PRODUCT_GENERIC='\\bscripts?\\b'",
  "PROJECT_VALUES='`develop`|\\bphase [0-9]+'"
].join('\n')

const BINDINGS = '```core-files\nAGENTS.md sections 1 7\ndocs/method.md\n```\n'
const BINDING_LINE = '**Role binding.** The integration branch is `develop`, Phase 12.'
const AGENTS = (body) => `# Rules\n## 1. A\n${body}\n## 2. Moved\nA bot moves.\n## 7. Git\n${BINDING_LINE}\n`

test('profilePattern reads a list of the profile and fails when it is missing', () => {
  assert.equal(profilePattern(PROFILE, 'STACK'), 'postgres|\\bnpm\\b')
  assert.throws(() => profilePattern('no list', 'STACK'), /no STACK term list/)
})

test('coreFiles reads the paths and the sections of the bindings block', () => {
  assert.deepEqual(coreFiles(BINDINGS), [
    { path: 'AGENTS.md', sections: ['1', '7'] },
    { path: 'docs/method.md', sections: null }
  ])
  assert.throws(() => coreFiles('no block'), /no core-files block/)
})

test('clean CORE files and one binding line have no problems; generic words and other sections are not scanned', () => {
  const files = { 'AGENTS.md': AGENTS('Run the script.'), 'docs/method.md': 'Branch from the integration branch.' }
  assert.deepEqual(coreLeakProblems(files, PROFILE, BINDINGS), [])
})

test('a stack term, a product term and a project value are problems, with their place', () => {
  const files = {
    'AGENTS.md': AGENTS('ok'),
    'docs/method.md': 'ok\nStored in Postgres.\nThe bot waits.\nFrom Phase 10 on, branch `develop`.'
  }
  assert.deepEqual(coreLeakProblems(files, PROFILE, BINDINGS), [
    'docs/method.md:2: the stack term "Postgres" does not belong in a CORE file; cite a role of the profile',
    'docs/method.md:3: the product term "bot" does not belong in a CORE file; cite a role of the profile',
    'docs/method.md:4: the project value "Phase 10" does not belong in a CORE file; cite a role of the profile'
  ])
})

test('a value outside the binding line in a scanned section of AGENTS.md is a problem', () => {
  const files = { 'AGENTS.md': AGENTS('Never push to `develop`.'), 'docs/method.md': '' }
  assert.deepEqual(coreLeakProblems(files, PROFILE, BINDINGS), [
    'AGENTS.md:3: the project value "`develop`" does not belong in a CORE file; cite a role of the profile'
  ])
})

test('a missing CORE file and a missing or repeated binding line are problems', () => {
  assert.deepEqual(coreLeakProblems({ 'AGENTS.md': AGENTS('ok') }, PROFILE, BINDINGS), [
    'docs/method.md: listed as CORE in the harness bindings but not found'
  ])
  const none = { 'AGENTS.md': '## 1. A\nok\n', 'docs/method.md': '' }
  assert.match(coreLeakProblems(none, PROFILE, BINDINGS)[0], /expected one "\*\*Role binding\.\*\*" line.*found 0/)
  const twice = { 'AGENTS.md': AGENTS(BINDING_LINE), 'docs/method.md': '' }
  assert.match(coreLeakProblems(twice, PROFILE, BINDINGS)[0], /found 2/)
})
