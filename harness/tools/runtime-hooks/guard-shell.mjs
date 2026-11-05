// Runtime hook (PreToolUse on the shell): `harness/tools/runtime-hooks/guard-shell.mjs`. Refuses the commands of the Git rules (see lib/guard.mjs), each judged
// by the branch of the repository it acts on, and,
// on a host that cannot protect its branches, a merge while a required check is not green (the merge guard of the host adapter).
import { execFileSync } from 'node:child_process'
import { hostModule } from '../lib/host.mjs'
import { refusal } from '../lib/guard.mjs'
import { loadProfile } from '../lib/profile.mjs'
import { registerLocalAdapters } from '../lib/local-adapters.mjs'
import { runHook } from './io.mjs'
import { isMain } from '../lib/main-module.mjs'

function currentBranch(directory) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
  } catch {
    return ''
  }
}

// The branch checked out in the repository of `{ cwd, gitDir }` (a git dir named by `--git-dir`), '' for a detached head, null when it is no repository
export function branchOf({ cwd, gitDir }) {
  const git = (...args) =>
    execFileSync('git', [...(gitDir ? ['--git-dir', gitDir] : []), ...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
  try {
    return git('symbolic-ref', '--short', 'HEAD')
  } catch {
    try {
      git('rev-parse', '--git-dir')
      return ''
    } catch {
      return null
    }
  }
}

// The merge guard when the host does not protect its branches; undefined when it does (the host refuses the merge itself)
export function mergeGuard(profile, { cwd, module = () => hostModule(profile, 'merge-guard') } = {}) {
  if (profile.host?.protection !== false) {
    return undefined
  }
  const host = module()
  return {
    isMerge: host.isMerge,
    check: (words) => host.checkMerge({ words, cwd, requiredChecks: profile.requiredChecks ?? [] })
  }
}

// The guard of turning on the host's auto-merge, where an agent may not (a pull request into the production branch, a release or a hotfix, or a
// repository with `host.autoMerge` off); undefined when the host adapter has no such guard
export function autoMergeGuard(profile, { cwd, module = () => hostModule(profile, 'merge-guard') } = {}) {
  let host
  try {
    host = module()
  } catch {
    return undefined
  }
  if (!host.isAutoMerge) {
    return undefined
  }
  return {
    isAutoMerge: host.isAutoMerge,
    check: (words) =>
      host.checkAutoMerge({
        words,
        cwd,
        branches: profile.branches,
        enabled: profile.host?.autoMerge ?? profile.host?.protection !== false
      })
  }
}

/** The result of the hook for an event: a refusal, or nothing. */
export function decide(
  event,
  { profile = loadProfile(event.cwd), branch = currentBranch(event.cwd), merge, autoMerge } = {}
) {
  if (event.kind !== 'shell') {
    return {}
  }
  const message = refusal(event.command, branch, {
    protectedBranches: [profile.branches?.production, profile.branches?.integration].filter(Boolean),
    cwd: event.cwd,
    branchOf,
    merge: merge ?? mergeGuard(profile, { cwd: event.cwd }),
    autoMerge: autoMerge ?? autoMergeGuard(profile, { cwd: event.cwd })
  })
  return message ? { block: message } : {}
}

if (isMain(import.meta.url)) {
  await runHook(
    async (event) => {
      await registerLocalAdapters(event.cwd)
      return decide(event)
    },
    { kind: 'shell' }
  )
}
