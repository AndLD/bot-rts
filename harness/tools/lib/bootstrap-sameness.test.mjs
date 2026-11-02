// The proof of sameness (design §6.2): the same answers through the three front ends (init with flags, init asked interactively, and the template
// repository's profile file filled by hand or by an agent following BOOTSTRAP.md) give byte-identical trees, and `init --detached` equals a pinned
// bootstrap followed by `harness detach`. Also the bootstrap of a fresh empty repository end to end (design §6.1): the root commit on the
// integration branch, then the production branch, then the hooks; and of a repository whose host made the first commit.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { run } from '../harness.mjs'
import { buildTemplate } from './bootstrap.mjs'
import { readLock } from './lock.mjs'
import { hashTree, walk } from './tree.mjs'
import { detach } from './vendor.mjs'

const dirs = []
const fresh = () => {
  const dir = mkdtempSync(join(tmpdir(), 'bootstrap-'))
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
  // The bootstrap commits: a fixed identity, and none of the machine's own Git configuration (a signing rule, a global hooks path)
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

// Runs the command line on `root`; the exit code and what it printed
async function harness(root, argv, input = '') {
  const lines = []
  const code = await run([...argv, '--root', root], {
    out: (line) => lines.push(line),
    err: (line) => lines.push(line),
    input
  })
  return { code, output: lines.join('\n') }
}

// Every file of a project but the Git folder, with its hash
const treeOf = (root) =>
  hashTree(
    root,
    walk(root).filter((path) => !path.startsWith('.git/'))
  )

const FLAGS = ['--name', 'acme', '--repository', 'acme/shop', '--stack', 'node-ts', '--runtime', 'claude-code']
// The interactive answers in the order of the questions: name, repository, stacks, runtimes, then the defaults (host, coverage gate, branches)
const TYPED = ['acme', 'acme/shop', 'node-ts', 'claude-code', '', '', '', ''].join('\n')
const REASON = 'the project owns its method'

let byFlags

test('the same answers give the same tree through the flags, the interactive questions and the template repository', async () => {
  byFlags = fresh()
  const flags = await harness(byFlags, ['init', '--non-interactive', ...FLAGS])
  assert.equal(flags.code, 0, flags.output)

  const asked = fresh()
  const interactive = await harness(asked, ['init'], TYPED)
  assert.equal(interactive.code, 0, interactive.output)
  assert.match(interactive.output, /Stack adapters \(available: node-ts\): /)
  assert.match(interactive.output, /Production branch \[main\]: /)

  const template = fresh()
  buildTemplate({ out: template })
  const path = join(template, 'harness-profile.json')
  const profile = JSON.parse(readFileSync(path, 'utf8'))
  profile.project.name = 'acme'
  profile.repository.slug = 'acme/shop'
  profile.adapters.stacks = ['node-ts']
  profile.adapters.runtimes = ['claude-code']
  writeFileSync(path, JSON.stringify(profile))
  const filled = await harness(template, ['bootstrap', '--non-interactive'])
  assert.equal(filled.code, 0, filled.output)

  const expected = treeOf(byFlags)
  assert.ok(Object.keys(expected).length > 150)
  assert.deepEqual(treeOf(asked), expected)
  assert.deepEqual(treeOf(template), expected)
})

test('init --detached equals a pinned bootstrap followed by harness detach', async () => {
  const detached = fresh()
  const result = await harness(detached, ['init', '--non-interactive', '--detached', '--reason', REASON, ...FLAGS])
  assert.equal(result.code, 0, result.output)
  assert.equal(readLock(detached).mode, 'detached')

  detach({ root: byFlags, reason: REASON })
  assert.deepEqual(treeOf(detached), treeOf(byFlags))
})

test('a fresh empty repository: the root commit on the integration branch, then the production branch, then the hooks', async () => {
  const root = fresh()
  git(root, 'init', '--quiet')
  const { code, output } = await harness(root, ['init', '--non-interactive', ...FLAGS])
  assert.equal(code, 0, output)

  assert.equal(git(root, 'symbolic-ref', '--short', 'HEAD'), 'develop')
  assert.equal(git(root, 'rev-list', '--count', 'develop'), '1')
  assert.equal(git(root, 'rev-list', '--max-parents=0', 'develop'), git(root, 'rev-parse', 'develop'))
  assert.equal(git(root, 'rev-parse', 'main'), git(root, 'rev-parse', 'develop'))
  assert.equal(git(root, 'config', 'core.hooksPath'), 'harness/tools/git-hooks')
  assert.equal(git(root, 'status', '--porcelain'), '')
  assert.match(output, /git push --no-verify -u origin develop main/)

  // From now on the hooks guard the protected branches: the bootstrap's commit was the last one made on them directly
  writeFileSync(join(root, 'README.md'), 'changed\n')
  const refused = spawnSync('git', ['commit', '--quiet', '-am', 'docs: change'], { cwd: root, encoding: 'utf8' })
  assert.notEqual(refused.status, 0)
  assert.match(refused.stderr, /You are on develop, a protected branch/)
})

test('a repository whose host made the first commit: the integration branch is made from it', async () => {
  const root = fresh()
  git(root, 'init', '--quiet', '--initial-branch', 'main')
  writeFileSync(join(root, '.gitattributes'), '* text=auto\n')
  git(root, 'add', '.gitattributes')
  git(root, 'commit', '--quiet', '-m', 'Initial commit')
  const first = git(root, 'rev-parse', 'HEAD')

  const { code, output } = await harness(root, ['init', '--non-interactive', ...FLAGS])
  assert.equal(code, 0, output)
  assert.equal(git(root, 'symbolic-ref', '--short', 'HEAD'), 'develop')
  assert.equal(git(root, 'rev-parse', 'develop^'), first)
  assert.equal(git(root, 'rev-parse', 'main'), first, 'the production branch the host made is left as it was')
  assert.match(output, /Made develop from the existing commit/)
})
