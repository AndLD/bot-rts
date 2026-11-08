// The GitHub host's files of a new project (design §6.3, role "scaffold-files"): the security policy, the CI workflow, whose frame is this adapter's template and whose
// jobs come from the selected stacks (their role "CI job layout"), the release workflow, and, where the host protects its branches and auto-merge is on,
// the workflow that keeps the pull requests waiting on auto-merge up to date. Written once by the bootstrap; `harness check values`
// then holds the triggers and the required checks.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderTemplate, renderWorkflow, TEMPLATES_DIR, templateContext } from './templates.mjs'

export const WORKFLOWS = '.github/workflows'
// The security policy of the project, where the host looks for it and shows it in the Security tab
export const SECURITY_POLICY = 'SECURITY.md'

/** Whether the project gets the workflow that updates the pull requests waiting on auto-merge: the ruleset requires them up to date, and the agents use auto-merge. */
export const keepsPullRequestsUpToDate = (profile) =>
  profile.host?.protection !== false && (profile.host?.autoMerge ?? true)
// The comment of the CI template that marks where the stacks' jobs go; the jobs replace it
const JOBS_COMMENT = /^ {2}# The jobs of the stack adapter[^\n]*\n(?: {2}#[^\n]*\n)*/m

/**
 * The files for a profile; `jobs` are the CI jobs of each selected stack, `{ ids, yaml }` (the stack's `ciJobs`).
 * @returns {{ path: string, content: string }[]}
 */
export function scaffoldFiles(profile, { jobs = [] } = {}) {
  const ids = jobs.flatMap((job) => job.ids)
  const frame = renderWorkflow('ci.yml', profile, { jobs: ids })
  if (!JOBS_COMMENT.test(frame)) {
    throw new Error('the CI template has lost the comment that marks the place of the jobs of the stacks')
  }
  const ci = frame.replace(JOBS_COMMENT, jobs.map((job) => job.yaml).join('\n'))
  return [
    { path: `${WORKFLOWS}/ci.yml`, content: ci },
    { path: `${WORKFLOWS}/release.yml`, content: renderWorkflow('release.yml', profile) },
    {
      path: SECURITY_POLICY,
      content: renderTemplate(readFileSync(join(TEMPLATES_DIR, 'SECURITY.md'), 'utf8'), templateContext(profile))
    },
    ...(keepsPullRequestsUpToDate(profile)
      ? [{ path: `${WORKFLOWS}/update-branches.yml`, content: renderWorkflow('update-branches.yml', profile) }]
      : [])
  ]
}
