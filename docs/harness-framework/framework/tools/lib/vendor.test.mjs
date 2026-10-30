// The vendoring of design §1 on throwaway projects: a framework source (a folder, or a local Git repository), a project with a profile file,
// and the commands sync, check vendored, override, diff and detach.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, test } from 'node:test'
import { readLock } from './lock.mjs'
import { checkVendored, detach, diff, override, selectFiles, sync } from './vendor.mjs'
import { walk } from './tree.mjs'

const made = []
afterEach(() => made.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })))

function tempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  made.push(dir)
  return dir
}

function write(dir, files) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), content)
  }
}

const read = (dir, path) => readFileSync(join(dir, path), 'utf8')
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

function frameworkFiles(version = '0.1.0-dev') {
  return {
    'framework.json': JSON.stringify({
      name: 'harness-framework',
      version,
      distributable: ['core', 'adapters', 'tools', 'framework.json', 'LICENSE']
    }),
    LICENSE: 'MIT License\n',
    'core/method/method.md': '# Method\n\nRules by role.\n',
    'tools/git-hooks/pre-push': '#!/bin/sh\nexit 0\n',
    'adapters/stack/node-ts/manifest.json': '{}\n',
    'adapters/stack/python/manifest.json': '{}\n',
    'adapters/runtime/claude-code/manifest.json': '{}\n',
    'adapters/host/github/manifest.json': '{}\n',
    'examples/profile/harness-profile.json': '{}\n',
    'tests/conformance/suite.test.mjs': '// not distributable\n'
  }
}

const PROFILE = {
  adapters: { stacks: [{ adapter: 'node-ts', packages: ['api'] }], runtimes: ['claude-code'], host: 'github' }
}

/** A project with a profile file and a framework source folder inside it, as `bot-rts` holds its staging folder. */
function project() {
  const root = tempDir('harness-project-')
  write(root, { 'harness-profile.json': JSON.stringify(PROFILE) })
  write(join(root, 'framework'), frameworkFiles())
  execFileSync('chmod', ['+x', join(root, 'framework/tools/git-hooks/pre-push')])
  return root
}

const synced = () => {
  const root = project()
  sync({ root, from: 'framework', generators: [] })
  return root
}

test('sync copies the distributable paths and only the selected adapters, byte for byte, and pins them in the lock', () => {
  const root = synced()
  const lock = readLock(root)

  assert.deepEqual(walk(join(root, 'harness')), [
    'LICENSE',
    'adapters/host/github/manifest.json',
    'adapters/runtime/claude-code/manifest.json',
    'adapters/stack/node-ts/manifest.json',
    'core/method/method.md',
    'framework.json',
    'tools/git-hooks/pre-push'
  ])
  assert.equal(read(root, 'harness/core/method/method.md'), '# Method\n\nRules by role.\n')
  assert.ok(statSync(join(root, 'harness/tools/git-hooks/pre-push')).mode & 0o100, 'a hook stays executable')
  assert.equal(lock.mode, 'pinned')
  assert.equal(lock.version, '0.1.0-dev')
  assert.deepEqual(lock.source, { type: 'path', location: 'framework' })
  assert.deepEqual(lock.adapters, { stacks: ['node-ts'], runtimes: ['claude-code'], host: 'github' })
  assert.match(lock.files['core/method/method.md'], /^[0-9a-f]{64}$/)
  assert.match(lock.profile, /^[0-9a-f]{64}$/)
  assert.deepEqual(checkVendored({ root }).problems, [])
})

test('a selected adapter the framework does not have is refused', () => {
  const root = project()
  write(root, { 'harness-profile.json': JSON.stringify({ adapters: { stacks: ['rust'] } }) })

  assert.throws(() => sync({ root, from: 'framework', generators: [] }), /no adapter adapters\/stack\/rust/)
})

