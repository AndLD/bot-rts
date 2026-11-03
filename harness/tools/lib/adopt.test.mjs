// `harness adopt` (design §6.4) on a fixture shaped like a project that copied the first harness, never on another repository.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, before, test } from 'node:test'
import { run } from '../harness.mjs'
import { adoptGit, analyzeScripts, ensureManagedBlocks, exportedNames, frameworkExports } from './adopt-steps.mjs'
import { FRAMEWORK_DIR } from './bootstrap.mjs'
import { readLock } from './lock.mjs'

const dirs = []
const fresh = () => {
  const dir = mkdtempSync(join(tmpdir(), 'adopt-'))
  dirs.push(dir)
  return dir
}
const saved = {}
const GIT_ENV = {
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@t',
  GIT_CONFIG_NOSYSTEM: '1'
}
before(() => {
  const config = join(fresh(), 'gitconfig')
  writeFileSync(config, '')
  for (const [key, value] of Object.entries({ ...GIT_ENV, GIT_CONFIG_GLOBAL: config })) {
    saved[key] = process.env[key]
    process.env[key] = value
  }
})
after(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true }))
})

const git = (root, ...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

const OWN_ENTRY = '# legacy: rules for agents\n\n## Our rules\n\nNever merge on Fridays.\n'
const OWN_HOOK = 'node scripts/own-hook.mjs'
const OLD_HOOK = 'node "$CLAUDE_PROJECT_DIR/scripts/hook-guard-bash.mjs"'

// A project that copied the first harness: the profile file under scripts/, the Git hooks, the link, plan and gate scripts, a renamed copy, a project check
function legacyProject() {
  const root = fresh()
  const files = {
    'scripts/harness-profile.json': JSON.stringify({
      project: { name: 'legacy' },
      repository: { slug: 'acme/legacy' },
      adapters: { stacks: ['node-ts'], runtimes: ['claude-code'], host: 'github' }
    }),
    'scripts/check-markdown-links.mjs': 'export function checkLinks() {}\n',
    'scripts/plan-summary.mjs': 'export function planSummary() {}\n',
    'scripts/local-gate.mjs': 'export function runGate() {}\n',
    // A renamed copy of a framework module: it is found by what it exports
    'scripts/doc-paths.mjs':
      'export function checkPaths() {}\nexport function documentPaths() {}\nexport const unrelated = 1\n',
    'scripts/check-assets.mjs': 'export const checkAssets = () => []\n',
    'scripts/build-atlas.mjs': 'export function buildAtlas() {}\n',
    'scripts/check-assets.test.mjs': 'export const nothing = 1\n',
    '.githooks/pre-push': '#!/bin/sh\nexit 0\n',
    '.githooks/pre-commit': '#!/bin/sh\nexit 0\n',
    '.claude/settings.json': JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: OLD_HOOK }] }],
        Stop: [{ hooks: [{ type: 'command', command: OWN_HOOK }] }]
      },
      permissions: { allow: ['Bash(ls:*)'] }
    }),
    'AGENTS.md': OWN_ENTRY,
    'README.md': '# legacy\n'
  }
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  git(root, 'init', '--quiet', '--initial-branch', 'develop')
  git(root, 'config', 'core.hooksPath', '.githooks')
  git(root, 'add', '--all')
  git(root, 'commit', '--quiet', '--no-verify', '-m', 'legacy')
  return root
}

async function harness(root, argv, input = '') {
  const lines = []
  const code = await run([...argv, '--root', root], {
    out: (line) => lines.push(line),
    err: (line) => lines.push(line),
    input
  })
  return { code, output: lines.join('\n') }
}

test('the names a module exports are read from its declarations, without the names that say nothing', () => {
  const text =
    'export function a() {}\nexport async function b() {}\nexport const c = 1\nexport class D {}\nexport const main = 1\nconst hidden = 2\nexport default x\n'
  assert.deepEqual([...exportedNames(text)], ['a', 'b', 'c', 'D'])
})

