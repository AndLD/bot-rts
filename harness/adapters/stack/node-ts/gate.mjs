// The node-ts stack's plan for the local gate (design §4.1, role "local gate plan"): which checks a push of these files needs, run by the gate
// driver (`harness gate`, tools/lib/gate.mjs). Principle: run only what the changed files need; the full run is CI's.
//
// `plan({ files, packages, integration, exists, isolated })`:
//   files       the changed files this stack owns that count for the gate (documentation and files outside the gate are already out)
//   packages    the folders with a coverage gate that this stack owns
//   integration the integration branch (the base of the changed-file coverage)
//   exists      whether a changed path is still there (a deleted file has no related tests)
//   isolated    whether a file cannot change a package's code (the project's `gate.isolated`): it never triggers the full run
// It returns `{ steps, coveragePackages }`; a step is `{ label, command, args, cwd?, package?, clears? }`, and the command `harness` is the framework's own.
// The options that reduce a Jest run to the failing tests and a total, and the coverage to the summary the gate reads (the role `quiet-commands`)
const QUIET_JEST = [
  '--reporters=summary',
  '--silent',
  '--coverageReporters=json-summary',
  '--coverageReporters=text-summary'
]
const SOURCE = /\.(ts|tsx)$/
const IS_DECLARATION_OR_CONFIG =
  /(\.d\.ts$|(^|\/)(jest|next|cypress|eslint|vitest)[.\w-]*\.config\.|(^|\/)tsconfig[^/]*\.json$)/

// The first path segment names the package when it is one of `packages`; the root files and shared folders are no package's
function packageOf(file, packages) {
  const [first] = file.split('/')
  return packages.includes(first) && file.includes('/') ? first : null
}

// The Cypress suite is typechecked and linted with its package but has no Jest tests: CI runs it
const hasNoJestTests = (file) => file.includes('/cypress/')

// A changed file that the related-tests search of Jest can follow: TypeScript inside a package, except configuration and Cypress specs
const isRelatable = (file) => SOURCE.test(file) && !IS_DECLARATION_OR_CONFIG.test(file) && !hasNoJestTests(file)

export function plan({ files, packages, integration, exists, isolated = () => false }) {
  const steps = []
  // Files of no package (root configuration, the lock file, `lib/`, the hooks) can change every package: the full run
  const isShared = files.some((file) => !packageOf(file, packages) && !isolated(file))
  const touched = isShared
    ? packages
    : packages.filter((pkg) => files.some((file) => packageOf(file, packages) === pkg))

  // Typecheck and lint of the touched packages (the root of the repository for a shared change)
  if (isShared) {
    steps.push({ label: 'typecheck', command: 'npm', args: ['run', 'typecheck'] })
    steps.push({ label: 'lint', command: 'npm', args: ['run', 'lint'] })
  } else {
    for (const pkg of touched) {
      steps.push({ label: `typecheck ${pkg}`, command: 'npm', args: ['run', 'typecheck', '-w', pkg] })
      steps.push({ label: `lint ${pkg}`, command: 'npm', args: ['run', 'lint', '-w', pkg] })
    }
    const formatted = files.filter((file) => exists(file))
    if (formatted.length) {
      steps.push({
        label: 'format changed files',
        command: 'npx',
        args: ['--no-install', 'prettier', '--check', '--ignore-unknown', ...formatted]
      })
    }
  }

  // The tests: related to the changed files of a package, or the whole package when a change cannot be followed to its tests
  const coveragePackages = []
  for (const pkg of touched) {
    const own = files.filter((file) => packageOf(file, packages) === pkg)
    const followable = own.filter((file) => isRelatable(file) && exists(file))
    const wholePackage =
      isShared || own.some((file) => !isRelatable(file) && !hasNoJestTests(file)) || own.some((file) => !exists(file))

    if (wholePackage) {
      steps.push({
        label: `tests of ${pkg} (the whole package)`,
        command: 'npm',
        args: ['run', 'test:coverage', '-w', pkg],
        quiet: { args: ['run', '--silent', 'test:coverage', '-w', pkg, '--', ...QUIET_JEST] },
        package: pkg
      })
    } else if (followable.length) {
      steps.push({
        label: `tests related to ${followable.length} changed file(s) of ${pkg}`,
        command: 'npx',
        // The package gate is CI's (it needs every test); the changed files are held to the gate below
        args: [
          '--no-install',
          'jest',
          '--coverage',
          '--coverageThreshold={}',
          '--passWithNoTests',
          '--findRelatedTests',
          ...followable.map((file) => file.slice(pkg.length + 1))
        ],
        quiet: {
          args: [
            '--no-install',
            'jest',
            '--coverage',
            '--coverageThreshold={}',
            '--passWithNoTests',
            ...QUIET_JEST,
            '--findRelatedTests',
            ...followable.map((file) => file.slice(pkg.length + 1))
          ]
        },
        cwd: pkg,
        package: pkg,
        // A run that finds no related tests must not leave the summary of an earlier run to be judged
        clears: [`${pkg}/coverage/coverage-summary.json`]
      })
    }
    if (wholePackage || followable.length) {
      coveragePackages.push(pkg)
    }
  }

  if (coveragePackages.length) {
    steps.push({
      label: 'coverage of the changed files',
      command: 'harness',
      args: ['coverage', 'check-changed', '--skip-missing', `origin/${integration}`, ...coveragePackages]
    })
  }
  return { steps, coveragePackages }
}