test('an edited, removed or added vendored file fails the check, and a sync restores the copy', () => {
  const root = synced()

  write(root, { 'harness/core/method/method.md': '# Method\n\nEdited in place.\n' })
  rmSync(join(root, 'harness/LICENSE'))
  write(root, { 'harness/core/method/extra.md': 'mine\n' })
  const { problems } = checkVendored({ root })
  assert.equal(problems.length, 3)
  assert.match(problems.join('\n'), /harness\/core\/method\/method\.md was edited/)
  assert.match(problems.join('\n'), /harness\/LICENSE is missing/)
  assert.match(problems.join('\n'), /harness\/core\/method\/extra\.md is not part of the framework/)

  sync({ root, generators: [] })
  assert.deepEqual(checkVendored({ root }).problems, [])
  assert.equal(read(root, 'harness/core/method/method.md'), '# Method\n\nRules by role.\n')
})

test('a change of the source folder without a sync fails the check, so the source and the copy change together', () => {
  const root = synced()

  write(root, { 'framework/core/method/method.md': '# Method\n\nImproved at the source.\n' })
  assert.match(
    checkVendored({ root }).problems.join('\n'),
    /the framework source framework changed since the last sync/
  )

  sync({ root, generators: [] })
  assert.deepEqual(checkVendored({ root }).problems, [])
})

test('an override accepts one edited file with its reason and is reported on every check; a further edit or a sync ends it', () => {
  const root = synced()
  write(root, { 'harness/core/method/method.md': '# Method\n\nUrgent local fix.\n' })

  override({ root, path: 'harness/core/method/method.md', reason: 'urgent fix', issue: 'harness-framework#1' })
  const accepted = checkVendored({ root })
  assert.deepEqual(accepted.problems, [])
  assert.match(
    accepted.notes.join('\n'),
    /Override: harness\/core\/method\/method\.md .*urgent fix; harness-framework#1/
  )

  write(root, { 'harness/core/method/method.md': '# Method\n\nAnother edit.\n' })
  assert.match(checkVendored({ root }).problems.join('\n'), /method\.md was edited/)

  const { messages } = sync({ root, generators: [] })
  assert.match(messages.join('\n'), /Dropped the override of core\/method\/method\.md/)
  assert.deepEqual(readLock(root).overrides, [])
})

test('an override needs a reason and an issue, and a vendored file', () => {
  const root = synced()

  assert.throws(
    () => override({ root, path: 'harness/LICENSE', reason: 'x' }),
    /needs the reason and the framework issue/
  )
  assert.throws(() => override({ root, path: 'harness/nope.md', reason: 'x', issue: 'y' }), /not a vendored file/)
})

test('sync --local regenerates the managed files from the vendored tree and the profile file, without the source', () => {
  const root = synced()
  const generators = [{ path: 'docs/generated.md', render: ({ profile }) => `host: ${profile.adapters.host}\n` }]

  rmSync(join(root, 'framework'), { recursive: true })
  sync({ root, local: true, generators })
  assert.equal(read(root, 'docs/generated.md'), 'host: github\n')
  assert.deepEqual(checkVendored({ root }).problems, [])

  write(root, { 'docs/generated.md': 'edited by hand\n' })
  assert.match(checkVendored({ root }).problems.join('\n'), /the managed file docs\/generated\.md differs/)

  write(root, {
    'harness-profile.json': JSON.stringify({ ...PROFILE, adapters: { ...PROFILE.adapters, host: 'gitlab' } })
  })
  assert.match(
    checkVendored({ root }).problems.join('\n'),
    /the profile file changed since the managed files were generated/
  )

  sync({ root, local: true, generators })
  assert.equal(read(root, 'docs/generated.md'), 'host: gitlab\n')
  assert.deepEqual(checkVendored({ root }).problems, [])
})

test('sync --local needs a lock', () => {
  assert.throws(() => sync({ root: project(), local: true, generators: [] }), /no harness\.lock\.json yet/)
})

