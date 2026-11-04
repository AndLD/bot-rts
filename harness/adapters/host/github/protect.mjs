// The GitHub host adapter's branch protection (design §4.3 and §7.4), `harness host protect`: one repository ruleset over the production and the
// integration branch (no deletion, no force-push, a pull request for every change, the required checks; administrators may bypass only when
// merging a pull request), and the repository settings: merged branches are kept, and auto-merge is allowed (`host.autoMerge`). It needs repository admin rights and a repository on which
// GitHub offers rulesets (a public one, or a paid plan); `detectProtection` asks the host, and the profile's `host.protection` must agree.
import { spawnSync } from 'node:child_process'

export const RULESET_NAME = 'protected-branches'
// The repository role "admin", whose members may bypass the rules when merging a pull request
const ADMIN_ROLE_ID = 5

/** Runs `gh` with `args`, `input` on its standard input, in `cwd`; `{ status, stdout, stderr }`. */
export function runGh(args, input, cwd) {
  const result = spawnSync('gh', args, { input, cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.error ? String(result.error) : (result.stderr ?? '')
  }
}

/** The ruleset body for a profile: the branches, the required checks, and who may bypass. */
export function buildRuleset(profile) {
  const { production, integration } = profile.branches
  return {
    name: RULESET_NAME,
    target: 'branch',
    enforcement: 'active',
    conditions: { ref_name: { include: [`refs/heads/${production}`, `refs/heads/${integration}`], exclude: [] } },
    bypass_actors: [{ actor_id: ADMIN_ROLE_ID, actor_type: 'RepositoryRole', bypass_mode: 'pull_request' }],
    rules: [
      { type: 'deletion' },
      { type: 'non_fast_forward' },
      {
        type: 'pull_request',
        parameters: {
          required_approving_review_count: 0,
          dismiss_stale_reviews_on_push: false,
          require_code_owner_review: false,
          require_last_push_approval: false,
          required_review_thread_resolution: false
        }
      },
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: true,
          required_status_checks: (profile.requiredChecks ?? []).map((context) => ({ context }))
        }
      }
    ]
  }
}

/**
 * Whether the host can protect the repository, asked of the host: the rulesets of the repository are readable, or the host answers that
 * they need a public repository or a paid plan. Where it can, `admin` says whether the user of the command line administers the repository
 * (`protect` needs that); undefined when the host does not say.
 * @returns {{ available: boolean, reason: string, admin?: boolean }}; an answer that is neither (no network, no rights) is an error, not a guess
 */
export function detectProtection({ slug, cli = runGh }) {
  const answer = cli(['api', `repos/${slug}/rulesets`])
  if (answer.status === 0) {
    const rights = cli(['api', `repos/${slug}`, '--jq', '.permissions.admin'])
    const admin =
      rights.status === 0 && /^(true|false)$/.test(rights.stdout.trim()) ? rights.stdout.trim() === 'true' : undefined
    return { available: true, reason: 'the host offers rulesets for this repository', admin }
  }
  if (/upgrade to github pro|make this repository public/i.test(`${answer.stderr}${answer.stdout}`)) {
    return { available: false, reason: 'the host offers rulesets only for a public repository or a paid plan' }
  }
  throw new Error(`cannot tell whether the host can protect ${slug}: ${(answer.stderr || answer.stdout).trim()}`)
}

/**
 * Applies the protection of the profile to the host. Idempotent: an existing ruleset of the same name is replaced.
 * @returns {{ messages: string[], problems: string[] }}; `problems` is non-empty when the profile and the host disagree, and nothing is changed then
 */
export function protect({ profile, slug = profile.repository.slug, cli = runGh }) {
  const { production, integration } = profile.branches
  const detected = detectProtection({ slug, cli })
  const declared = profile.host?.protection !== false

  if (declared !== detected.available) {
    return {
      messages: [],
      problems: [
        `host.protection is ${declared} in the profile file, but ${detected.reason}; set host.protection to ${detected.available} and run this again`
      ]
    }
  }
  if (!detected.available) {
    return {
      messages: [
        `Nothing to protect: ${detected.reason}. The Git hooks and the agent runtime's hooks hold the branch rules instead.`
      ],
      problems: []
    }
  }

  const call = (args, input) => {
    const answer = cli(args, input)
    if (answer.status !== 0) {
      throw new Error(`gh ${args.slice(0, 3).join(' ')} failed: ${(answer.stderr || answer.stdout).trim()}`)
    }
    return answer.stdout
  }

  const autoMerge = profile.host?.autoMerge ?? true
  call([
    'api',
    '-X',
    'PATCH',
    `repos/${slug}`,
    '-F',
    'delete_branch_on_merge=false',
    '-F',
    `allow_auto_merge=${autoMerge}`
  ])
  const ruleset = JSON.stringify(buildRuleset(profile))
  const existing = JSON.parse(call(['api', `repos/${slug}/rulesets`]) || '[]').find(
    (item) => item.name === RULESET_NAME
  )
  if (existing) {
    call(['api', '-X', 'PUT', `repos/${slug}/rulesets/${existing.id}`, '--input', '-'], ruleset)
  } else {
    call(['api', '-X', 'POST', `repos/${slug}/rulesets`, '--input', '-'], ruleset)
  }
  const messages = [
    `Ruleset ${RULESET_NAME} applied to ${production} and ${integration} in ${slug}`,
    `Merged branches are kept; auto-merge is ${autoMerge ? 'allowed' : 'not allowed'} (host.autoMerge)`
  ]

  // The ruleset replaces the classic branch protection, which cannot exempt administrators from the checks without also letting them push
  for (const branch of [production, integration]) {
    if (cli(['api', '-X', 'DELETE', `repos/${slug}/branches/${branch}/protection`]).status === 0) {
      messages.push(`Removed the classic protection of ${branch}`)
    }
  }
  return { messages, problems: [] }
}
