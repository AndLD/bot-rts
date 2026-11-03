import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { scaffoldProblems } from '../../../tools/lib/scaffold.mjs'
import { NODE_VERSION, packageName, scaffoldFiles } from './scaffold.mjs'

const dirs = []
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))
const byPath = (files) => Object.fromEntries(files.map((file) => [file.path, file]))

test('a project name becomes a valid package name', () => {
  assert.equal(packageName('My Shop!'), 'my-shop')
  assert.equal(packageName('acme.api'), 'acme.api')
  assert.equal(packageName('***'), 'project')
  assert.equal(packageName(), 'project')
})

test('the package manifest runs the framework and installs the hooks; the lock file lists no dependency', () => {
  const files = byPath(scaffoldFiles({ project: { name: 'Acme' } }))
  const manifest = JSON.parse(files['package.json'].content)
  assert.equal(manifest.name, 'acme')
  assert.equal(manifest.scripts.prepare, 'git config core.hooksPath harness/tools/git-hooks')
  assert.equal(manifest.scripts['docs:check'], 'node harness/tools/harness.mjs check all')
  assert.match(manifest.scripts.lint, /^echo "No linter yet/)
  const lock = JSON.parse(files['package-lock.json'].content)
  assert.equal(lock.lockfileVersion, 3)
  assert.deepEqual(Object.keys(lock.packages), [''])
  assert.deepEqual(files['.nvmrc'].lines, [NODE_VERSION])
  assert.deepEqual(files['.gitignore'].lines, ['node_modules/', 'coverage/', 'dist/'])
})

test('the ignore file of the formatter passes the scaffold check, which requires it to exclude the vendored framework', () => {
  const root = mkdtempSync(join(tmpdir(), 'node-ts-scaffold-'))
  dirs.push(root)
  writeFileSync(join(root, 'harness'), '') // the check looks at a project that has the vendored framework
  const profile = { adapters: { stacks: ['node-ts'] } }
  writeFileSync(join(root, '.prettierignore'), byPath(scaffoldFiles(profile))['.prettierignore'].content)
  assert.deepEqual(scaffoldProblems({ root, profile, runtimes: {} }), [])
})
