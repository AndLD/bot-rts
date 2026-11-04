// `harness rollback` (task 3.14): undoes the last migration through Git. The migration is one commit that follows the commit the lock records as its start;
// rollback puts every file that commit changed back to its content at the start, and removes every file it added, and touches nothing else. No step of
// a migration is written to run backwards. The result is left uncommitted, for the person or the agent to review and commit.
import { changedPaths, changesOf, commitAfter, isRepository, restore, revisionOf } from './migration-git.mjs'
import { readLock } from './lock.mjs'

/**
 * @returns {{ messages: string[] }}
 */
export function rollback({ root }) {
  const start = readLock(root)?.migrations?.start
  if (!start) {
    throw new Error(
      'nothing to roll back: the lock records no migration (`harness migrate` records the commit it starts from)'
    )
  }
  if (!isRepository(root)) {
    throw new Error('this folder is no Git repository, so there is no history to roll back through')
  }
  const dirty = changedPaths(root)
  if (dirty.length) {
    throw new Error(
      `uncommitted changes (${dirty.slice(0, 5).join(', ')}): commit or stash them first, so that rollback restores nothing else`
    )
  }
  const commit = commitAfter(root, start.commit)
  if (!commit || revisionOf(root, `${commit}^`) !== start.commit) {
    throw new Error(
      `the commit of the migration is not the one after ${start.commit}: the history changed, restore the files by hand from that commit`
    )
  }

  const changes = changesOf(root, commit)
  restore(root, start.commit, changes)
  const count = changes.added.length + changes.changed.length
  return {
    messages: [
      `Restored ${count} file(s) the migration changed or added (${changes.added.length} removed) to ${start.commit.slice(0, 12)}, the state at version ${start.version}.`,
      'Nothing else was touched, and nothing is committed: review the result with `git status` and commit it.'
    ]
  }
}
