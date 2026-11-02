// Runtime hook (PreToolUse on the shell): `harness/tools/runtime-hooks/guard-shell.mjs`. Refuses the commands of the Git rules (see lib/guard.mjs), and,
// on a host that cannot protect its branches, a merge while a required check is not green (the merge guard of the host adapter).
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { hostModule } from '../lib/host.mjs'
import { refusal } from '../lib/guard.mjs'
import { loadProfile } from '../lib/profile.mjs'
import { runHook } from './io.mjs'

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

/** The result of the hook for an event: a refusal, or nothing. */
export function decide(event, { profile = loadProfile(event.cwd), branch = currentBranch(event.cwd), merge } = {}) {
  if (event.kind !== 'shell') {
    return {}
  }
  const message = refusal(event.command, branch, {
    protectedBranches: [profile.branches?.production, profile.branches?.integration].filter(Boolean),
    merge: merge ?? mergeGuard(profile, { cwd: event.cwd })
  })
  return message ? { block: message } : {}
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runHook((event) => decide(event), { kind: 'shell' })
}
