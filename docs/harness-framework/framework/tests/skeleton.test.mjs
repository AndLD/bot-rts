// Keeps the skeleton of the framework true to the layout of the design (section 2): the folders, the manifest, the license and the README.
import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const root = join(import.meta.dirname, '..')
const read = (path) => readFileSync(join(root, path), 'utf8')

const LAYOUT = [
  'core/rules',
  'core/method',
  'core/plan',
  'core/reviews',
  'core/procedures',
  'core/contracts',
  'core/templates',
  'profile',
  'adapters/stack/node-ts',
  'adapters/stack/python',
  'adapters/stack/_skeleton',
  'adapters/runtime/claude-code',
  'adapters/runtime/cursor',
  'adapters/runtime/_skeleton',
  'adapters/host/github',
  'adapters/host/_skeleton',
  'tools/lib',
  'tools/git-hooks',
  'tools/runtime-hooks',
  'tests/conformance',
  'examples/profile',
  'examples/product',
  'examples/plan'
]

test('every folder of the layout exists', () => {
  const missing = LAYOUT.filter((path) => !existsSync(join(root, path)) || !statSync(join(root, path)).isDirectory())
  assert.deepEqual(missing, [])
})

test('framework.json names the framework, a semantic version, the three adapter axes and existing distributable paths', () => {
  const manifest = JSON.parse(read('framework.json'))

  assert.equal(manifest.name, 'harness-framework')
  assert.match(manifest.version, /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/)
  assert.deepEqual(Object.keys(manifest.adapters).sort(), ['host', 'runtime', 'stack'])
  assert.ok(manifest.distributable.length > 0)
  assert.deepEqual(
    manifest.distributable.filter((path) => !existsSync(join(root, path))),
    []
  )
  assert.ok(!manifest.distributable.some((path) => path.startsWith('examples') || path.startsWith('tests')))
})

test('the license is MIT in the name of the owner', () => {
  const license = read('LICENSE')

  assert.match(license, /^MIT License\n/)
  assert.match(license, /^Copyright \(c\) 2026 Andrii Larionov$/m)
})

test('the README states the assumptions of the method', () => {
  const readme = read('README.md')

  assert.match(readme, /^## Assumptions of the method$/m)
  for (const assumption of [/Git Flow/, /pull request/, /Squash merges/, /`Plan:` line/]) {
    assert.match(readme, assumption)
  }
})

test('the changelog has an Unreleased section', () => {
  assert.match(read('CHANGELOG.md'), /^## \[Unreleased\]$/m)
})
