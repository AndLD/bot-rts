import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { refusal, simpleCommands } from './hook-guard-bash.mjs'

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

test('a protected pattern that is only text is allowed: quotes, heredocs, echo and printf (the false positives of the review)', () => {
  for (const command of [
    // a loop that pipes JSON fixtures holding a deletion into the hook
    `for c in 'git push origin --delete feature/x' 'git push origin main'; do\n  echo "{\\"tool_input\\":{\\"command\\":\\"$c\\"}}" | node scripts/hook-guard-bash.mjs\ndone`,
    `printf 'git push origin develop\\n' > /tmp/fixture.txt`,
    `echo "git push origin --delete old"`,
    `cat <<'EOF' > notes.txt\ngit push origin main\ngit push origin --delete old\nEOF`,
    `cat <<-EOF\n\tgit commit -m x\n\tEOF\nls`,
    `git log --grep="git push origin main"`,
    `git commit -m "docs: never git push origin main or git push --delete"`,
    `gh pr create --body "does not run gh api -X DELETE repos/o/r/git/refs/heads/x"`,
    `grep -rn "push origin develop" docs`
  ]) {
    assert.equal(refusal(command, 'feature/x'), null, command)
  }
  assert.equal(refusal(`git commit -m "x"`, 'feature/x'), null)
})

test('a protected pattern that would run is refused wherever it stands in the command line', () => {
  for (const [command, pattern] of [
    ['echo start && git push origin main', /Never push to/],
    ['cd api; git push origin develop', /Never push to/],
    ['(cd api && git push origin "main")', /Never push to/],
    ['FOO=1 git push origin main', /Never push to/],
    ['sudo git push origin develop', /Never push to/],
    ['git -C /repo push origin HEAD:refs/heads/main', /Never push to/],
    ['bash -c "git push origin main"', /Never push to/],
    ['eval "git push origin --delete old"', /Never delete/],
    ['npm test | git push origin --delete old', /Never delete/],
    ['git push --delete origin old', /Never delete/],
    ['echo done\ngit push origin :old', /Never delete/],
    ['gh api --method DELETE repos/o/r/git/refs/heads/old', /Never delete/],
    ['gh api -XDELETE repos/o/r/git/refs/heads/old', /Never delete/],
    ['cat <<EOF\ntext\nEOF\ngit push origin main', /Never push to/]
  ]) {
    assert.match(refusal(command, 'feature/x'), pattern, command)
  }
  assert.match(refusal('ls && git commit -m x', 'develop'), /You are on develop/)
})

test('a push whose destination is another branch is allowed, and a new branch made in the same command line is the branch', () => {
  assert.equal(refusal('git push origin develop:feature/x', 'feature/y'), null)
  assert.equal(refusal('git checkout -b feature/x origin/develop && git commit -am y', 'develop'), null)
  assert.equal(refusal('git switch -c docs/x && git push -u origin docs/x', 'main'), null)
  assert.match(
    refusal('git checkout -b feature/x && git checkout develop && git push', 'feature/y'),
    /Never push|You are on/
  )
  assert.match(refusal('git checkout feature/x && git commit -am y', 'develop'), /You are on develop/)
})

test('simpleCommands splits on separators and keeps quoted text inside one word', () => {
  assert.deepEqual(simpleCommands(`a b && c 'd e' | f; g "h i"\\ j`), [['a', 'b'], ['c', 'd e'], ['f'], ['g', 'h i j']])
  assert.deepEqual(simpleCommands('x <<EOF\nbody; text\nEOF\ny'), [['x'], ['y']])
  assert.deepEqual(simpleCommands('a \\\n b'), [['a', 'b']])
  assert.deepEqual(simpleCommands("echo 'unclosed"), [['echo', 'unclosed']])
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
