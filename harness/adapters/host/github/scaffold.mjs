// The GitHub host's files of a new project (design §6.3, role "scaffold-files"): the CI workflow, whose frame is this adapter's template and whose
// jobs come from the selected stacks (their role "CI job layout"), and the release workflow. Written once by the bootstrap; `harness check values`
// then holds the triggers and the required checks.
import { renderWorkflow } from './templates.mjs'

export const WORKFLOWS = '.github/workflows'
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
    { path: `${WORKFLOWS}/release.yml`, content: renderWorkflow('release.yml', profile) }
  ]
}
