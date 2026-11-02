// The CI job layout of this stack (contract role "ci-job-layout"): the jobs that go between the `changes` job and the aggregator of the host's workflow.
// Every job needs `changes`; each package in `profile.coveragePackages` gets a job that runs its tests with coverage and keeps the raw coverage as the
// artifact `coverage-<package>-1-of-1` (the name `harness coverage merge` reads).
//
// Returns `{ ids, yaml }`: the job ids the aggregator needs, and the text of the jobs, indented as under `jobs:`.
export function ciJobs(profile) {
  throw new Error('TODO: write the CI jobs of this stack')
}
