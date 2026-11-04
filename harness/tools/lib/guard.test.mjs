import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { refusal as refusalWith, simpleCommands } from './guard.mjs'

const PROTECTED = ['main', 'develop']
const refusal = (command, branch, merge) => refusalWith(command, branch, { protectedBranches: PROTECTED, merge })

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
    `for c in 'git push origin --delete feature/x' 'git push origin main'; do\n  echo "{\\"tool_input\\":{\\"command\\":\\"$c\\"}}" | node guard-shell.mjs\ndone`,
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

test('--no-verify is refused on a commit and a push, in every spelling, and --dry-run style flags are not mistaken for it', () => {
  for (const command of [
    'git push --no-verify',
    'git push --no-verify origin feature/x',
    'git commit --no-verify -m x',
    'git commit -n -m x',
    'git commit -anm x',
    'cd api && git push origin feature/x --no-verify'
  ]) {
    assert.match(refusal(command, 'feature/x'), /--no-verify.*owner/, command)
  }
  for (const command of [
    'git push -n origin feature/x',
    'git commit -m "x --no-verify"',
    'echo git push --no-verify',
    'git commit -m x',
    'git push -u origin feature/x'
  ]) {
    assert.equal(refusal(command, 'feature/x'), null, command)
  }
})

test('the merge guard of a host without protection refuses a merge whose check says no, and lets every other command through', () => {
  const merge = {
    isMerge: (words) => words[0] === 'gh' && words[2] === 'merge',
    check: () => 'No merge while a required check is not green: verify'
  }
  assert.match(refusal('gh pr merge 12 --squash', 'feature/x', merge), /No merge while/)
  assert.match(refusal('npm test && gh pr merge 12', 'feature/x', merge), /No merge while/)
  assert.equal(refusal('gh pr view 12', 'feature/x', merge), null)
  assert.equal(refusal('gh pr merge 12', 'feature/x', { ...merge, check: () => null }), null)
  assert.equal(
    refusal('gh pr merge 12', 'feature/x'),
    null,
    'a host that protects its branches refuses the merge itself'
  )
})

// Two clones: the project (`/work/app`) and others, each on a branch; a path that is no repository answers null
const BRANCHES = {
  '/work/app': 'develop',
  '/work/task': 'feature/3.1-x',
  '/work/main': 'main',
  '/work/app/sub': 'develop'
}
const GIT_DIRS = { '/work/task/.git': 'feature/3.1-x', '/work/main/.git': 'main' }
const branchOf = ({ cwd, gitDir }) => (gitDir ? GIT_DIRS[resolve(cwd, gitDir)] : BRANCHES[cwd]) ?? null
const inRepository = (command, project = '/work/app') =>
  refusalWith(command, BRANCHES[project], { protectedBranches: PROTECTED, cwd: project, branchOf })

test('a Git command is judged by the branch of the repository it acts on, not the project: a `cd` before it, `-C`, `--git-dir`', () => {
  // the project is on develop; the other clone is on a task branch, so the command is allowed
  for (const command of [
    'cd /work/task && git commit -m x',
    'git -C /work/task commit -m x',
    'git -C ../task commit -m x',
    'cd .. && git -C task commit -m x',
    'git --git-dir=/work/task/.git commit -m x',
    'git --git-dir /work/task/.git push origin HEAD',
    'GIT_DIR=/work/task/.git git commit -m x',
    'cd /work/task && git status && git commit -m x',
    'cd /work/task\ngit commit -m x'
  ]) {
    assert.equal(inRepository(command), null, command)
  }
  // the project is on a task branch; the other clone is on an integration or production branch, so the command is refused
  for (const command of [
    'cd /work/main && git commit -m x',
    'git -C /work/main push',
    'git --git-dir=/work/main/.git commit -m x',
    'cd /work && git -C main commit -m x',
    'cd /work/app && git commit -m x',
    'bash -c "cd /work/main && git commit -m x"'
  ]) {
    assert.match(inRepository(command, '/work/task'), /You are on (main|develop)/, command)
  }
  assert.match(inRepository('cd /work/main && git commit -m x', '/work/task'), /You are on main in \/work\/main/)
})

test('a `cd` inside parentheses ends with them, and a relative `cd` is taken from the directory the command runs in', () => {
  assert.match(inRepository('(cd /work/task && git status); git commit -m x'), /You are on develop/)
  assert.equal(inRepository('(cd /work/task && git commit -m x)'), null)
  assert.equal(inRepository('(cd /work/main && ls); git commit -m x', '/work/task'), null)
  assert.match(inRepository('cd sub && git commit -m x'), /You are on develop/)
  assert.equal(inRepository('git -C . log && git status', '/work/main'), null)
})

test('a repository that cannot be resolved is judged as protected, and a branch made there is its branch', () => {
  for (const command of [
    'cd /nowhere && git commit -m x',
    'cd "$CLONE" && git commit -m x',
    'cd ~/nowhere && git push',
    'cd - && git commit -m x',
    'git -C /nowhere commit -m x',
    'git --work-tree /work/task commit -m x',
    'git --git-dir=/nowhere/.git commit -m x',
    'popd && git commit -m x'
  ]) {
    assert.match(inRepository(command, '/work/task'), /cannot be told/, command)
  }
  assert.equal(inRepository('cd /nowhere && git checkout -b feature/y && git commit -m x', '/work/task'), null)
  assert.equal(inRepository('git -C /nowhere switch -c feature/y && git push -u origin feature/y', '/work/task'), null)
  assert.match(
    inRepository('git -C /work/task checkout develop && git -C /work/task commit -m x', '/work/main'),
    /You are on develop in \/work\/task/
  )
})

test('a command that is not a commit or a push is never judged by a repository, and a push to a protected branch is refused from any', () => {
  assert.equal(inRepository('cd /nowhere && git status && git log'), null)
  assert.match(inRepository('cd /work/task && git push origin main'), /Never push to/)
  assert.match(inRepository('git -C /work/task push --delete origin x'), /Never delete/)
})
