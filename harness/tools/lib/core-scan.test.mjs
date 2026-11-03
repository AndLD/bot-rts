import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { coreLeakProblems, frameworkCoreProblems, loadVocabulary } from './core-scan.mjs'
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

test('the words of the framework adapters are scanned for too, each reported with its adapter', () => {
  const adapters = [
    { source: 'host adapter somehost', pattern: '\\bsomehost\\b|\\.somehost/' },
    { source: 'runtime adapter agentx', pattern: 'agentx' }
  ]
  assert.deepEqual(frameworkCoreProblems({ 'f/core/a.md': 'Ask the host.' }, PROFILE, 'f/core', adapters), [])
  assert.deepEqual(
    frameworkCoreProblems(
      { 'f/core/a.md': 'Push to SomeHost.\nOpen .somehost/x in AgentX.' },
      PROFILE,
      'f/core',
      adapters
    ),
    [
      'f/core/a.md:1: the host adapter somehost term "SomeHost" does not belong in a CORE file; cite a role of the profile',
      'f/core/a.md:2: the host adapter somehost term ".somehost/" does not belong in a CORE file; cite a role of the profile',
      'f/core/a.md:2: the runtime adapter agentx term "AgentX" does not belong in a CORE file; cite a role of the profile'
    ]
  )
})

// The tools that no adapter of the framework covers, by class: the framework's own `terms.stack` must refuse each of them in `core/`
const UNCOVERED_TOOLS = {
  database: ['PostgreSQL', 'Redis', 'MongoDB', 'SQLite'],
  orm: ['Prisma', 'TypeORM', 'SQLAlchemy'],
  'web framework': ['NestJS', 'Next.js', 'React.js', 'Vue', 'Django'],
  'test framework': ['Cypress', 'Playwright', 'Selenium', 'Vitest'],
  'container or cloud service': ['Docker', 'Kubernetes', 'Vercel', 'AWS', 'Terraform'],
  'host or agent runtime': ['GitLab', 'Bitbucket', 'Copilot', 'Jenkins']
}
const NEUTRAL_WORDS =
  'The database and the container hold the data; react to a failure, express the rule, set the helm of the work.'

