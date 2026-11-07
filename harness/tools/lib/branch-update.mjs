// `harness branch update`: brings the integration branch into the branch of a task that was stacked on the branch of the previous one, after the
// previous pull request was squash-merged. The squash puts the same changes on the integration branch as new commits, so the merge conflicts
// on every file the two branches changed, though the contents agree: the integration branch has, for such a file, what the previous branch
// has at its tip. The script first takes the previous branch's tip into this branch, if this branch was made from an older commit of it, and then
// resolves exactly those conflicts in favour of this branch (which has all of the previous work and its own on top), and leaves the others, which someone
// else changed, for a person.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { markerLines } from './conflict-markers.mjs'

const run = (root, args, { allowFailure = false } = {}) => {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch (error) {
    if (allowFailure) {
      return null
    }
    throw new Error(`git ${args.join(' ')} failed: ${(error.stderr || error.message).trim()}`)
  }
}

// The content of `path` at `ref`, or null when the ref has no such file
const contentAt = (root, ref, path) => run(root, ['show', `${ref}:${path}`], { allowFailure: true })

/**
 * Merges `origin/<integration>` into the current branch. A conflict in a file whose content on the integration branch is the content it has at
 * the tip of `previous` (the branch this one was stacked on) is resolved to this branch's side; any other conflict is left in the working tree.
 * @param {{ root: string, integration: string, production?: string, previous?: string, fetch?: boolean }} options
 * @returns {{ code: number, messages: string[], problems: string[] }}
 */
export function updateBranch({ root, integration, production, previous, fetch = true }) {
  const branch = run(root, ['symbolic-ref', '--short', 'HEAD'], { allowFailure: true })
  if (!branch) {
    return { code: 1, messages: [], problems: ['The head is detached: check out the branch of the task first.'] }
  }
  if ([integration, production].includes(branch)) {
    return { code: 1, messages: [], problems: [`You are on ${branch}: check out the branch of the task first.`] }
  }
  if (run(root, ['status', '--porcelain', '--untracked-files=no'])) {
    return {
      code: 1,
      messages: [],
      problems: ['The working tree has uncommitted changes: commit or stash them first.']
    }
  }
  if (fetch) {
    run(root, ['fetch', '--quiet', 'origin'])
  }
  const upstream = `origin/${integration}`
  if (run(root, ['merge-base', '--is-ancestor', upstream, 'HEAD'], { allowFailure: true }) !== null) {
    return { code: 0, messages: [`${branch} already has ${upstream}.`], problems: [] }
  }

  // This branch may have been made from an older commit of the previous one: take what the previous branch gained since first, so that "this branch's
  // side" of a conflict has all of the previous branch's work, and resolving to it drops nothing
  const tip = previous ? `origin/${previous}` : null
  if (tip && run(root, ['merge-base', '--is-ancestor', tip, 'HEAD'], { allowFailure: true }) === null) {
    if (run(root, ['merge', '--no-edit', tip], { allowFailure: true }) === null) {
      return {
        code: 1,
        messages: [],
        problems: [
          `Merging ${tip} into ${branch} conflicts in ${run(root, ['diff', '--name-only', '--diff-filter=U']).split('\n').filter(Boolean).join(', ')}. This branch was made from an older commit of ${previous}: resolve these conflicts, commit the merge, and run this again. The merge is left in progress.`
        ]
      }
    }
  }

  if (run(root, ['merge', '--no-edit', upstream], { allowFailure: true }) !== null) {
    return { code: 0, messages: [`Merged ${upstream} into ${branch}; there were no conflicts.`], problems: [] }
  }
  const conflicted = run(root, ['diff', '--name-only', '--diff-filter=U']).split('\n').filter(Boolean)
  if (!previous) {
    return {
      code: 1,
      messages: [],
      problems: [
        `Merging ${upstream} into ${branch} conflicts in ${conflicted.join(', ')}. Name the branch this one was stacked on (--previous <branch>) and run it again, or resolve the conflicts yourself. The merge is left in progress.`
      ]
    }
  }

  const squashOnly = conflicted.filter((path) => contentAt(root, upstream, path) === contentAt(root, tip, path))
  for (const path of squashOnly) {
    if (run(root, ['cat-file', '-e', `:2:${path}`], { allowFailure: true }) === null) {
      run(root, ['rm', '--quiet', '--', path])
    } else {
      run(root, ['checkout', '--ours', '--', path])
      run(root, ['add', '--', path])
    }
  }
  // A file taken from this branch must not hold the markers of an earlier conflict that was committed unresolved: it is not committed as resolved
  const marked = squashOnly.filter((path) => {
    try {
      return markerLines(readFileSync(join(root, path), 'utf8')).length > 0
    } catch {
      return false // removed by the resolution
    }
  })
  const others = conflicted.filter((path) => !squashOnly.includes(path))
  const resolved = squashOnly.length
    ? [`Resolved to ${branch}'s side, the squash of ${previous} only: ${squashOnly.join(', ')}.`]
    : []
  if (marked.length) {
    return {
      code: 1,
      messages: resolved,
      problems: [
        `${marked.join(', ')} still hold(s) merge conflict markers from ${branch}'s side, so it is not resolved: remove the markers, add the file, and commit the merge${others.length ? ` (also in conflict: ${others.join(', ')})` : ''}. The merge is left in progress.`
      ]
    }
  }
  if (others.length) {
    return {
      code: 1,
      messages: resolved,
      problems: [
        `Still in conflict, and not caused by the squash of ${previous} (the content on ${integration} is not what ${previous} had): ${others.join(', ')}. Resolve them, then commit the merge.`
      ]
    }
  }
  run(root, ['commit', '--no-edit', '--quiet'])
  return { code: 0, messages: [`Merged ${upstream} into ${branch}.`, ...resolved], problems: [] }
}