test('diff prints the local change against the locked version, and names the files when the source is out of reach', () => {
  const root = synced()
  assert.match(diff({ root }), /no change/)

  write(root, { 'harness/core/method/method.md': '# Method\n\nEdited in place.\n' })
  const printed = diff({ root })
  assert.match(printed, /harness\/ against harness-framework 0\.1\.0-dev \(the locked version\): 1 file/)
  assert.match(printed, /^--- a\/harness\/core\/method\/method\.md$/m)
  assert.match(printed, /^-Rules by role\.$/m)
  assert.match(printed, /^\+Edited in place\.$/m)

  rmSync(join(root, 'framework'), { recursive: true })
  assert.match(
    diff({ root }),
    /changed: harness\/core\/method\/method\.md \(the content of the locked version is not within reach\)/
  )
})

test('detach needs a reason and a pinned project', () => {
  assert.throws(() => detach({ root: synced(), reason: ' ' }), /needs a reason/)
  assert.throws(() => detach({ root: project(), reason: 'own it' }), /nothing is vendored/)
})

test('a detached project owns its copy: an edit passes, sync refuses, sync --local regenerates, diff shows the edit against the fork point', () => {
  const root = synced()
  const generators = [{ path: 'docs/generated.md', render: () => 'managed\n' }]
  sync({ root, local: true, generators })

  const { messages } = detach({ root, reason: 'we maintain our own method' })
  assert.match(messages.join('\n'), /Keep harness\/LICENSE/)
  const lock = readLock(root)
  assert.equal(lock.mode, 'detached')
  assert.equal(lock.source, null)
  assert.equal(lock.version, null)
  assert.equal(lock.files, undefined)
  assert.deepEqual(lock.base.source, { type: 'path', location: 'framework' })
  assert.equal(lock.base.version, '0.1.0-dev')
  assert.match(lock.base.files['core/method/method.md'], /^[0-9a-f]{64}$/)

  write(root, { 'harness/core/method/method.md': '# Method\n\nOur own rule.\n' })
  const checked = checkVendored({ root })
  assert.deepEqual(checked.problems, [])
  assert.match(checked.notes.join('\n'), /Detached \(we maintain our own method\)/)

  assert.throws(() => sync({ root, from: 'framework', generators }), /detached from the framework/)

  rmSync(join(root, 'docs/generated.md'))
  sync({ root, local: true, generators })
  assert.equal(read(root, 'docs/generated.md'), 'managed\n')

  const printed = diff({ root })
  assert.match(printed, /against harness-framework 0\.1\.0-dev \(the fork point\)/)
  assert.match(printed, /^\+Our own rule\.$/m)

  rmSync(join(root, 'harness/LICENSE'))
  assert.match(checkVendored({ root }).problems.join('\n'), /harness\/LICENSE is missing: the MIT license/)
})

test('without a lock: nothing to check, or a copy without a lock', () => {
  const root = project()
  assert.deepEqual(checkVendored({ root }), { problems: [], notes: ['No vendored framework in this project.'] })

  write(root, { 'harness/core/a.md': 'a\n' })
  assert.match(checkVendored({ root }).problems.join('\n'), /harness\/ exists but harness\.lock\.json does not/)
})

test('the selection keeps the distributable paths of the manifest only', () => {
  const dir = tempDir('harness-source-')
  write(dir, frameworkFiles())
  const manifest = JSON.parse(read(dir, 'framework.json'))
  const selected = selectFiles(dir, manifest, { stacks: ['python'], runtimes: [], host: null })

  assert.ok(selected.includes('adapters/stack/python/manifest.json'))
  assert.ok(!selected.some((path) => path.startsWith('adapters/stack/node-ts') || path.startsWith('adapters/host')))
  assert.ok(!selected.some((path) => path.startsWith('examples') || path.startsWith('tests')))
})

