// The Git guards of the protected branches (design §4.4 and §7.3), run by the Git hooks `pre-commit` and `pre-push` through `harness guard`. They hold the
// rules where no agent runtime sees the command: a commit on a protected branch (except the root commit of a new repository, which the bootstrap
// makes on the integration branch), a push to a protected branch, and the deletion of a remote branch.
import { execFileSync } from 'node:child_process'

const ZERO = /^0+$/

const git = (root, ...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

/** The message that refuses a commit on `branch`, or null. A repository with no commit yet may take its first (root) commit anywhere. */
export function commitRefusal({ branch, hasCommits, protectedBranches }) {
  if (!hasCommits || !protectedBranches.includes(branch)) {
    return null
  }
  return `You are on ${branch}, a protected branch: create a branch named by the Git rules of the entry file (branches) before you commit.`
}

/**
 * The message that refuses a push, or null. `stdin` holds the lines `<local ref> <local sha> <remote ref> <remote sha>` that Git gives the hook.
 * A remote ref of a protected branch is refused, and so is the deletion of any remote branch (an all-zero local object).
 */
export function pushRefusal(stdin, protectedBranches) {
  for (const line of stdin.split('\n').filter(Boolean)) {
    const [, localSha, remoteRef] = line.split(' ')
    const branch = remoteRef?.startsWith('refs/heads/') ? remoteRef.slice('refs/heads/'.length) : null
    if (branch === null) {
      continue
    }
    if (ZERO.test(localSha ?? '')) {
      return `Never delete a remote branch (${branch}): branches are kept for history (the Git rules of the entry file, branch retention).`
    }
    if (protectedBranches.includes(branch)) {
      return `Never push to ${branch} directly: open a pull request (the Git rules of the entry file).`
    }
  }
  return null
}

/** `harness guard pre-commit` on a project: the exit code and the message. */
export function guardCommit({ root, profile }) {
  let branch = ''
  let hasCommits = true
  try {
    branch = git(root, 'symbolic-ref', '--short', 'HEAD')
  } catch {
    return { code: 0 } // a detached head is on no branch
  }
  try {
    git(root, 'rev-parse', '--verify', 'HEAD')
  } catch {
    hasCommits = false
  }
  const message = commitRefusal({ branch, hasCommits, protectedBranches: protectedOf(profile) })
  return message ? { code: 1, message } : { code: 0 }
}

/** `harness guard pre-push`: the exit code and the message for the refs on standard input. */
export function guardPush({ stdin, profile }) {
  const message = pushRefusal(stdin, protectedOf(profile))
  return message ? { code: 1, message } : { code: 0 }
}

const protectedOf = (profile) => [profile.branches?.production, profile.branches?.integration].filter(Boolean)
