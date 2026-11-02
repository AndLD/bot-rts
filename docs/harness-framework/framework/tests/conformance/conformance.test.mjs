// The conformance suite (tools/conformance, design §5) run on the presets, which must pass it, and on deliberately broken copies of them, which must fail
// the check that names what is broken. Also `harness adapter test`, and that the skeleton of each axis starts red.
import assert from 'node:assert/strict'
import { cpSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { run } from '../../tools/harness.mjs'
import { listAdapters } from '../../tools/lib/adapters.mjs'
import { FRAMEWORK_DIR, tempDir } from '../../tools/conformance/fixture.mjs'
import { describeRun, runSuite } from '../../tools/conformance/suite.mjs'

const adapterDir = (axis, name) => join(FRAMEWORK_DIR, 'adapters', axis, name)
const failed = ({ results }) => results.filter(({ status }) => status === 'fail')
const failedNames = (suite) => failed(suite).map(({ name }) => name)

/**
 * A copy of a preset in a folder of the same name, with `edits` applied: a file name mapped to its new text, or to a function of its old text. The folder
 * of the copy replaces the preset in the framework copy that the suite builds, so a broken copy is judged by the tools of this framework.
 */
function broken(axis, name, edits) {
  const dir = join(tempDir('conformance-broken-'), name)
  cpSync(adapterDir(axis, name), dir, { recursive: true })
  for (const [file, edit] of Object.entries(edits)) {
    const path = join(dir, file)
    writeFileSync(path, typeof edit === 'function' ? edit(readFileSync(path, 'utf8')) : edit)
  }
  return dir
}

const json = (change) => (text) => JSON.stringify(change(JSON.parse(text)), null, 2)

for (const [axis, name] of [
  ['stack', 'node-ts'],
  ['runtime', 'claude-code'],
  ['host', 'github']
]) {
  test(`the ${axis} preset ${name} passes the conformance suite`, async () => {
    const suite = await runSuite({ dir: adapterDir(axis, name) })
    assert.deepEqual(
      failed(suite).map(({ name: check, message }) => `${check}: ${message}`),
      []
    )
    assert.ok(suite.results.filter(({ status }) => status === 'pass').length >= 8)
  })
}

test('framework.json lists the adapters that the framework ships', () => {
  const listed = JSON.parse(readFileSync(join(FRAMEWORK_DIR, 'framework.json'), 'utf8')).adapters
  const shipped = { stack: [], runtime: [], host: [] }
  listAdapters().forEach(({ axis, name }) => shipped[axis].push(name))
  assert.deepEqual(listed, shipped)
})

test('a stack whose plan runs no tests fails the check that names the tests', async () => {
  const dir = broken('stack', 'node-ts', {
    'gate.mjs': `export const plan = () => ({ steps: [{ label: 'lint', command: 'true', args: [] }], coveragePackages: [] })\n`
  })
  assert.deepEqual(failedNames(await runSuite({ dir })), [
    'gate plan: a source file runs the tests of its package and holds the changed file to the coverage gate'
  ])
})

test('a stack whose plan names another package for a file of one package fails the isolation checks', async () => {
  const dir = broken('stack', 'node-ts', {
    'gate.mjs': `export const plan = () => ({
  steps: [
    { label: 'tests', command: 'npm', args: ['test', '-w', 'web'] },
    { label: 'coverage', command: 'harness', args: ['coverage', 'check-changed', 'origin/develop', 'web'] }
  ],
  coveragePackages: []
})\n`
  })
  const names = failedNames(await runSuite({ dir }))
  assert.ok(names.includes('gate plan: a file of one package leaves the other packages alone'), names.join('\n'))
  assert.ok(names.includes('gate plan: with a second stack each file goes to its own stack'), names.join('\n'))
})

test('a formatter that may download its tool fails', async () => {
  const dir = broken('stack', 'node-ts', {
    'format.mjs': `export const formatCommand = ({ path }) =>
  path.endsWith('.png') || path.endsWith('.zip') ? null : { command: 'npx', args: ['prettier', '--write', path] }\n`
  })
  assert.deepEqual(failedNames(await runSuite({ dir })), [
    'formatter: formats the declared file types, leaves the others, and never downloads a formatter'
  ])
})

test('CI jobs that do not wait for the change detection fail', async () => {
  const dir = broken('stack', 'node-ts', { 'ci-jobs.mjs': (text) => text.replaceAll('needs: changes', 'needs: setup') })
  const names = failedNames(await runSuite({ dir }))
  assert.ok(
    names.includes(
      'CI job layout: jobs that depend on the change detection, one coverage job per package that keeps its coverage'
    ),
    names.join('\n')
  )
})

test('a coverage merge whose summary reports a metric the gate does not know fails', async () => {
  const dir = broken('stack', 'node-ts', {
    'coverage.mjs': (text) => text.replaceAll("'statements', 'branches', 'functions', 'lines'", "'statements', 'cells'")
  })
  assert.deepEqual(failedNames(await runSuite({ dir, only: /^coverage-merge/ })), [
    'coverage-merge: shards become a neutral summary that the coverage gate reads'
  ])
})

test('a manifest that leaves a required role empty fails the manifest check', async () => {
  const dir = broken('stack', 'node-ts', {
    'manifest.json': json((manifest) => {
      delete manifest.roles.linter
      return manifest
    })
  })
  const names = failedNames(await runSuite({ dir, only: /^the manifest/ }))
  assert.deepEqual(names, ['the manifest matches the contract of its axis and the folder carries its name'])
})

test('a runtime whose sample of the refused push is a command the hook lets through fails', async () => {
  const dir = broken('runtime', 'claude-code', {
    'conformance.json': json((conformance) => ({
      ...conformance,
      events: join(adapterDir('runtime', 'claude-code'), 'events'),
      samples: { ...conformance.samples, shellRefused: conformance.samples.shellAllowed }
    }))
  })
  assert.deepEqual(failedNames(await runSuite({ dir })), [
    'guard-shell refuses a push to the production branch and lets an ordinary command through'
  ])
})

test('a packaging that loses the trigger of a procedure fails', async () => {
  const dir = broken('runtime', 'claude-code', {
    'conformance.json': json((conformance) => ({
      ...conformance,
      events: join(adapterDir('runtime', 'claude-code'), 'events')
    })),
    'packaging.mjs': (text) => text.replace('`description: ${procedure.description}`', "'description: none'")
  })
  assert.deepEqual(failedNames(await runSuite({ dir })), [
    'procedure packaging: the text carries the name, the trigger and the steps, and is the same on every run'
  ])
})

test('a host whose protection request leaves out the required checks fails', async () => {
  const dir = broken('host', 'github', {
    'protect.mjs': `export const RULESET_NAME = 'protected'
export const runGh = () => ({ status: 1, stdout: '', stderr: '' })
export const detectProtection = ({ slug, cli }) => (cli(['api', \`repos/\${slug}/rulesets\`]), { available: true, reason: 'offered' })
export const protect = ({ profile, slug, cli }) => {
  cli(['api', '-X', 'POST', \`repos/\${slug}/rulesets\`], JSON.stringify([profile.branches.production, profile.branches.integration]))
  return { messages: [], problems: [] }
}\n`
  })
  const names = failedNames(await runSuite({ dir, only: /^protect/ }))
  assert.deepEqual(names, [
    'protect: sends the branches and the required checks to the host, and changes nothing when the profile and the host disagree'
  ])
})

test('a merge guard that takes every command for a merge fails', async () => {
  const dir = broken('host', 'github', {
    'merge-guard.mjs':
      'export const isMerge = () => true\nexport const mergeTarget = () => undefined\nexport const checkMerge = () => null\n'
  })
  assert.deepEqual(failedNames(await runSuite({ dir, only: /^merge guard/ })), [
    'merge guard: recognises the command that merges a pull request'
  ])
})

for (const [axis, name] of [
  ['stack', 'my-stack'],
  ['runtime', 'my-runtime'],
  ['host', 'my-host']
]) {
  test(`the skeleton of the ${axis} axis fails the suite until it is filled`, async () => {
    const dir = join(tempDir('conformance-skeleton-'), name)
    cpSync(join(FRAMEWORK_DIR, 'adapters', axis, '_skeleton'), dir, { recursive: true })
    const suite = await runSuite({ dir })
    assert.ok(failed(suite).length > 0)
    assert.ok(
      failed(suite).some(({ message }) => /TODO/.test(message)),
      'a check fails on a TODO of the skeleton'
    )
  })
}

test('harness adapter test prints a line per check and exits 0 for a preset, 1 for a broken adapter', async () => {
  const lines = []
  const io = { out: (line) => lines.push(line), err: (line) => lines.push(line) }
  assert.equal(await run(['adapter', 'test', adapterDir('host', 'github'), '--only', '^merge guard'], io), 0)
  assert.deepEqual(lines, [
    'ok   merge guard: recognises the command that merges a pull request',
    'The host adapter github passes 1 checks (0 skipped).'
  ])

  lines.length = 0
  const dir = broken('host', 'github', {
    'merge-guard.mjs':
      'export const isMerge = () => true\nexport const mergeTarget = () => undefined\nexport const checkMerge = () => null\n'
  })
  assert.equal(await run(['adapter', 'test', dir, '--only', '^merge guard'], io), 1)
  assert.match(lines.join('\n'), /^FAIL merge guard: recognises the command that merges a pull request\n {7}/)
  assert.match(lines.at(-1), /fails 1 of 1 checks/)
})

test('describeRun reports a skipped check as skipped and does not count it as a pass or a failure', () => {
  const { lines, passed } = describeRun({
    axis: 'stack',
    name: 'x',
    results: [
      { name: 'a', status: 'pass' },
      { name: 'b', status: 'skip', message: 'the role is empty' }
    ]
  })
  assert.equal(passed, true)
  assert.deepEqual(lines, [
    'ok   a',
    'skip b',
    '       the role is empty',
    'The stack adapter x passes 1 checks (1 skipped).'
  ])
})
