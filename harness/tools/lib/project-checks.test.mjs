// The checks of `harness check all` on a throwaway Git project with a profile file: each one passes on the clean project and names the
// problem it was planted with. Also the plan log, the release on its branch, and `check all` with the project's own checks.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, test } from 'node:test'
import { checkChangelog, release } from './changelog.mjs'
import { checkCore, frameworkCoreFolder, frameworkCoreScan } from './core-scan.mjs'
import { checkLinks } from './links.mjs'
import { checkPaths } from './paths.mjs'
import { planLog, planSummary } from './plan.mjs'
import { checkProductKnowledge } from './product-knowledge.mjs'
import { AREAS_BEGIN, AREAS_END, NOTE_HEADINGS, noteProblems } from './migration-notes.mjs'
import { loadProfile } from './profile.mjs'

const made = []
afterEach(() => made.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })))

const PROFILE = {
  repository: { slug: 'acme/shop', url: 'https://example.com/acme/shop' },
  branches: { production: 'main', integration: 'develop' },
  requiredChecks: ['verify'],
  adapters: { stacks: ['node-ts'], runtimes: [], host: 'github' },
  coverageGate: { statements: 90, branches: 90, functions: 90, lines: 90 },
  coveragePackages: ['app'],
  paths: {
    plan: 'docs/plan',
    phases: 'docs/plan/phases',
    planIndex: 'docs/plan/INDEX.md',
    changelog: 'CHANGELOG.md',
    changelogFragments: 'changelog.d'
  },
  terms: {
    stack: 'postgres',
    product: '\\bcart\\b|\\border\\b',
    productGeneric: '\\border\\b',
    projectValues: '`develop`'
  },
  layers: {
    scope: ['**/*.md'],
    core: ['AGENTS.md sections 1', 'docs/method.md'],
    domain: ['docs/product/**'],
    adapter: ['docs/stack.md'],
    state: ['docs/plan/**', 'CHANGELOG.md', 'changelog.d/**'],
    entry: ['README.md']
  },
  productKnowledge: {
    root: 'docs/product',
    specification: 'docs/product/spec',
    glossary: 'glossary.md',
    register: 'open.md',
    backlog: 'backlog.md',
    backlogSection: '9',
    excluded: ['spec/open.md', 'spec/backlog.md'],
    implementationPattern: '\\bapp\\/src\\/'
  },
  release: { versionFiles: ['package.json', 'app/package.json'] }
}

const PHASE = (status, rows) =>
  [
    `# Phase 1 — Checkout (${rows.reduce((sum, [, sp]) => sum + sp, 0)} SP)`,
    '',
    `**Status:** ${status} · **Work log:** x`,
    '',
    '| # | Task | SP | Status |',
    '| - | ---- | -- | ------ |',
    ...rows.map(([id, sp, mark]) => `| ${id} | A task | ${sp} | ${mark} |`)
  ].join('\n')

const FILES = {
  '.github/workflows/ci.yml':
    'on:\n  pull_request:\n    branches: [develop, main]\n  push:\n    branches: [develop, main]\njobs:\n  verify:\n    runs-on: x\n',
  'AGENTS.md':
    '# Rules\n\n## 1. Rules\n\nWork from the integration branch.\n**Role binding.** The integration branch is `develop`.\n\n## 2. Other\n\nA cart holds items.\n',
  'README.md':
    '# Shop\n\nSee [the method](docs/method.md#testing), [the stack](./docs/stack.md) and `docs/stack.md`.\n',
  'docs/method.md': '# Method\n\n## Testing\n\nEvery feature has tests.\n',
  'docs/stack.md': '# Stack\n\nThe gate is `scripts/gate.mjs`; local settings sit in `local/settings.json`.\n',
  'scripts/gate.mjs': '// gate\n',
  '.gitignore': 'local/\n',
  'docs/product/spec/glossary.md':
    '| Term | Code name | Aliases | Definition |\n| --- | --- | --- | --- |\n| **Cart** | `cart` | basket | What a buyer holds. |\n',
  'docs/product/spec/open.md':
    '| Id | Question | Kind | Section | Blocks | Owner |\n| --- | --- | --- | --- | --- | --- |\n| Q1 | Tax? | needs a decision | §2 | none | owner |\n',
  'docs/product/spec/backlog.md': '- Later: gift cards.\n',
  'docs/product/spec/02-cart.md':
    '# Cart\n\nA **cart** holds items; taxes are open (Q1); gift cards come later (§9).\n',
  'docs/plan/INDEX.md':
    '# Plan\n\n<!-- plan-summary:start -->\n<!-- plan-summary:end -->\n\n<!-- plan-contents:start -->\n<!-- plan-contents:end -->\n',
  'docs/plan/phases/phase-1-checkout.md': PHASE('🟡 In progress', [
    ['1.1', 3, '✅'],
    ['1.2', 2, '⬜']
  ]),
  'CHANGELOG.md': '# Changelog\n\n## [Unreleased]\n\n### Added\n\n- The cart.\n',
  'changelog.d/README.md': '# Fragments\n',
  'changelog.d/checkout.md': 'Added: checkout\n',
  'package.json': '{ "name": "shop", "version": "1.0.0" }\n',
  'app/package.json': '{ "name": "app", "version": "1.0.0" }\n'
}

