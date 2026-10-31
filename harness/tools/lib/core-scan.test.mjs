import assert from 'node:assert/strict'
import { test } from 'node:test'
import { coreLeakProblems, frameworkCoreProblems } from './core-scan.mjs'
import { coreEntries } from './layers.mjs'

const PROFILE = {
  stack: 'postgres|\\bnpm\\b',
  product: '\\bbots?\\b|\\bscripts?\\b|\\bbase\\b',
  productGeneric: '\\bscripts?\\b',
  projectValues: '`develop`|\\bphase [0-9]+'
}

const BINDINGS = coreEntries(['AGENTS.md sections 1 7', 'docs/method.md'])
const BINDING_LINE = '**Role binding.** The integration branch is `develop`, Phase 12.'
const AGENTS = (body) => `# Rules\n## 1. A\n${body}\n## 2. Moved\nA bot moves.\n## 7. Git\n${BINDING_LINE}\n`

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
    'docs/method.md: listed as CORE in layers.core of the profile file but not found'
  ])
  const none = { 'AGENTS.md': '## 1. A\nok\n', 'docs/method.md': '' }
  assert.match(coreLeakProblems(none, PROFILE, BINDINGS)[0], /expected one "\*\*Role binding\.\*\*" line.*found 0/)
  const twice = { 'AGENTS.md': AGENTS(BINDING_LINE), 'docs/method.md': '' }
  assert.match(coreLeakProblems(twice, PROFILE, BINDINGS)[0], /found 2/)
})

test('the framework core is scanned whole, without a binding line, and an empty folder is a problem', () => {
  const folder = 'framework/core'
  assert.deepEqual(
    frameworkCoreProblems({ 'framework/core/a.md': 'Branch from the integration branch.' }, PROFILE, folder),
    []
  )
  assert.deepEqual(
    frameworkCoreProblems(
      {
        'framework/core/b.md': 'ok\nStored in Postgres.',
        'framework/core/a.md': 'The integration branch is `develop`.'
      },
      PROFILE,
      folder
    ),
    [
      'framework/core/a.md:1: the project value "`develop`" does not belong in a CORE file; cite a role of the profile',
      'framework/core/b.md:2: the stack term "Postgres" does not belong in a CORE file; cite a role of the profile'
    ]
  )
  assert.match(frameworkCoreProblems({}, PROFILE, folder)[0], /^framework\/core: no file found/)
})
