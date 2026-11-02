// The GitHub host adapter's reader of workflow files (design §4.3, role "values in host files"): the branch triggers and the job names of
// `.github/workflows/*.yml`, for `harness check values`. The files are read line by line, which is enough for the shapes the templates and
// the project's workflows use (`branches: [a, b]` under `pull_request` and `push`; jobs as keys of `jobs:` with an optional `name:`).
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const WORKFLOWS_DIR = '.github/workflows'

/** Whether a repository path is a workflow file of this host. */
export const isWorkflowFile = (path) => new RegExp(`^${WORKFLOWS_DIR.replace(/\./g, '\\.')}/[^/]+\\.ya?ml$`).test(path)

/** The workflow files of `root`, as repository paths. */
export function workflowFiles(root) {
  const dir = join(root, WORKFLOWS_DIR)
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => /\.ya?ml$/.test(name))
        .sort()
        .map((name) => `${WORKFLOWS_DIR}/${name}`)
    : []
}

const read = (root, file) => readFileSync(join(root, file), 'utf8')

/** The branch triggers of every workflow: `{ file, event, branches }` for each `pull_request` or `push` trigger that lists branches. */
export function readTriggers(root) {
  return workflowFiles(root).flatMap((file) =>
    [...read(root, file).matchAll(/^\s+(pull_request|push):\n\s+branches: \[(.+)\]$/gm)].map((match) => ({
      file,
      event: match[1],
      branches: match[2].split(',').map((branch) => branch.trim().replace(/^['"]|['"]$/g, ''))
    }))
  )
}

/**
 * The jobs of every workflow: `{ file, id, name }`, where `name` is the status context the host reports (the `name:` of the job, or its key).
 * A name with an expression (`${{ … }}`) is kept as written; it cannot be a required check.
 */
export function readJobNames(root) {
  const jobs = []
  for (const file of workflowFiles(root)) {
    let inJobs = false
    let job = null
    for (const line of read(root, file).split('\n')) {
      if (/^jobs:\s*$/.test(line)) {
        inJobs = true
      } else if (/^\S/.test(line)) {
        inJobs = false
      } else if (inJobs) {
        const id = line.match(/^ {2}([\w-]+):\s*$/)
        const name = line.match(/^ {4}name:\s*(.+?)\s*$/)
        if (id) {
          job = { file, id: id[1], name: id[1] }
          jobs.push(job)
        } else if (name && job) {
          job.name = name[1].replace(/^['"]|['"]$/g, '')
          job = null
        }
      }
    }
  }
  return jobs
}
