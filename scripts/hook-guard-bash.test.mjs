import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { refusal } from './hook-guard-bash.mjs'

const SCRIPT = fileURLToPath(new URL('./hook-guard-bash.mjs', import.meta.url))

test('a commit or a push on a protected branch is refused, on a task branch it is allowed', () => {
  for (const branch of ['main', 'develop']) {
    assert.match(refusal('git commit -m "x"', branch), /You are on/)
    assert.match(refusal('git push', branch), /You are on/)
    assert.match(refusal('cd api && git -C . commit -am x', branch), /You are on/)
  }
  assert.equal(refusal('git commit -m "x"', 'feature/3.12-api'), null)
  assert.equal(refusal('git push -u origin docs/15.9-enforcement', 'docs/15.9-enforcement'), null)
})

test('other commands are allowed on a protected branch', () => {
  assert.equal(refusal('git status && git log --oneline', 'develop'), null)
  assert.equal(refusal('git checkout -b feature/x', 'develop'), null)
  assert.equal(refusal('npm test', 'main'), null)
})

test('a push that names a protected branch is refused from any branch', () => {
  for (const command of [
    'git push origin main',
    'git push origin develop',
    'git push origin HEAD:main',
    'git push --force-with-lease origin HEAD:refs/heads/develop'
  ]) {
    assert.match(refusal(command, 'feature/x'), /Never push to main or develop/, command)
  }
  assert.equal(refusal('git push origin feature/develop-notes', 'feature/x'), null)
})

test('the deletion of a remote branch is refused', () => {
  for (const command of [
    'git push origin --delete old',
    'git push origin -d old',
    'git push origin :old',
    'git push origin +:old',
    'gh api -X DELETE repos/o/r/git/refs/heads/old'
  ]) {
    assert.match(refusal(command, 'feature/x'), /Never delete a remote branch/, command)
  }
})

test('as a hook: exit code 2 and the reason on stderr for a refused command, 0 otherwise', () => {
  const run = (event, cwd) =>
    spawnSync('node', [SCRIPT], {
      input: typeof event === 'string' ? event : JSON.stringify(event),
      encoding: 'utf8',
      cwd
    })
  const refused = run({ tool_input: { command: 'git push origin main' }, cwd: process.cwd() })
  assert.equal(refused.status, 2)
  assert.match(refused.stderr, /Never push to/)
  assert.equal(run({ tool_input: { command: 'ls' }, cwd: process.cwd() }).status, 0)
  assert.equal(run({ tool_input: {} }).status, 0)
  assert.equal(run('not json').status, 0)
})
