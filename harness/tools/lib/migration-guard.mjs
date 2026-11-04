// What must hold before a version is taken (task 3.14), so that the migration is one commit that `harness rollback` can undo: a branch of its own, no
// other uncommitted change, and the commit and version it starts from recorded in the lock. A folder that is no Git repository has no history to undo
// through, so nothing is checked there.
import { changedPaths, currentBranch, headCommit, isRepository } from './migration-git.mjs'
import { LOCK_FILE, VENDOR_DIR } from './lock.mjs'
import { FIRST_VERSION } from './versions.mjs'

const protectedBranch = (profile) => [profile.branches?.production, profile.branches?.integration].filter(Boolean)

const listed = (paths) => `${paths.slice(0, 5).join(', ')}${paths.length > 5 ? `, and ${paths.length - 5} more` : ''}`

function assertBranch(root, profile, what) {
  const branch = currentBranch(root)
  if (protectedBranch(profile).includes(branch)) {
    throw new Error(
      `${what} refused: you are on ${branch}, a protected branch. Take the version on a branch of its own ` +
        '(`git checkout -b chore/take-framework-version`), so that the migration is one commit that `harness rollback` can undo'
    )
  }
}

/**
 * The start of a `sync`: nothing but the migration may change the working tree, so the tree must be clean.
 * @returns {{ commit: string, version: string } | null} where the migration starts from; null when there is nothing to undo through
 */
export function startOfSync({ root, profile, lock }) {
  if (!lock || !isRepository(root)) {
    return null
  }
  assertBranch(root, profile, 'harness sync')
  const dirty = changedPaths(root)
  if (dirty.length) {
    throw new Error(
      `harness sync refused: there are uncommitted changes (${listed(dirty)}). Commit or stash them first, ` +
        'so that the migration is one commit that `harness rollback` can undo'
    )
  }
  return { commit: headCommit(root), version: lock.version }
}

/**
 * The start of a `migrate`. The tree may hold what the `sync` before it wrote (the vendored copy, the lock, the managed files) and nothing else.
 * Where the sync recorded its start (the commit has not moved), that start stands; after the `sync` of an older version it is recorded here.
 * @returns {{ commit: string, version: string } | null}
 */
export function startOfMigrate({ root, profile, lock }) {
  if (!isRepository(root)) {
    return null
  }
  assertBranch(root, profile, 'harness migrate')
  const written = new Set(Object.keys(lock.managed ?? {}).map((key) => key.split('#')[0]))
  const foreign = changedPaths(root).filter(
    (path) => !(path.startsWith(`${VENDOR_DIR}/`) || path === LOCK_FILE || written.has(path))
  )
  if (foreign.length) {
    throw new Error(
      `harness migrate refused: there are uncommitted changes that a sync does not write (${listed(foreign)}). ` +
        'Commit or stash them first, so that the migration is one commit that `harness rollback` can undo'
    )
  }
  const commit = headCommit(root)
  const recorded = lock.migrations?.start
  return recorded?.commit === commit ? recorded : { commit, version: lock.migrations?.version ?? FIRST_VERSION }
}