/** A framework repository with one tagged release, given as a file:// URL (no network). */
function frameworkRepository(tag) {
  const dir = tempDir('harness-repo-')
  write(dir, frameworkFiles('0.1.0'))
  git(dir, 'init', '--quiet', '--initial-branch', 'main')
  git(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '.')
  git(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--quiet', '-m', 'release')
  git(dir, 'tag', tag)
  return { dir, url: `file://${dir}` }
}

test('a Git source: sync takes a tag, records its commit, and refuses the version when its tag has moved', () => {
  const repository = frameworkRepository('v0.1.0')
  const root = project()

  sync({ root, from: repository.url, to: '0.1.0', generators: [] })
  const lock = readLock(root)
  const commit = git(repository.dir, 'rev-parse', 'HEAD').trim()
  assert.deepEqual(lock.source, { type: 'git', url: repository.url, tag: 'v0.1.0', commit })
  assert.deepEqual(lock.seen, { '0.1.0': commit })
  assert.deepEqual(checkVendored({ root }).problems, [])

  // The same version again (no --to: the locked one) is fine while its tag stays
  sync({ root, generators: [] })

  // Someone moves the tag to another commit
  write(repository.dir, { 'core/method/method.md': '# Method\n\nRewritten history.\n' })
  git(repository.dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--quiet', '-am', 'moved')
  git(repository.dir, 'tag', '--force', 'v0.1.0')

  assert.throws(() => sync({ root, generators: [] }), /the tag of 0\.1\.0 moved/)
  assert.equal(read(root, 'harness/core/method/method.md'), '# Method\n\nRules by role.\n', 'the copy is untouched')
})

test('a Git source needs a version and an existing tag', () => {
  const repository = frameworkRepository('0.1.0')
  const root = project()

  assert.throws(() => sync({ root, from: repository.url, generators: [] }), /needs the version to take/)
  assert.throws(() => sync({ root, from: repository.url, to: '9.9.9', generators: [] }), /no tag 9\.9\.9 or v9\.9\.9/)
  sync({ root, from: repository.url, to: '0.1.0', generators: [] })
  assert.equal(readLock(root).source.tag, '0.1.0')
})

test('a folder source holds only its own version', () => {
  assert.throws(
    () => sync({ root: project(), from: 'framework', to: '0.2.0', generators: [] }),
    /holds version 0\.1\.0-dev, not 0\.2\.0/
  )
  assert.throws(() => sync({ root: project(), from: 'nowhere', generators: [] }), /holds no framework\.json/)
})

test('the self mode has nothing to vendor', () => {
  const root = project()
  write(root, {
    'harness.lock.json': JSON.stringify({ framework: 'harness-framework', mode: 'self', managed: {}, profile: null })
  })

  assert.throws(() => sync({ root, from: 'framework', generators: [] }), /mode "self"/)
  assert.throws(() => diff({ root }), /mode "self"/)
  assert.ok(existsSync(join(root, 'harness.lock.json')))
})

test('a managed block is generated inside a file the project owns; only the block is locked, so the text around it is free', () => {
  const root = synced()
  const generators = [
    {
      block: 'map',
      path: () => 'docs/bindings.md',
      render: ({ profile }) => `host: ${profile.adapters.host}\n`
    }
  ]
  const text = (inside) =>
    `# Bindings\nmine\n<!-- harness:begin map -->\n${inside}\n<!-- harness:end map -->\nalso mine\n`

  assert.throws(() => sync({ root, local: true, generators }), /docs\/bindings\.md must exist, with the markers/)
  write(root, { 'docs/bindings.md': 'no markers\n' })
  assert.throws(() => sync({ root, local: true, generators }), /docs\/bindings\.md: the markers .* are missing/)

  write(root, { 'docs/bindings.md': text('stale') })
  sync({ root, local: true, generators })
  assert.equal(read(root, 'docs/bindings.md'), text('host: github'))
  assert.deepEqual(checkVendored({ root, generators }).problems, [])

  write(root, { 'docs/bindings.md': text('host: github').replace('mine', 'edited around the block') })
  assert.deepEqual(checkVendored({ root, generators }).problems, [])

  write(root, { 'docs/bindings.md': text('edited inside the block') })
  assert.match(checkVendored({ root, generators }).problems.join('\n'), /the managed block docs\/bindings\.md differs/)

  write(root, { 'docs/bindings.md': 'the markers are gone\n' })
  assert.match(checkVendored({ root, generators }).problems.join('\n'), /the managed block docs\/bindings\.md differs/)

  write(root, { 'docs/bindings.md': text('stale') })
  sync({ root, local: true, generators })
  assert.deepEqual(checkVendored({ root, generators }).problems, [])
})