test('the framework profile refuses a tool name of each class that no adapter covers, and lets neutral words pass', () => {
  const { terms } = JSON.parse(readFileSync(new URL('../../harness-profile.json', import.meta.url), 'utf8'))

  for (const [kind, names] of Object.entries(UNCOVERED_TOOLS)) {
    for (const name of names) {
      const problems = frameworkCoreProblems({ 'core/a.md': `Use ${name} for this.` }, terms, 'core')
      assert.equal(problems.length, 1, `${kind} "${name}" should be refused`)
      assert.match(problems[0], /^core\/a\.md:1: the stack term "/)
    }
  }
  assert.deepEqual(frameworkCoreProblems({ 'core/a.md': NEUTRAL_WORDS }, terms, 'core'), [])
})

test('the words of the vocabulary, and their plurals, are not reported; the other matches on the same line are', () => {
  const vocabulary = new Set(['script', 'bot'])
  const profile = { ...PROFILE, product: '\\bscripts?\\b|\\bbots?\\b|\\bcart\\b', productGeneric: '(?!)' }
  const files = { 'f/core/a.md': 'Run the scripts and the script.\nThe Scripts and a cart.' }
  assert.deepEqual(frameworkCoreProblems(files, profile, 'f/core', [], { vocabulary }), [
    'f/core/a.md:2: the product term "cart" does not belong in a CORE file; cite a role of the profile'
  ])
  assert.equal(
    frameworkCoreProblems(files, profile, 'f/core').length,
    2,
    'without a vocabulary both lines are reported'
  )
  assert.deepEqual(
    coreLeakProblems({ 'AGENTS.md': AGENTS('The bots run.'), 'docs/method.md': '' }, profile, BINDINGS, { vocabulary }),
    []
  )
})

test("the vendored scan words each hit with the way out of its term list; an adapter word is the framework's own", () => {
  const adapters = [{ source: 'host adapter somehost', pattern: '\\bsomehost\\b' }]
  const files = { 'h/core/a.md': 'Postgres.\nA bot.\nIn Phase 4.\nSomeHost.' }
  const messages = frameworkCoreProblems(files, PROFILE, 'h/core', adapters, { vendored: true }).map((text) =>
    text.replace(/^h\/core\/a\.md:\d: /, '')
  )
  assert.deepEqual(messages, [
    'the stack term "Postgres" is in the vendored framework core, which you cannot edit; an ordinary word: make `terms.stack` of the profile file narrower; a product or tool word: report it upstream (an issue of the framework repository), record it in `terms.exceptions` of the profile file for this version, and take the fix with the next one',
    'the product term "bot" is in the vendored framework core, which you cannot edit; an ordinary word: add it to `terms.productGeneric` of the profile file; a product or tool word: report it upstream (an issue of the framework repository), record it in `terms.exceptions` of the profile file for this version, and take the fix with the next one',
    'the project value "Phase 4" is in the vendored framework core, which you cannot edit; an ordinary word: make `terms.projectValues` of the profile file narrower; a product or tool word: report it upstream (an issue of the framework repository), record it in `terms.exceptions` of the profile file for this version, and take the fix with the next one',
    'the host adapter somehost term "SomeHost" is in the vendored framework core, which you cannot edit; report it upstream (an issue of the framework repository), record it in `terms.exceptions` of the profile file for this version, and take the fix with the next one'
  ])
})

test("the vocabulary of the framework core is sorted, plain, used by the core, and hides nothing of the framework's own terms", () => {
  const coreDir = new URL('../../core/', import.meta.url)
  const words = JSON.parse(readFileSync(new URL('vocabulary.json', coreDir), 'utf8')).words
  assert.deepEqual(words, [...words].sort(), 'sorted, so a duplicate or a new word is easy to see')
  assert.equal(new Set(words).size, words.length)
  assert.deepEqual(
    words.filter(
      (word) =>
        !/^[a-z]+$/.test(word) || (words.includes(word.replace(/e?s$/, '')) && word.replace(/e?s$/, '') !== word)
    ),
    [],
    'lower case, one word, and no plural next to its singular (the scan strips an s)'
  )
  assert.equal(loadVocabulary(coreDir.pathname).size, words.length)
  assert.equal(loadVocabulary('/no/such/folder').size, 0, 'a version of the framework with no vocabulary has none')

  const text = readCoreText(coreDir).toLowerCase()
  assert.deepEqual(
    words.filter((word) => !new RegExp(`\\b${word}`).test(text)),
    [],
    'a word that core does not use does not belong'
  )

  // The vocabulary must not hide a tool name or a value of this repository: none of its words matches the framework's own term lists
  const { terms } = JSON.parse(readFileSync(new URL('../../harness-profile.json', import.meta.url), 'utf8'))
  for (const pattern of [terms.stack, terms.projectValues]) {
    assert.deepEqual(
      words.filter((word) => new RegExp(pattern, 'i').test(word)),
      []
    )
  }
})

function readCoreText(dir) {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => readFileSync(new URL(`${entry.parentPath ?? entry.path}/${entry.name}`, 'file://'), 'utf8'))
    .join('\n')
}

test('an exception of the profile file accepts a hit of its file and word at its version, and is a problem at any other', () => {
  const files = { 'h/core/a.md': 'A bot waits.\nThe BOT again.', 'h/core/b.md': 'A bot.' }
  const profile = { ...PROFILE, product: '\\bbots?\\b', productGeneric: '(?!)' }
  const exception = { file: 'h/core/a.md', word: 'bot', report: 'https://example.com/issues/1', version: '0.1.1' }
  const scan = (exceptions, version) =>
    frameworkCoreProblems(files, profile, 'h/core', [], { vendored: true, exceptions, version })

  // Both hits of a.md are accepted, the hit of b.md is not
  assert.deepEqual(
    scan([exception], '0.1.1').map((text) => text.slice(0, 37)),
    ['h/core/b.md:1: the product term "bot"']
  )

  // After a sync to another version the exception is a problem, and so is the hit it no longer covers
  const after = scan([exception], '0.1.2')
  assert.equal(after.length, 4)
  assert.match(
    after.at(-1),
    /^terms\.exceptions\[0\] of the profile file: the exception for "bot" in h\/core\/a\.md \(https:\/\/example\.com\/issues\/1\) holds for version 0\.1\.1, and the lock is at 0\.1\.2: remove it/
  )

  // At its version, an exception for a word that is not there (the fix came in the same version) is a problem
  const gone = { ...exception, word: 'robot' }
  assert.match(scan([gone], '0.1.1').at(-1), /matches no hit in version 0\.1\.1: remove it/)

  // Outside a vendored folder there are no exceptions: the files can be edited
  assert.equal(
    frameworkCoreProblems(files, profile, 'h/core', [], { exceptions: [exception], version: '0.1.1' }).length,
    3
  )
})
