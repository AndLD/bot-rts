import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import {
  ADAPTERS_DIR,
  adapterTerms,
  checkAdapters,
  listAdapters,
  loadHostAdapters,
  manifestProblems,
  readManifestSchema
} from './adapters.mjs'
import { hostModule } from './host.mjs'

const dirs = []
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

// A copy of the adapters of the framework, to break one
function copyOfAdapters() {
  const dir = mkdtempSync(join(tmpdir(), 'adapters-'))
  dirs.push(dir)
  cpSync(ADAPTERS_DIR, dir, { recursive: true })
  return dir
}
const githubIn = (dir) => ({ axis: 'host', name: 'github', dir: join(dir, 'host', 'github') })
const edit = (dir, change) => {
  const path = join(dir, 'host', 'github', 'manifest.json')
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  change(manifest)
  writeFileSync(path, JSON.stringify(manifest))
}
const problemsOf = (dir) =>
  manifestProblems({
    ...githubIn(dir),
    manifest: JSON.parse(readFileSync(join(dir, 'host', 'github', 'manifest.json'), 'utf8'))
  })

test('the github host adapter fills its contract', () => {
  const { adapters, problems } = checkAdapters()
  assert.deepEqual(problems, [])
  assert.ok(adapters.some(({ axis, name }) => axis === 'host' && name === 'github'))
})

test('a folder without a manifest, and a skeleton, are not adapters', () => {
  assert.ok(listAdapters().every(({ name }) => !name.startsWith('_')))
  assert.ok(listAdapters().some(({ axis, name }) => axis === 'stack' && name === 'python'))
  assert.ok(!listAdapters().some(({ axis, name }) => axis === 'stack' && name === 'rust'))
})

test('a required role that is not filled fails, naming the role and the contract', () => {
  const dir = copyOfAdapters()
  edit(dir, (manifest) => delete manifest.roles.release)
  assert.deepEqual(problemsOf(dir), [
    'adapters/host/github/manifest.json: the required role "release" of the host contract is not filled'
  ])
  edit(dir, (manifest) => (manifest.roles.release = { fills: 'x' }) && delete manifest.roles['branch-protection'])
  assert.match(problemsOf(dir)[0], /the logic role "branch-protection" of the host contract is not filled/)
})

test('a role the contract does not know, a logic role without its module, and a file that is missing fail', () => {
  const dir = copyOfAdapters()
  edit(dir, (manifest) => {
    manifest.roles.invented = { fills: 'x' }
    manifest.roles['branch-protection'] = { fills: 'x' }
    manifest.roles.release.file = 'templates/gone.yml'
  })
  const problems = problemsOf(dir).join('\n')
  assert.match(problems, /"invented" is not a role of the host contract/)
  assert.match(problems, /the logic role "branch-protection" needs a module and an export/)
  assert.match(problems, /role "release" names templates\/gone\.yml, which the adapter does not have/)
})

test('a manifest that is not for its folder, or whose terms are no pattern, fails', () => {
  const dir = copyOfAdapters()
  edit(dir, (manifest) => {
    manifest.name = 'other'
    manifest.terms = '('
  })
  const problems = problemsOf(dir).join('\n')
  assert.match(problems, /declares host\/other, but sits in the folder host\/github/)
  assert.match(problems, /terms is not a regular expression/)
  edit(dir, (manifest) => delete manifest.description)
  assert.match(problemsOf(dir)[0], /description: required, and missing/)
})

test('the contract has the roles of all three axes', () => {
  const roles = readManifestSchema()['x-roles']
  assert.deepEqual(Object.keys(roles).sort(), ['host', 'runtime', 'stack'])
  assert.ok(
    Object.values(roles).every((axis) =>
      Object.values(axis).every((kind) => ['required', 'optional', 'logic', 'logic-optional'].includes(kind))
    )
  )
})

test('the terms of every adapter are offered to the CORE scan', () => {
  const terms = adapterTerms()
  assert.ok(terms.some(({ source, pattern }) => source === 'host adapter github' && /github/.test(pattern)))
})

test('the host module that fills a role is found by the profile, and an unknown host or role is named', async () => {
  const hosts = await loadHostAdapters()
  assert.equal(
    typeof hostModule({ adapters: { host: 'github' } }, 'values-in-host-files', hosts).readTriggers,
    'function'
  )
  assert.equal(typeof hostModule({ adapters: { host: 'github' } }, 'branch-protection', hosts).protect, 'function')
  assert.throws(
    () => hostModule({ adapters: { host: 'nowhere' } }, 'branch-protection', hosts),
    /host adapter "nowhere" is not in this copy/
  )
  assert.throws(
    () => hostModule({ adapters: { host: 'github' } }, 'release', hosts),
    /no module for the role "release"/
  )
  assert.throws(() => hostModule({ adapters: {} }, 'release', hosts), /selects no host adapter/)
})
