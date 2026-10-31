// The checks of `harness check all` on a throwaway Git project with a profile file: each one passes on the clean project and names the
// problem it was planted with. Also the plan log, the release on its branch, and `check all` with the project's own checks.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, test } from 'node:test'
import { checkChangelog, release } from './changelog.mjs'
import { checkCore, frameworkCoreFolder } from './core-scan.mjs'
import { checkLinks } from './links.mjs'
import { checkPaths } from './paths.mjs'
import { planLog, planSummary } from './plan.mjs'
import { checkProductKnowledge } from './product-knowledge.mjs'
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
