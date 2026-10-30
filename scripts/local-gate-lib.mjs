// The pure part of the local gate (scripts/local-gate.mjs, run by .githooks/pre-push): which checks a push needs, from the files it changes.
// Principle (docs/testing/README.md): run only what the changed files need; the full run is CI's and `npm run test:coverage`.
import { FRAMEWORK_SOURCE } from './framework-tests-lib.mjs'

const SOURCE = /\.(ts|tsx)$/
const IS_DECLARATION_OR_CONFIG =
  /(\.d\.ts$|(^|\/)(jest|next|cypress|eslint|vitest)[.\w-]*\.config\.|(^|\/)tsconfig[^/]*\.json$)/

// The first path segment names the package when it is one of `packages`; `lib`, the root files and the like are shared
function packageOf(file, packages) {
  const [first] = file.split('/')
  return packages.includes(first) && file.includes('/') ? first : null
}

// A changed file that the related-tests search of Jest can follow: TypeScript inside a package, except configuration and Cypress specs
function isRelatable(file) {
  return SOURCE.test(file) && !IS_DECLARATION_OR_CONFIG.test(file) && !hasNoJestTests(file)
}

const isDocumentation = (file) => file.endsWith('.md')
// Files that no check of the gate looks at: the CI configuration and the agent's own settings
const isOutsideTheGate = (file) => file.startsWith('.github/') || file.startsWith('.claude/')
// The Cypress suite is typechecked and linted with its package but has no Jest tests: CI runs it
const hasNoJestTests = (file) => file.includes('/cypress/')
// The staging folder of the framework has tests of its own, and nothing in it feeds the generated files
const isFrameworkSource = (file) => file.startsWith(`${FRAMEWORK_SOURCE}/`)

/**
 * The plan of the local gate for a push.
 * @param {string[]} files the paths the push changes (relative to the repository root)
 * @param {{ packages: string[], integration: string, exists: (file: string) => boolean }} options
 *   `packages` are the packages with a coverage gate; `exists` tells whether a changed path is still there (a deleted one has no related tests)
 * @returns {{ skip: string | null, steps: object[], coveragePackages: string[] }}
 *   `skip` is the reason when no code check is needed; a step is `{ label, command, args, cwd? , ...}`
 */
export function planGate(files, { packages, integration, exists }) {
  const changed = [...new Set(files.filter(Boolean))]

  if (changed.length === 0) {
    return { skip: 'the push changes no file', steps: [], coveragePackages: [] }
  }
  if (changed.every(isDocumentation)) {
    return { skip: 'the push changes only Markdown', steps: [], coveragePackages: [] }
  }

  const relevant = changed.filter((file) => !isDocumentation(file) && !isOutsideTheGate(file))
  const steps = []

  // Files of no package (root configuration, the lock file, `lib/`, the hooks) can change every package: the full run
  const isShared = relevant.some(
    (file) => !packageOf(file, packages) && !file.startsWith('scripts/') && !file.startsWith('docs/')
  )
  const touched = isShared
    ? packages
    : packages.filter((pkg) => relevant.some((file) => packageOf(file, packages) === pkg))

  // Typecheck and lint of the touched packages (the root of the repository for a shared change)
  if (isShared) {
    steps.push({ label: 'typecheck', command: 'npm', args: ['run', 'typecheck'] })
    steps.push({ label: 'lint', command: 'npm', args: ['run', 'lint'] })
  } else {
    for (const pkg of touched) {
      steps.push({ label: `typecheck ${pkg}`, command: 'npm', args: ['run', 'typecheck', '-w', pkg] })
      steps.push({ label: `lint ${pkg}`, command: 'npm', args: ['run', 'lint', '-w', pkg] })
    }
    const formatted = relevant.filter(exists)
    if (formatted.length) {
      steps.push({
        label: 'format changed files',
        command: 'npx',
        args: ['prettier', '--check', '--ignore-unknown', ...formatted]
      })
    }
  }

  // The tests: related to the changed files of a package, or the whole package when a change cannot be followed to its tests
  const coveragePackages = []
  for (const pkg of touched) {
    const own = relevant.filter((file) => packageOf(file, packages) === pkg)
    const followable = own.filter((file) => isRelatable(file) && exists(file))
    const wholePackage =
      isShared || own.some((file) => !isRelatable(file) && !hasNoJestTests(file)) || own.some((file) => !exists(file))

    if (wholePackage) {
      steps.push({
        label: `tests of ${pkg} (the whole package)`,
        command: 'npm',
        args: ['run', 'test:coverage', '-w', pkg],
        needsDatabase: pkg === 'api'
      })
    } else if (followable.length) {
      steps.push({
        label: `tests related to ${followable.length} changed file(s) of ${pkg}`,
        command: 'npx',
        // The package gate is CI's (it needs every test); the changed files are held to the gate below
        args: [
          'jest',
          '--coverage',
          '--coverageThreshold={}',
          '--passWithNoTests',
          '--findRelatedTests',
          ...followable.map((file) => file.slice(pkg.length + 1))
        ],
        cwd: pkg,
        clearsSummary: true,
        needsDatabase: pkg === 'api'
      })
    }
    if (wholePackage || followable.length) {
      coveragePackages.push(pkg)
    }
  }

  if (coveragePackages.length) {
    steps.push({
      label: 'coverage of the changed files',
      command: 'node',
      args: ['scripts/check-changed-coverage.mjs', `origin/${integration}`, ...coveragePackages],
      onlyPackagesWithSummary: true
    })
  }
  if (changed.some((file) => file.startsWith('scripts/'))) {
    steps.push({ label: 'script tests', command: 'npm', args: ['run', 'test:scripts'] })
  }
  if (changed.some(isFrameworkSource)) {
    steps.push({ label: 'framework tests', command: 'npm', args: ['run', 'test:framework'] })
  }

  // Generated files can only go stale through the API, the shared library, the documentation sources or the schema; a change that stays in `mcp/` cannot
  const staysInMcp = relevant.every(
    (file) => file.startsWith('mcp/') || file.startsWith('scripts/') || isFrameworkSource(file)
  )
  if (!staysInMcp) {
    steps.push({ label: 'generated files are up to date', generated: true })
  }

  return { skip: null, steps, coveragePackages }
}

// The files of a push: the pre-push hook gets "<local ref> <local sha> <remote ref> <remote sha>" lines on its standard input
export function rangesOfPush(stdin, integration) {
  const zero = /^0+$/
  const ranges = []

  for (const line of stdin.split('\n').filter(Boolean)) {
    const [, localSha, , remoteSha] = line.split(' ')
    if (!localSha || zero.test(localSha)) {
      continue // deleting a branch
    }
    ranges.push(remoteSha && !zero.test(remoteSha) ? `${remoteSha}..${localSha}` : `origin/${integration}..${localSha}`)
  }

  return ranges
}
