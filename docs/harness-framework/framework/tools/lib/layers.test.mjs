import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import {
  checkLayers,
  classify,
  claims,
  coreEntries,
  globToRegExp,
  layerConfig,
  layerMap,
  renderLayerMap
} from './layers.mjs'

const root = mkdtempSync(join(tmpdir(), 'harness-layers-'))
after(() => rmSync(root, { recursive: true, force: true }))

const profile = () => ({
  paths: { profileDocument: 'docs/profile.md' },
  documents: { harnessBindings: 'docs/reviews/bindings.md' },
  layers: {
    scope: ['**/*.md', 'scripts/**', 'harness/**'],
    excluded: ['vendor/LICENSE.md'],
    core: ['AGENTS.md sections 1 7', 'docs/method.md'],
    domain: ['docs/product/**', '!docs/product/archive/**'],
    adapter: ['scripts/**', 'docs/stack.md'],
    state: ['docs/plan/**', 'docs/product/archive/**'],
    entry: ['AGENTS.md', 'README.md']
  }
})

function project(name, lock) {
  const dir = join(root, name)
  mkdirSync(dir, { recursive: true })
  if (lock) {
    writeFileSync(join(dir, 'harness.lock.json'), JSON.stringify(lock))
  }
  return dir
}

const FILES = [
  'AGENTS.md',
  'README.md',
  'docs/method.md',
  'docs/stack.md',
  'docs/product/a.md',
  'docs/product/archive/old.md',
  'docs/plan/p.md',
  'docs/profile.md',
  'docs/reviews/bindings.md',
  'scripts/run.mjs',
  'vendor/LICENSE.md',
  'src/code.ts'
]

test('globs: a star stays in one folder, a double star crosses folders, ? is one character, the rest is literal', () => {
  assert.ok(globToRegExp('docs/*.md').test('docs/a.md'))
  assert.ok(!globToRegExp('docs/*.md').test('docs/x/a.md'))
  assert.ok(globToRegExp('docs/**').test('docs/x/y/a.md'))
  assert.ok(globToRegExp('**/*.md').test('a.md'))
  assert.ok(globToRegExp('**/*.md').test('x/y/a.md'))
  assert.ok(globToRegExp('a?.md').test('ab.md'))
  assert.ok(!globToRegExp('a.md').test('axmd'))
})

test('a pattern list claims a path when a positive pattern matches and no negated one does', () => {
  const patterns = ['docs/**', '!docs/archive/**']
  assert.ok(claims(patterns, 'docs/a.md'))
  assert.ok(!claims(patterns, 'docs/archive/a.md'))
  assert.ok(!claims(patterns, 'src/a.md'))
  assert.ok(!claims([], 'a.md'))
})

test('core entries: a path, optionally followed by the sections that are CORE', () => {
  assert.deepEqual(coreEntries(['AGENTS.md sections 1 7', 'docs/method.md']), [
    { path: 'AGENTS.md', sections: ['1', '7'] },
    { path: 'docs/method.md', sections: null }
  ])
  assert.deepEqual(coreEntries(), [])
})

test('the map adds what the tools know: the vendored copy, the profile files and bindings, the framework source folder', () => {
  const none = layerConfig(project('no-lock'), profile())
  assert.deepEqual(none.layers.core, [])
  assert.deepEqual(none.excluded, ['vendor/LICENSE.md'])

  const config = layerConfig(project('lock', { source: { type: 'path', location: 'framework' } }), profile())
  assert.deepEqual(config.layers.core, ['harness/**'])
  assert.deepEqual(config.excluded, ['vendor/LICENSE.md', 'framework/**'])
  assert.deepEqual(config.layers.profile, [
    'harness-profile.json',
    'harness.lock.json',
    'docs/profile.md',
    '**/bindings.md'
  ])
  assert.equal(layerConfig(project('absent'), {}), null)
})

test('every file of the scope is in exactly one layer; a core entry with sections may share its file with another layer', () => {
  const config = layerConfig(project('ok', { source: { type: 'git' } }), profile())
  const { classes, problems } = classify([...FILES, 'harness/README.md'], config)

  assert.deepEqual(problems, [])
  assert.deepEqual(classes.get('AGENTS.md'), ['core', 'entry'])
  assert.deepEqual(classes.get('docs/method.md'), ['core'])
  assert.deepEqual(classes.get('docs/product/archive/old.md'), ['state'])
  assert.deepEqual(classes.get('docs/reviews/bindings.md'), ['profile'])
  assert.deepEqual(classes.get('harness/README.md'), ['core'])
  assert.ok(!classes.has('vendor/LICENSE.md'))
  assert.ok(!classes.has('src/code.ts'))
})

test('an unclassified file fails the check, naming it', () => {
  const config = layerConfig(project('unclassified', { source: { type: 'git' } }), profile())
  const { problems } = classify([...FILES, 'docs/new-document.md'], config)
  assert.deepEqual(problems, [
    'docs/new-document.md: belongs to no layer; add it to a layer of `layers` in the profile file'
  ])
})

test('a file in two layers fails, and so does a core entry that is not there', () => {
  const doubled = profile()
  doubled.layers.entry.push('docs/stack.md')
  doubled.layers.core.push('docs/gone.md')
  const config = layerConfig(project('doubled', { source: { type: 'git' } }), doubled)
  const { problems } = classify(FILES, config)
  assert.deepEqual(problems, [
    'docs/stack.md: belongs to 2 layers (adapter, entry); a file has exactly one',
    'docs/gone.md: listed as CORE in `layers.core` but not found'
  ])
})

test('checkLayers reads the files it is given and passes a project with no layers', () => {
  const dir = project('check', { source: { type: 'git' } })
  assert.deepEqual(checkLayers({ root: dir, profile: profile(), files: FILES }), [])
  assert.equal(checkLayers({ root: dir, profile: profile(), files: [...FILES, 'docs/x.md'] }).length, 1)
  assert.deepEqual(checkLayers({ root: dir, profile: {}, files: ['anything.md'] }), [])
})

test('the rendered map names each layer once, with its patterns, its exceptions and what is left out', () => {
  const text = renderLayerMap(
    layerConfig(project('render', { source: { type: 'path', location: 'framework' } }), profile())
  )
  const rows = text.split('\n').filter((line) => line.startsWith('| **'))

  assert.deepEqual(
    rows.map((row) => row.split('|')[1].trim()),
    ['**CORE**', '**DOMAIN**', '**ADAPTER**', '**PROFILE**', '**STATE**', '**ENTRY**']
  )
  assert.match(rows[0], /`AGENTS\.md` \(sections 1, 7\), `docs\/method\.md`, `harness\/\*\*` \(the vendored copy\)/)
  assert.match(rows[1], /`docs\/product\/\*\*`, except `docs\/product\/archive\/\*\*`/)
  assert.match(text, /Not in the map: `vendor\/LICENSE\.md`, `framework\/\*\*`\./)
})

test('the generator writes into the bindings of the profile, and only when the profile has layers', () => {
  assert.equal(layerMap.block, 'layers')
  assert.equal(layerMap.path(profile()), 'docs/reviews/bindings.md')
  assert.equal(layerMap.path({}), undefined)
})
