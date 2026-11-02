// The node-ts stack's files of a new project (design §6.3, role "scaffold-files"): written once by the bootstrap, then the project's. The package
// manifest holds the scripts the commands of the profile run (the linter and the tests say that they are not installed yet, until the project adds
// them), and its `prepare` script installs the Git hooks after every `npm ci`; the lock file lists no dependency yet, so `npm ci` in CI works before
// the project adds any. The ignore file of the formatter excludes the vendored framework.
import { VENDOR_DIR } from '../../../tools/lib/lock.mjs'

export const NODE_VERSION = '22'
export const START_VERSION = '0.1.0'

const json = (value) => `${JSON.stringify(value, null, 2)}\n`

// A script for a tool the project has not installed yet: it says so and passes, so that CI is green on a project with no code; the project
// replaces it when it adds the tool (the stack file)
const placeholder = (role, tools) => `echo "No ${role} yet: install ${tools} and replace this script (the stack file)."`

/** A valid package name from a project name: lower case, with every run of other characters a single dash. */
export function packageName(name = '') {
  return (
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^[-._]+|[-._]+$/g, '') || 'project'
  )
}

/** The files, `{ path, content }`, or `{ path, lines }` for a file that several adapters add lines to. */
export function scaffoldFiles(profile) {
  const name = packageName(profile.project?.name)
  const manifest = {
    name,
    version: START_VERSION,
    private: true,
    scripts: {
      prepare: `git config core.hooksPath ${VENDOR_DIR}/tools/git-hooks`,
      harness: `node ${VENDOR_DIR}/tools/harness.mjs`,
      'docs:check': `node ${VENDOR_DIR}/tools/harness.mjs check all`,
      lint: placeholder('linter', 'ESLint and Prettier'),
      test: placeholder('test runner', 'Jest'),
      'test:coverage': placeholder('test runner', 'Jest with coverage')
    }
  }
  const lock = {
    name,
    version: START_VERSION,
    lockfileVersion: 3,
    requires: true,
    packages: { '': { name, version: START_VERSION } }
  }
  return [
    { path: '.nvmrc', content: `${NODE_VERSION}\n` },
    {
      path: '.prettierignore',
      content: ['node_modules', 'coverage', 'dist', `${VENDOR_DIR}/`, 'harness.lock.json', ''].join('\n')
    },
    { path: 'package.json', content: json(manifest) },
    { path: 'package-lock.json', content: json(lock) },
    { path: '.gitignore', lines: ['node_modules/', 'coverage/', 'dist/'] }
  ]
}
