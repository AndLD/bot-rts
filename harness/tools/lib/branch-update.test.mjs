import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { updateBranch } from './branch-update.mjs'

const dirs = []
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

const saved = {}
const GIT_ENV = {
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@t',
  GIT_CONFIG_NOSYSTEM: '1'
}
before(() => {
  // The code under test commits: a fixed identity, and none of the machine's own Git configuration (a signing rule, a global hooks path)
  const folder = mkdtempSync(join(tmpdir(), 'git-config-'))
  dirs.push(folder)
  const config = join(folder, 'gitconfig')
  writeFileSync(config, '')
  for (const [key, value] of Object.entries({ ...GIT_ENV, GIT_CONFIG_GLOBAL: config })) {
    saved[key] = process.env[key]
    process.env[key] = value
  }
})
after(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
})

const git = (cwd, ...args) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()

// An origin with develop; a clone `work` on which task A (a.txt, shared.txt) is built, task B on top of A (shared.txt, b.txt), and A squash-merged into develop
function stackedTasks({ afterSquash, laterOnA = false } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'branch-update-'))
  dirs.push(base)
  const origin = join(base, 'origin.git')
  const work = join(base, 'work')
  git(base, 'init', '--quiet', '--bare', '--initial-branch', 'develop', origin)
  git(base, 'clone', '--quiet', origin, work)
  const write = (name, text) => writeFileSync(join(work, name), text)
  const commit = (message) => {
    git(work, 'add', '-A')
    git(work, 'commit', '--quiet', '-m', message)
  }
  git(work, 'checkout', '--quiet', '-b', 'develop')
  write('shared.txt', 'one\ntwo\nthree\n')
  write('c.txt', 'c\n')
  write('d.txt', 'x\ny\nm\nn\nz\n')
  commit('start')
  git(work, 'push', '--quiet', 'origin', 'develop')

  git(work, 'checkout', '--quiet', '-b', 'feature/a')
  write('a.txt', 'a\n')
  write('shared.txt', 'one\ntwo A\nthree\n')
  if (laterOnA) {
    write('d.txt', 'x\ny A\nm\nn\nz\n')
  }
  commit('task a')
  git(work, 'push', '--quiet', 'origin', 'feature/a')

  git(work, 'checkout', '--quiet', '-b', 'feature/b')
  write('b.txt', 'b\n')
  write('shared.txt', 'one\ntwo A\nthree B\n')
  if (laterOnA) {
    write('d.txt', 'x\ny B\nm\nn\nz\n')
  }
  commit('task b')
  git(work, 'push', '--quiet', 'origin', 'feature/b')
  if (laterOnA) {
    // task a goes on after b was made from it
    git(work, 'checkout', '--quiet', 'feature/a')
    write('d.txt', 'x\ny A\nm\nn\nz A later\n')
    commit('task a, later')
    git(work, 'push', '--quiet', 'origin', 'feature/a')
  }

  git(work, 'checkout', '--quiet', 'develop')
  git(work, 'merge', '--squash', '--quiet', 'feature/a')
  commit('task a (#1)')
  afterSquash?.({ write, commit })
  git(work, 'push', '--quiet', 'origin', 'develop')
  git(work, 'checkout', '--quiet', 'feature/b')
  return { work, origin }
}

const update = (work, options = {}) =>
  updateBranch({ root: work, integration: 'develop', production: 'main', ...options })

