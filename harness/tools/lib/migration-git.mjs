// The Git side of a migration (task 3.14): what a project's repository must look like before a version is taken, the commit the migration makes
// as one, and the restoring of the files it changed. A folder that is no Git repository has no history to undo through; every function says so.
import { execFileSync } from 'node:child_process'

const run = (root, args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).replace(/\n$/, '')

/** True when `root` is inside a Git work tree with at least one commit. */
export function isRepository(root) {
  try {
    run(root, ['rev-parse', '--verify', 'HEAD'])
    return true
  } catch {
    return false
  }
}

export const revisionOf = (root, revision) => run(root, ['rev-parse', revision])
export const headCommit = (root) => run(root, ['rev-parse', 'HEAD'])
export const currentBranch = (root) => {
  try {
    return run(root, ['symbolic-ref', '--short', 'HEAD'])
  } catch {
    return ''
  }
}

/** The text of `path` (relative to `root`) as `commit` holds it; null when the commit does not have it. */
export function fileAt(root, commit, path) {
  try {
    return execFileSync('git', ['show', `${commit}:./${path}`], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    })
  } catch {
    return null
  }
}

/** The paths with uncommitted changes (modified, added, deleted, untracked), relative to the repository's top. */
export function changedPaths(root) {
  const entries = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], {
    cwd: root,
    encoding: 'utf8'
  })
    .split('\0')
    .filter(Boolean)
  const paths = []
  for (let index = 0; index < entries.length; index += 1) {
    paths.push(entries[index].slice(3))
    if (/^[RC]/.test(entries[index])) {
      index += 1
    }
  }
  return paths
}

/** Commits every change of the working tree as one commit; false when there is nothing to commit. */
export function commitEverything(root, message) {
  if (changedPaths(root).length === 0) {
    return false
  }
  run(root, ['add', '--all'])
  run(root, ['commit', '--quiet', '-m', message])
  return true
}

/** The first commit after `start` on the way to HEAD, which is the commit a migration made; null when there is none. */
export function commitAfter(root, start) {
  const commits = run(root, ['rev-list', '--reverse', '--ancestry-path', `${start}..HEAD`])
    .split('\n')
    .filter(Boolean)
  return commits[0] ?? null
}

/** What `commit` changed against its parent: `{ added, changed }` path lists (a deleted or modified file is `changed`). */
export function changesOf(root, commit) {
  const added = []
  const changed = []
  const entries = run(root, ['diff-tree', '--no-commit-id', '--name-status', '--no-renames', '-r', '-z', commit])
    .split('\0')
    .filter(Boolean)
  for (let index = 0; index < entries.length; index += 2) {
    ;(entries[index] === 'A' ? added : changed).push(entries[index + 1])
  }
  return { added, changed }
}

/** Puts `changed` back to their content at `commit` and removes `added`, in the working tree and the index. */
export function restore(root, commit, { added, changed }) {
  if (changed.length) {
    run(root, ['checkout', commit, '--', ...changed])
  }
  if (added.length) {
    run(root, ['rm', '--quiet', '--force', '--', ...added])
  }
}