test('a script is replaced by name, by what it exports, or is a project check, or is the project’s own', () => {
  const root = legacyProject()
  const { replaced, checks } = analyzeScripts({ root, exports: frameworkExports(join(FRAMEWORK_DIR, 'tools')) })
  const byPath = Object.fromEntries(replaced.map(({ path, by }) => [path, by]))

  assert.equal(byPath['scripts/check-markdown-links.mjs'], '`harness check links`')
  assert.equal(byPath['scripts/plan-summary.mjs'], '`harness plan summary`')
  assert.equal(byPath['scripts/local-gate.mjs'], '`harness gate`')
  assert.equal(byPath['.githooks/pre-push'], 'the Git hook `pre-push` of the framework')
  assert.equal(
    byPath['scripts/harness-profile.json'],
    'the profile file at the root and `harness check profile` and `harness check values`'
  )
  assert.match(byPath['scripts/doc-paths.mjs'], /the exports of `tools\/lib\/paths\.mjs`/)
  assert.deepEqual(checks, ['node scripts/check-assets.mjs'], 'a check of the project stays')
  assert.ok(
    !('scripts/build-atlas.mjs' in byPath) && !('scripts/check-assets.mjs' in byPath),
    'the project’s own scripts are not reported'
  )
})

test('the entry file gets the managed blocks it lacks at its end, and a block that is there stays', () => {
  const root = legacyProject()
  const profile = { paths: { entryFile: 'AGENTS.md' }, documents: { rules: 'AGENTS.md' } }
  const first = ensureManagedBlocks(root, profile)
  assert.deepEqual(
    first.added,
    ['non-negotiables', 'git-rules', 'procedures'].sort((a, b) => first.added.indexOf(a) - first.added.indexOf(b))
  )
  const text = readFileSync(join(root, 'AGENTS.md'), 'utf8')
  assert.ok(text.startsWith(OWN_ENTRY), 'the project’s own text is first and untouched')
  assert.match(text, /<!-- harness:begin non-negotiables -->\n<!-- harness:end non-negotiables -->/)

  assert.deepEqual(ensureManagedBlocks(root, profile).added, [], 'a second call adds nothing')
  assert.equal(readFileSync(join(root, 'AGENTS.md'), 'utf8'), text)
})

test('adoptGit points the hooks at the framework and says what they were; outside a repository it says what to do', () => {
  const root = legacyProject()
  assert.match(adoptGit(root, { paths: {} })[0], /core\.hooksPath was \.githooks/)
  assert.equal(git(root, 'config', 'core.hooksPath'), 'harness/tools/git-hooks')
  assert.match(adoptGit(fresh(), { paths: {} })[0], /not a Git repository/)
})