function project(extra = {}) {
  const root = mkdtempSync(join(tmpdir(), 'harness-checks-'))
  made.push(root)
  write(root, { 'harness-profile.json': JSON.stringify(PROFILE), ...FILES, ...extra })
  git(root, 'init', '--quiet', '--initial-branch', 'develop')
  commit(root, 'chore: start\n\nPlan: 1.1')
  return root
}

function write(root, files) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
}

const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const commit = (root, message) => {
  git(root, 'add', '.')
  git(root, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--quiet', '-m', message)
}
const profileOf = (root) => loadProfile(root)
const NOTE_TEXT = (version) =>
  `# Migration to ${version} from 1.0.0\n\n${NOTE_HEADINGS.map((heading) => `## ${heading}\n\n${heading === 'Areas touched' ? `${AREAS_BEGIN}\n${AREAS_END}` : 'Nothing.'}\n`).join('\n')}`

test('links: a clean project passes; a broken file link, a missing anchor and a link to an ignored file fail', () => {
  const root = project()
  assert.deepEqual(checkLinks({ root }).problems, [])

  write(root, {
    'docs/stack.md': '# Stack\n\n[gone](./gone.md), [anchor](./method.md#nowhere), [local](../local/settings.json)\n',
    'local/settings.json': '{}'
  })
  commit(root, 'docs: break links')
  const problems = checkLinks({ root }).problems.join('\n')
  assert.match(problems, /docs\/stack\.md: broken link "\.\/gone\.md"/)
  assert.match(problems, /docs\/stack\.md: link "\.\/method\.md#nowhere" has no matching heading/)
  assert.match(problems, /docs\/stack\.md: link "\.\.\/local\/settings\.json" points to a git-ignored file/)
})

test('paths: a backticked path must exist, an ignored local file is accepted, STATE documents are not read', () => {
  const root = project()
  assert.deepEqual(checkPaths({ root, profile: profileOf(root) }).problems, [])

  write(root, {
    'docs/stack.md': '# Stack\n\nThe gate was `scripts/old-gate.mjs` (line `scripts/gate.mjs:1`).\n',
    'docs/plan/phases/phase-1-checkout.md': `${PHASE('🟡 In progress', [
      ['1.1', 3, '✅'],
      ['1.2', 2, '⬜']
    ])}\n\nOnce \`scripts/removed.mjs\`.\n`
  })
  commit(root, 'docs: stale path')
  assert.deepEqual(checkPaths({ root, profile: profileOf(root) }).problems, [
    'docs/stack.md:3: the path `scripts/old-gate.mjs` does not exist; correct it or drop the backticks'
  ])
})

test('paths: the answer does not depend on the disk; an absent folder ignored by a folder rule is accepted', () => {
  const root = project({ '.gitignore': 'local/\n/cache/\n' })
  write(root, {
    'docs/stack.md':
      '# Stack\n\nThe cache is `cache/`, the gate `scripts/gate.mjs`, the folder `scripts/`; the draft `scripts/draft.mjs`.\n',
    'scripts/draft.mjs': '// on this machine only, neither tracked nor ignored'
  })
  git(root, 'add', 'docs/stack.md')
  git(root, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--quiet', '-m', 'docs: name a cache folder')
  assert.deepEqual(checkPaths({ root, profile: profileOf(root) }).problems, [
    'docs/stack.md:3: the path `scripts/draft.mjs` does not exist; correct it or drop the backticks'
  ])
})

test('core: the CORE documents and their sections, the one binding line, and the framework core the project owns', () => {
  const root = project()
  assert.deepEqual(checkCore({ root, profile: profileOf(root) }).problems, [])
  assert.equal(frameworkCoreFolder(root), null, 'without a lock there is no framework core to scan here')

  write(root, { 'docs/method.md': '# Method\n\nStored in Postgres; branch from `develop`.\n' })
  const problems = checkCore({ root, profile: profileOf(root) }).problems
  assert.equal(problems.length, 2)
  assert.match(problems[0], /docs\/method\.md:3: the stack term "Postgres"/)

  write(root, {
    'docs/method.md': FILES['docs/method.md'],
    'harness.lock.json': JSON.stringify({ mode: 'pinned', source: { type: 'path', location: 'framework' } }),
    'framework/core/rules.md': 'Each cart is checked.\n'
  })
  assert.equal(frameworkCoreFolder(root), 'framework/core')
  assert.match(
    checkCore({ root, profile: profileOf(root) }).problems.join('\n'),
    /framework\/core\/rules\.md:1: the product term "cart"/
  )
})

test('core, pinned: the vendored framework core is scanned with the project terms, and a hit names the ways out', () => {
  const lock = JSON.stringify({ mode: 'pinned', source: { type: 'git', url: 'https://example.com/framework.git' } })
  const root = project({ 'harness.lock.json': lock, 'harness/core/rules.md': 'Each cart is checked.\n' })
  assert.deepEqual(frameworkCoreScan(root), { folder: 'harness/core', vendored: true })

  const problems = checkCore({ root, profile: profileOf(root) }).problems
  assert.equal(problems.length, 1)
  assert.match(problems[0], /^harness\/core\/rules\.md:1: the product term "cart" is in the vendored framework core/)
  assert.match(problems[0], /add it to `terms\.productGeneric`/)
  assert.match(problems[0], /report it upstream.*record it in `terms\.exceptions`/)

  // Way out 1: an ordinary word is listed in productGeneric
  const generic = { ...PROFILE, terms: { ...PROFILE.terms, productGeneric: '\\border\\b|\\bcart\\b' } }
  write(root, { 'harness-profile.json': JSON.stringify(generic) })
  assert.deepEqual(checkCore({ root, profile: profileOf(root) }).problems, [])

  // Way out 2: the word is in the vocabulary of the framework's core, whatever the terms say
  write(root, {
    'harness-profile.json': JSON.stringify(PROFILE),
    'harness/core/vocabulary.json': JSON.stringify({ words: ['cart'] })
  })
  assert.deepEqual(checkCore({ root, profile: profileOf(root) }).problems, [])

  // A tool word the vocabulary does not hold is still reported, also on a line with a vocabulary word
  write(root, { 'harness/core/rules.md': 'Each cart waits for Postgres.\n' })
  assert.match(
    checkCore({ root, profile: profileOf(root) }).problems.join('\n'),
    /the stack term "Postgres" is in the vendored/
  )
})

test('core, pinned: a recorded exception holds while the lock is at its version and fails after a sync to the next', () => {
  const lock = (version) =>
    JSON.stringify({ mode: 'pinned', version, source: { type: 'git', url: 'https://example.com/framework.git' } })
  const exception = {
    file: 'harness/core/rules.md',
    word: 'cart',
    report: 'https://example.com/framework/issues/7',
    version: '0.1.0'
  }
  const withException = (exceptions) => JSON.stringify({ ...PROFILE, terms: { ...PROFILE.terms, exceptions } })
  const root = project({ 'harness.lock.json': lock('0.1.0'), 'harness/core/rules.md': 'Each cart is checked.\n' })

  assert.equal(checkCore({ root, profile: profileOf(root) }).problems.length, 1)

  write(root, { 'harness-profile.json': withException([exception]) })
  assert.deepEqual(checkCore({ root, profile: profileOf(root) }).problems, [])

  // The next version still has the word: the hit is reported again, and the exception says why it does not hold
  write(root, { 'harness.lock.json': lock('0.1.1') })
  const problems = checkCore({ root, profile: profileOf(root) }).problems
  assert.equal(problems.length, 2)
  assert.match(problems[0], /harness\/core\/rules\.md:1: the product term "cart" is in the vendored/)
  assert.match(problems[1], /holds for version 0\.1\.0, and the lock is at 0\.1\.1: remove it/)

  // The next version has the fix: only the stale exception is left
  write(root, { 'harness/core/rules.md': 'Each item is checked.\n' })
  assert.match(
    checkCore({ root, profile: profileOf(root) }).problems.join('\n'),
    /^terms\.exceptions\[0\].*the lock is at 0\.1\.1: remove it/
  )
})

test('plan: the summary is written from the phase files and checked; the log is printed from the Plan lines of the commits', () => {
  const root = project()
  assert.match(
    planSummary({ root, profile: profileOf(root), check: true }).problems.join('\n'),
    /disagree with the phase files/
  )

  planSummary({ root, profile: profileOf(root) })
  const index = readFileSync(join(root, 'docs/plan/INDEX.md'), 'utf8')
  assert.match(index, /\| 1 \| Checkout \| 5 \| 🟡 In progress \|/)
  assert.match(index, /- \[Phase 1 — Checkout \(5 SP\)\]\(\.\/phases\/phase-1-checkout\.md\)/)
  assert.deepEqual(planSummary({ root, profile: profileOf(root), check: true }).problems, [])

  write(root, { 'a.txt': 'x' })
  commit(root, 'feat: the cart (#7)\n\nPlan: 1.2')
  const log = planLog({ root, profile: profileOf(root), phase: '1', ref: 'HEAD' })
  assert.match(log, /\| 1\.2 \| \[#7\]\(https:\/\/example\.com\/acme\/shop\/pull\/7\) \| feat: the cart \|/)
  assert.throws(() => planLog({ root, profile: profileOf(root), phase: 'x' }), /the phase is a number/)
})

test('changelog: a fragment needs a kind; a release on its branch sets the versions and moves the entries', () => {
  const root = project()
  assert.deepEqual(checkChangelog({ root, profile: profileOf(root) }).problems, [])
  assert.throws(
    () => release({ root, profile: profileOf(root) }),
    /release\/<x\.y\.z> or hotfix\/<x\.y\.z>, not on "develop"/
  )

  git(root, 'checkout', '--quiet', '-b', 'release/1.1.0')
  const dry = release({ root, profile: profileOf(root), dryRun: true, date: '2026-10-31' })
  assert.deepEqual(dry, [
    'release/1.1.0: 1.0.0 -> 1.1.0 (2026-10-31), 1 changelog fragments',
    'Dry run: nothing was written.'
  ])

  release({ root, profile: profileOf(root), date: '2026-10-31' })
  assert.equal(JSON.parse(readFileSync(join(root, 'app/package.json'), 'utf8')).version, '1.1.0')
  const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8')
  assert.match(changelog, /## \[1\.1\.0\] - 2026-10-31\n\n### Added\n\n- The cart\.\n- checkout/)
  assert.match(git(root, 'status', '--porcelain', 'changelog.d'), /^D changelog\.d\/checkout\.md$/)

  write(root, { 'changelog.d/bad.md': 'checkout' })
  assert.match(
    checkChangelog({ root, profile: profileOf(root) }).problems[0],
    /bad\.md: a changelog fragment starts with/
  )
})

test('changelog: a development version of a release sets only the versions, and numbers itself by the tags', () => {
  const root = project()
  git(root, 'checkout', '--quiet', '-b', 'release/1.1.0')
  const dry = release({ root, profile: profileOf(root), dev: true, dryRun: true })
  assert.deepEqual(dry, [
    'release/1.1.0: 1.0.0 -> 1.1.0-dev.1 (a development version: no changelog entry)',
    'Dry run: nothing was written.'
  ])

  release({ root, profile: profileOf(root), dev: true })
  assert.equal(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version, '1.1.0-dev.1')
  assert.equal(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), FILES['CHANGELOG.md'])
  assert.equal(git(root, 'status', '--porcelain', 'changelog.d'), '', 'the fragments stay for the final release')

  // Tagged, the next one is dev.2; the final release still starts from the development version
  commit(root, 'chore(release): 1.1.0-dev.1')
  git(root, 'tag', 'v1.1.0-dev.1')
  assert.match(release({ root, profile: profileOf(root), dev: true, dryRun: true })[0], /-> 1\.1\.0-dev\.2 /)
  release({ root, profile: profileOf(root), date: '2026-10-31' })
  assert.equal(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version, '1.1.0')
})

test('release with migration notes: refused without the note, areas derived from the diff since the previous tag, the note linked', () => {
  const changelog =
    '# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-10-01\n\n### Added\n\n- Start.\n\n[Unreleased]: https://example.com/acme/shop/compare/v1.0.0...HEAD\n[1.0.0]: https://example.com/acme/shop/releases/tag/v1.0.0\n'
  const profile = { ...PROFILE, release: { ...PROFILE.release, migrations: 'migrations' } }
  const root = project({
    'harness-profile.json': JSON.stringify(profile),
    'CHANGELOG.md': changelog,
    'migrations/areas.json': JSON.stringify({
      ignore: ['**/*.test.mjs'],
      areas: { procedures: ['core/procedures/**'], checks: ['tools/**'] }
    }),
    'core/procedures/start.md': 'Start.\n',
    'tools/check.mjs': 'a\n'
  })
  git(root, 'tag', 'v1.0.0')
  write(root, { 'core/procedures/start.md': 'Start it.\n', 'tools/check.test.mjs': 'b\n' })
  commit(root, 'feat: change a procedure')
  git(root, 'checkout', '--quiet', '-b', 'release/1.0.1')
  const run = (options = {}) => release({ root, profile: profileOf(root), date: '2026-11-03', ...options })

  assert.throws(() => run({ dryRun: true }), /the migration note migrations\/1\.0\.1\.md is missing/)

  write(root, { 'migrations/1.0.1.md': NOTE_TEXT('1.0.1').replace('## Optional actions', '## Extras') })
  assert.throws(() => run({ dryRun: true }), /migrations\/1\.0\.1\.md: the sections must be, in order/)

  write(root, { 'migrations/1.0.1.md': NOTE_TEXT('1.0.1') })
  commit(root, 'docs: the note')
  const dry = run({ dryRun: true })
  assert.equal(dry[0], 'migrations/1.0.1.md: areas touched: procedures')
  assert.match(dry[1], /^release\/1\.0\.1: 1\.0\.0 -> 1\.0\.1/)

  run()
  assert.match(
    readFileSync(join(root, 'migrations/1.0.1.md'), 'utf8'),
    /<!-- areas:begin -->\n- procedures\n<!-- areas:end -->/
  )
  assert.match(
    readFileSync(join(root, 'CHANGELOG.md'), 'utf8'),
    /## \[1\.0\.1\] - 2026-11-03\n\nMigration note: \[migrations\/1\.0\.1\.md\]\(migrations\/1\.0\.1\.md\)\n\n### Added/
  )

  // A development version has a note of its own, as the final one does; the previous release is the tag of 1.0.1
  commit(root, 'chore(release): 1.0.1')
  git(root, 'tag', 'v1.0.1')
  write(root, { 'changelog.d/added-thing.md': 'Added: a thing.\n' })
  commit(root, 'feat: a thing')
  git(root, 'checkout', '--quiet', '-b', 'release/1.0.2')
  assert.throws(() => run({ dev: true, dryRun: true }), /the migration note migrations\/1\.0\.2-dev\.1\.md is missing/)
  assert.ok(!existsSync(join(root, 'migrations/1.0.2-dev.1.md')), 'a dry run writes no stub')
})

test('release: the stub of a missing note lists the fragments and the areas since the previous tag, and a placeholder in the required actions stops the release', () => {
  const profile = { ...PROFILE, release: { ...PROFILE.release, migrations: 'migrations' } }
  const root = project({
    'harness-profile.json': JSON.stringify(profile),
    'migrations/areas.json': JSON.stringify({ areas: { procedures: ['core/procedures/**'], checks: ['tools/**'] } }),
    'core/procedures/start.md': 'Start.\n',
    'tools/check.mjs': 'a\n'
  })
  git(root, 'tag', 'v1.0.0')
  write(root, { 'core/procedures/start.md': 'Start it.\n', 'changelog.d/first.md': 'Added: the first thing.\n' })
  commit(root, 'feat: first')
  git(root, 'checkout', '--quiet', '-b', 'release/1.1.0')
  const run = (options = {}) => release({ root, profile: profileOf(root), dev: true, date: '2026-11-04', ...options })

  assert.throws(() => run(), /migrations\/1\.1\.0-dev\.1\.md is missing.*A stub .* is written/)
  const stub = readFileSync(join(root, 'migrations/1.1.0-dev.1.md'), 'utf8')
  assert.match(stub, /^# Migration to 1\.1\.0-dev\.1 from 1\.0\.0\n/)
  assert.match(stub, /- Added: the first thing\./)
  assert.match(stub, /<!-- areas:begin -->\n- procedures\n<!-- areas:end -->/)
  assert.deepEqual(noteProblems(stub, '1.1.0-dev.1'), [])

  // The stub is the author's to complete: a placeholder in its required actions stops the release
  commit(root, 'docs: the stub')
  assert.throws(() => run(), /the required actions still hold a TODO/)
  write(root, {
    'migrations/1.1.0-dev.1.md': stub.replace(/TODO: what the project must do[^\n]*/, 'None: nothing to do.')
  })
  commit(root, 'docs: the note')
  assert.match(run({ dryRun: true })[0], /^migrations\/1\.1\.0-dev\.1\.md: areas touched: procedures/)
  run()
  assert.equal(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version, '1.1.0-dev.1')

  // The next development version is written against the tag of the previous one: the fragments and the areas since it
  commit(root, 'chore(release): 1.1.0-dev.1')
  git(root, 'tag', '1.1.0-dev.1')
  write(root, { 'tools/check.mjs': 'b\n', 'changelog.d/second.md': 'Fixed: the second thing.\n' })
  commit(root, 'fix: second')
  assert.throws(() => run(), /migrations\/1\.1\.0-dev\.2\.md is missing/)
  const second = readFileSync(join(root, 'migrations/1.1.0-dev.2.md'), 'utf8')
  assert.match(second, /^# Migration to 1\.1\.0-dev\.2 from 1\.1\.0-dev\.1\n/)
  assert.match(second, /- Fixed: the second thing\./)
  assert.ok(!second.includes('the first thing'), 'the first fragment is in the note of dev.1')
  assert.match(second, /<!-- areas:begin -->\n- checks\n<!-- areas:end -->/)
})

test('product knowledge: the register, the glossary and the scan, each from the profile; no role, no check', () => {
  const root = project()
  const clean = checkProductKnowledge({ root, profile: profileOf(root) })
  assert.deepEqual(clean.problems, [])
  assert.deepEqual(clean.messages, [
    'Checked the open-items register in 4 specification files.',
    'Checked the glossary against 4 specification files.',
    'Checked the product knowledge in 4 files.'
  ])

  write(root, {
    'docs/product/spec/03-order.md': '# Order\n\nStored in Postgres, see `app/src/order.ts`; refunds are TBD (Q2).\n'
  })
  const problems = checkProductKnowledge({ root, profile: profileOf(root) }).problems.join('\n')
  assert.match(problems, /03-order\.md:3: Q2 is not registered in open\.md/)
  assert.match(problems, /spec\/03-order\.md:3: the stack term "Postgres"/)
  assert.match(problems, /spec\/03-order\.md:3: a code path or test file/)

  assert.deepEqual(
    checkProductKnowledge({ root, profile: { ...profileOf(root), productKnowledge: undefined } }).problems,
    []
  )
})

test('check all runs every check and then the project checks; one failure fails the run', () => {
  const root = project()
  const cli = join(import.meta.dirname, '..', 'harness.mjs')
  const run = () => spawnSync(process.execPath, [cli, 'check', 'all', '--root', root], { encoding: 'utf8' })
  planSummary({ root, profile: profileOf(root) })

  const passed = run()
  assert.equal(passed.status, 0, passed.stderr)
  assert.match(
    passed.stdout,
    /No vendored framework in this project\.[\s\S]*Checked links in [\s\S]*Checked 1 changelog fragments\./
  )

  write(root, {
    'harness-profile.json': JSON.stringify({ ...PROFILE, checks: { project: ['node -e "process.exit(3)"'] } })
  })
  const failed = run()
  assert.equal(failed.status, 1)
  assert.match(failed.stderr, /harness check all: the project check `node -e "process\.exit\(3\)"` failed/)
})
