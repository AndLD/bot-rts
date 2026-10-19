import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

// The lists of the real profile (section 9), for the values that the lists must catch
const REAL_PROFILE = readFileSync(new URL('../docs/profile.md', import.meta.url), 'utf8')
const REAL_FILES = (text) => ({ 'AGENTS.md': AGENTS('ok'), 'docs/method.md': text })

test('the profile lists catch a game noun, a task-id branch example and a link to a dated file', () => {
  const cases = [
    ['The soak test sustains N players.', 'the product term "players"'],
    ['A player must learn it.', 'the product term "player"'],
    ['For example `feature/3.12-some-task`.', 'the project value "feature/3"'],
    ['See `bugfix/12.1-fix`.', 'the project value "bugfix/1"'],
    ['The report [2026-10-19](./harness/2026-10-19.md).', 'the project value "2026-10-19.md"'],
    ['The report [second](./2026-10-19-2.md).', 'the project value "2026-10-19-2.md"']
  ]
  for (const [text, expected] of cases) {
    const problems = coreLeakProblems(REAL_FILES(text), REAL_PROFILE, BINDINGS)
    assert.equal(problems.length, 1, text)
    assert.ok(problems[0].includes(expected), `${text}: ${problems[0]}`)
  }
})

test('the profile lists let a placeholder branch example and a template date pattern pass', () => {
  const text = 'Branch `feature/<id>-<slug>`; reports are named `YYYY-MM-DD.md`.'
  assert.deepEqual(coreLeakProblems(REAL_FILES(text), REAL_PROFILE, BINDINGS), [])
})