test('the conflicts that only the squash of the previous task causes are resolved to this branch, and the merge is committed', () => {
  const { work } = stackedTasks()
  const result = update(work, { previous: 'feature/a' })
  assert.deepEqual(result.problems, [])
  assert.equal(result.code, 0)
  assert.match(result.messages.join('\n'), /Resolved to feature\/b's side, the squash of feature\/a only: shared\.txt/)
  assert.equal(readFileSync(join(work, 'shared.txt'), 'utf8'), 'one\ntwo A\nthree B\n')
  assert.equal(git(work, 'status', '--porcelain'), '')
  assert.equal(git(work, 'merge-base', '--is-ancestor', 'origin/develop', 'HEAD') ?? '', '')
  assert.equal(git(work, 'log', '-1', '--format=%p').split(' ').length, 2, 'a merge commit')
})

test('a conflict the squash did not cause is left for a person, with the merge in progress, and the others are resolved', () => {
  const { work } = stackedTasks({
    afterSquash: ({ write, commit }) => {
      write('shared.txt', 'one\ntwo A\nthree by someone else\n')
      write('a.txt', 'a\n')
      commit('someone else changes shared.txt')
    }
  })
  const result = update(work, { previous: 'feature/a' })
  assert.equal(result.code, 1)
  assert.match(
    result.problems.join('\n'),
    /Still in conflict, and not caused by the squash of feature\/a[^:]*: shared\.txt/
  )
  assert.match(git(work, 'status', '--porcelain'), /^UU shared\.txt/m)
})

test('without --previous a conflict is reported and not guessed, and a branch that has the integration branch is left alone', () => {
  const { work } = stackedTasks()
  const result = update(work)
  assert.equal(result.code, 1)
  assert.match(result.problems[0], /--previous <branch>/)
  git(work, 'merge', '--abort')

  assert.equal(update(work, { previous: 'feature/a' }).code, 0)
  const again = update(work, { previous: 'feature/a' })
  assert.equal(again.code, 0)
  assert.match(again.messages[0], /already has origin\/develop/)
})

test('a branch with no conflict is merged without --previous, and the protected branches and a dirty tree are refused', () => {
  const { work } = stackedTasks({
    afterSquash: ({ write, commit }) => {
      write('c.txt', 'c changed\n')
      commit('unrelated')
    }
  })
  // feature/b conflicts on shared.txt, so use a branch from develop's start instead
  git(work, 'checkout', '--quiet', '-b', 'feature/c', 'origin/develop~2')
  const merged = update(work)
  assert.equal(merged.code, 0, merged.problems.join('\n'))
  assert.match(merged.messages[0], /Merged origin\/develop into feature\/c; there were no conflicts/)

  git(work, 'checkout', '--quiet', 'develop')
  assert.match(update(work).problems[0], /You are on develop/)
  git(work, 'checkout', '--quiet', 'feature/c')
  writeFileSync(join(work, 'c.txt'), 'dirty\n')
  assert.match(update(work).problems[0], /uncommitted changes/)
})

test('a branch made from an older commit of the previous one takes what the previous gained since, and the resolution drops none of it', () => {
  const { work } = stackedTasks({ laterOnA: true })
  const result = update(work, { previous: 'feature/a' })
  assert.deepEqual(result.problems, [])
  assert.equal(result.code, 0)
  assert.equal(readFileSync(join(work, 'd.txt'), 'utf8'), 'x\ny B\nm\nn\nz A later\n', "b's change and a's later one")
  assert.equal(readFileSync(join(work, 'shared.txt'), 'utf8'), 'one\ntwo A\nthree B\n')
  assert.equal(git(work, 'status', '--porcelain'), '')
  assert.equal(git(work, 'merge-base', '--is-ancestor', 'origin/feature/a', 'HEAD') ?? '', '')
})

test('the previous branch is not merged when this branch has it, and a conflict with it is reported with the merge in progress', () => {
  const { work } = stackedTasks()
  assert.equal(update(work, { previous: 'feature/a' }).code, 0)
  assert.doesNotMatch(git(work, 'log', '--format=%s', '-3'), /Merge remote-tracking branch 'origin\/feature\/a'/)

  const clash = stackedTasks({ laterOnA: true })
  writeFileSync(join(clash.work, 'd.txt'), 'x\ny B\nm\nn\nz clash\n')
  git(clash.work, 'add', '-A')
  git(clash.work, 'commit', '--quiet', '-m', 'b changes the line a changes later')
  const result = update(clash.work, { previous: 'feature/a' })
  assert.equal(result.code, 1)
  assert.match(result.problems[0], /conflicts in d\.txt\. This branch was made from an older commit of feature\/a/)
})
