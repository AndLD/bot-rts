// The reader of the host's workflow files (contract role "values-in-host-files"), for `harness check values`.

/** Whether a repository path is a workflow file of this host. */
export const isWorkflowFile = (path) => false

/** The branch triggers of every workflow: `{ file, event, branches }` for each trigger that lists branches. */
export function readTriggers(root) {
  throw new Error('TODO: read the branch triggers of the host')
}

/** The jobs of every workflow: `{ file, id, name }`, where `name` is the status context the host reports. */
export function readJobNames(root) {
  throw new Error('TODO: read the job names of the host')
}
