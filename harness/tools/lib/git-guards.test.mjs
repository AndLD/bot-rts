import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { commitRefusal, guardCommit, guardPush, pushRefusal } from './git-guards.mjs'

const PROTECTED = ['main', 'develop']
const ZERO = '0'.repeat(40)
const SHA = 'a'.repeat(40)
const HOOKS = join(import.meta.dirname, '..', 'git-hooks')
const CLI = join(import.meta.dirname, '..', 'harness.mjs')
const profile = {
  branches: { production: 'main', integration: 'develop' },
  adapters: { stacks: ['node-ts'], host: 'github' }
}

test('a commit on a protected branch is refused, on any other branch allowed, and the root commit of a new repository passes', () => {
  assert.match(
    commitRefusal({ branch: 'develop', hasCommits: true, protectedBranches: PROTECTED }),
    /You are on develop, a protected branch/
  )
  assert.match(commitRefusal({ branch: 'main', hasCommits: true, protectedBranches: PROTECTED }), /You are on main/)
  assert.equal(commitRefusal({ branch: 'feature/1.1-x', hasCommits: true, protectedBranches: PROTECTED }), null)
  assert.equal(
    commitRefusal({ branch: 'develop', hasCommits: false, protectedBranches: PROTECTED }),
    null,
    'the bootstrap makes the root commit on the integration branch'
  )
})

test('a push to a protected remote ref is refused, and so is the deletion of any remote branch; tags and other branches pass', () => {
  const push = (local, localSha, remote) => `${local} ${localSha} ${remote} ${ZERO}`
  assert.match(pushRefusal(push('refs/heads/x', SHA, 'refs/heads/main'), PROTECTED), /Never push to main directly/)
  assert.match(pushRefusal(push('HEAD', SHA, 'refs/heads/develop'), PROTECTED), /Never push to develop/)
  assert.match(pushRefusal(push('(delete)', ZERO, 'refs/heads/old'), PROTECTED), /Never delete a remote branch \(old\)/)
  assert.match(
    pushRefusal(push('(delete)', ZERO, 'refs/heads/main'), PROTECTED),
    /Never delete a remote branch \(main\)/
  )
  assert.equal(pushRefusal(push('refs/heads/x', SHA, 'refs/heads/feature/x'), PROTECTED), null)
  assert.equal(pushRefusal(push('refs/tags/v1', SHA, 'refs/tags/v1'), PROTECTED), null)
  assert.equal(pushRefusal('', PROTECTED), null)
  assert.match(
    pushRefusal([push('a', SHA, 'refs/heads/ok'), push('b', SHA, 'refs/heads/main')].join('\n'), PROTECTED),
    /main/
  )
})

const dirs = []
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

// A repository on `branch`, with the Git hooks of the framework installed and a profile naming the protected branches
function repository(branch) {
  const root = mkdtempSync(join(tmpdir(), 'git-guards-'))
  dirs.push(root)
  const git = (...args) =>
    spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: root, encoding: 'utf8' })
  git('init', '--quiet', '--initial-branch', branch)
  writeFileSync(join(root, 'harness-profile.json'), JSON.stringify(profile))
  git('config', 'core.hooksPath', HOOKS)
  return { root, git }
}

test('the pre-commit hook lets the root commit through on the integration branch and refuses the next one', () => {
  const { root, git } = repository('develop')
  writeFileSync(join(root, 'a.txt'), 'a')
  git('add', '.')
  const first = git('commit', '--quiet', '-m', 'root')
  assert.equal(first.status, 0, first.stderr)
  writeFileSync(join(root, 'a.txt'), 'b')
  git('add', '.')
  const second = git('commit', '--quiet', '-m', 'second')
  assert.notEqual(second.status, 0)
  assert.match(second.stderr, /You are on develop, a protected branch/)
  git('checkout', '--quiet', '-b', 'feature/1.1-x')
  assert.equal(git('commit', '--quiet', '-m', 'second').status, 0)
})

test('guard commands report the message on standard error and exit 1', () => {
  const { root, git } = repository('main')
  writeFileSync(join(root, 'a.txt'), 'a')
  git('add', '.')
  git('commit', '--quiet', '--no-verify', '-m', 'root')
  assert.deepEqual(guardCommit({ root, profile }).code, 1)
  const refused = spawnSync(process.execPath, [CLI, 'guard', 'pre-push', '--root', root], {
    input: `refs/heads/x ${SHA} refs/heads/main ${ZERO}\n`,
    encoding: 'utf8'
  })
  assert.equal(refused.status, 1)
  assert.match(refused.stderr, /Never push to main directly/)
  assert.equal(guardPush({ stdin: `refs/heads/x ${SHA} refs/heads/x ${ZERO}`, profile }).code, 0)
})

test('the pre-push hook refuses a push to a protected branch and a deletion before it runs anything else', () => {
  const { root, git } = repository('develop')
  const remote = mkdtempSync(join(tmpdir(), 'git-guards-remote-'))
  dirs.push(remote)
  execFileSync('git', ['init', '--quiet', '--bare', remote])
  writeFileSync(join(root, 'a.txt'), 'a')
  git('add', '.')
  git('commit', '--quiet', '-m', 'root')
  git('remote', 'add', 'origin', remote)
  git('checkout', '--quiet', '-b', 'feature/x')
  const toProtected = git('push', 'origin', 'feature/x:main')
  assert.notEqual(toProtected.status, 0)
  assert.match(toProtected.stderr, /Never push to main directly/)
  assert.equal(
    git('push', '--no-verify', 'origin', 'feature/x:old').status,
    0,
    'the setup of the test, without the hook'
  )
  const deletion = git('push', 'origin', ':old')
  assert.match(deletion.stderr, /Never delete a remote branch \(old\)/)
})
