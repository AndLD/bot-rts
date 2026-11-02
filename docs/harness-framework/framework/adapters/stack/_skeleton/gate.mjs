// The local gate plan of this stack (contract role "local-gate-plan"): which checks a push of these files needs. Principle: run only what the changed files
// need; the full run is CI's.
//
// `plan({ files, packages, integration, exists, isolated })`:
//   files       the changed files this stack owns that count for the gate (documentation is already out)
//   packages    the folders with a coverage gate that this stack owns
//   integration the integration branch (the base of the changed-file coverage)
//   exists      whether a changed path is still there (a deleted file has no related tests)
//   isolated    whether a file cannot change a package's code: it never triggers the full run
// It returns `{ steps, coveragePackages }`. A step is `{ label, command, args, cwd?, package?, clears? }`. End the plan with
// `{ label: 'coverage of the changed files', command: 'harness', args: ['coverage', 'check-changed', '--skip-missing', `origin/${integration}`, ...coveragePackages] }`.
export function plan({ files, packages, integration, exists, isolated }) {
  throw new Error('TODO: write the local gate plan of this stack')
}