test('adopt moves a project that copied the first harness onto the framework, deletes nothing, and commits nothing', async () => {
  const root = legacyProject()
  const head = git(root, 'rev-parse', 'HEAD')
  const { code, output } = await harness(root, ['adopt', '--non-interactive'])
  assert.equal(code, 0, output)

  // The framework, the lock, the profile file at the root, completed
  assert.equal(readLock(root).mode, 'pinned')
  assert.ok(existsSync(join(root, 'harness', 'tools', 'harness.mjs')))
  assert.ok(!existsSync(join(root, 'scripts', 'harness-profile.json')), 'the profile file moved')
  const profile = JSON.parse(readFileSync(join(root, 'harness-profile.json'), 'utf8'))
  assert.equal(profile.project.name, 'legacy')
  assert.deepEqual(
    profile.branches,
    { production: 'main', integration: 'develop' },
    'the keys it lacked come from the defaults'
  )
  assert.deepEqual(profile.checks.project, ['node scripts/check-assets.mjs'])

  // The hooks point at the framework; the project's own hook entry stays
  assert.equal(git(root, 'config', 'core.hooksPath'), 'harness/tools/git-hooks')
  const settings = JSON.parse(readFileSync(join(root, '.claude', 'settings.json'), 'utf8'))
  const commands = Object.values(settings.hooks).flatMap((list) =>
    list.flatMap((entry) => entry.hooks.map((hook) => hook.command))
  )
  assert.ok(commands.includes('node "$CLAUDE_PROJECT_DIR/harness/tools/runtime-hooks/guard-shell.mjs"'))
  assert.ok(commands.includes(OWN_HOOK) && commands.includes(OLD_HOOK), 'nothing of the project’s own is removed')
  assert.deepEqual(settings.permissions.allow, ['Bash(ls:*)'])
  assert.match(output, /the hook `node scripts\/own-hook\.mjs` is the project's own/)

  // The entry file keeps its text and gets the blocks
  const entry = readFileSync(join(root, 'AGENTS.md'), 'utf8')
  assert.ok(entry.startsWith(OWN_ENTRY))
  assert.match(entry, /Never merge on Fridays/)
  assert.match(entry, /<!-- harness:begin git-rules -->\n[\s\S]+<!-- harness:end git-rules -->/)

  // The report names what the framework replaces; those scripts are all still there; nothing is committed
  assert.match(
    output,
    /Replaced by the framework, remove it in your pull request: scripts\/check-markdown-links\.mjs \(`harness check links`\)/
  )
  assert.match(output, /Replaced by the framework, remove it in your pull request: \.githooks\/pre-push/)
  assert.match(output, /A project check, left in place and run by `harness check all`: node scripts\/check-assets\.mjs/)
  for (const path of [
    'scripts/check-markdown-links.mjs',
    'scripts/local-gate.mjs',
    '.githooks/pre-push',
    'scripts/check-assets.mjs'
  ]) {
    assert.ok(existsSync(join(root, path)), `${path} is still there`)
  }
  assert.equal(git(root, 'rev-parse', 'HEAD'), head)
  assert.equal(git(root, 'symbolic-ref', '--short', 'HEAD'), 'develop')
  assert.match(output, /Next steps \(yours\)/)
  assert.doesNotMatch(
    output,
    /Replaced by the framework, remove it in your pull request: scripts\/harness-profile\.json/,
    'the profile file was moved, not left to remove'
  )
})

test('adopt runs the project check inside harness check all, so a failing one fails the adoption', async () => {
  const root = legacyProject()
  writeFileSync(join(root, 'scripts', 'check-assets.mjs'), 'process.exit(1)\n')
  git(root, 'commit', '--quiet', '--no-verify', '-am', 'a failing check')
  const { code, output } = await harness(root, ['adopt', '--non-interactive'])
  assert.equal(code, 1)
  assert.match(output, /the project check `node scripts\/check-assets\.mjs` failed/)
})

test('adopt refuses a project that has the framework, and one that has no profile file to adopt', async () => {
  const adopted = legacyProject()
  assert.equal((await harness(adopted, ['adopt', '--non-interactive'])).code, 0)
  const again = await harness(adopted, ['adopt', '--non-interactive'])
  assert.equal(again.code, 1)
  assert.match(again.output, /uses the framework already/)

  const empty = fresh()
  const none = await harness(empty, ['adopt', '--non-interactive'])
  assert.equal(none.code, 1)
  assert.match(none.output, /there is no profile file to adopt/)
})

test('adopt needs a required role the profile file lacks, as init does, and names its flag', async () => {
  const root = legacyProject()
  const path = join(root, 'scripts', 'harness-profile.json')
  writeFileSync(path, JSON.stringify({ project: { name: 'legacy' }, adapters: { stacks: ['node-ts'] } }))
  git(root, 'commit', '--quiet', '--no-verify', '-am', 'a profile without a repository')

  const refused = await harness(root, ['adopt', '--non-interactive'])
  assert.equal(refused.code, 1)
  assert.match(refused.output, /no value for repository\.slug \(--repository\)/)
  assert.ok(existsSync(path), 'nothing was moved')

  const answered = await harness(root, ['adopt', '--non-interactive', '--repository', 'acme/legacy'])
  assert.equal(answered.code, 0, answered.output)
  assert.equal(JSON.parse(readFileSync(join(root, 'harness-profile.json'), 'utf8')).repository.slug, 'acme/legacy')
})

test('a profile file that the schema does not accept fails the adoption before anything is moved', async () => {
  const root = legacyProject()
  const path = join(root, 'scripts', 'harness-profile.json')
  const profile = JSON.parse(readFileSync(path, 'utf8'))
  writeFileSync(path, JSON.stringify({ ...profile, oldKey: { x: 1 } }))
  git(root, 'commit', '--quiet', '--no-verify', '-am', 'a key of an older format')

  const { code, output } = await harness(root, ['adopt', '--non-interactive'])
  assert.equal(code, 1)
  assert.match(output, /oldKey: not a role of the schema/)
  assert.ok(existsSync(path), 'the profile file did not move')
  assert.ok(!existsSync(join(root, 'harness-profile.json')) && !existsSync(join(root, 'harness')))
  assert.equal(git(root, 'status', '--porcelain'), '')
})
