import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { checkProfile, loadProfile, lookup, readSchema, validate, withDefaults } from './profile.mjs'

const root = mkdtempSync(join(tmpdir(), 'harness-profile-'))
after(() => rmSync(root, { recursive: true, force: true }))

const schema = readSchema()
const valid = () => ({
  repository: { slug: 'owner/name' },
  adapters: { stacks: ['node-ts'], host: 'github' },
  coverageGate: { statements: 90, branches: 90, functions: 90, lines: 90 },
  coveragePackages: ['api'],
  requiredChecks: ['verify'],
  branches: { production: 'main', integration: 'develop' },
  paths: { plan: 'docs/plan', phases: 'docs/plan/phases', changelog: 'CHANGELOG.md', changelogFragments: 'changes' },
  terms: { stack: 'a', product: 'b', productGeneric: 'c', projectValues: 'd' }
})

function project(name, profile) {
  const dir = join(root, name)
  mkdirSync(dir, { recursive: true })
  if (profile !== undefined) {
    writeFileSync(join(dir, 'harness-profile.json'), typeof profile === 'string' ? profile : JSON.stringify(profile))
  }
  return dir
}

test('lookup returns the value at a dotted path and fails on an unknown path', () => {
  const sample = { branches: { integration: 'dev' }, list: ['a', 'b'] }
  assert.equal(lookup(sample, 'branches.integration'), 'dev')
  assert.deepEqual(lookup(sample, 'list'), ['a', 'b'])
  assert.throws(() => lookup(sample, 'branches.missing'), /no value "branches.missing"/)
})

test('the reader fills the defaults of the schema into the parts that exist, and does not change the input', () => {
  const input = valid()
  const profile = loadProfile(project('defaults', input), schema)
  assert.equal(profile.repository.host, 'GitHub')
  assert.equal(profile.paths.profileDocument, 'docs/profile.md')
  assert.equal(profile.paths.profileFile, 'harness-profile.json')
  assert.equal(input.repository.host, undefined)
  assert.equal(withDefaults(schema, { repository: { slug: 'a/b', host: 'GitLab' } }).repository.host, 'GitLab')
  assert.equal(withDefaults(schema, 'text'), 'text')
  assert.equal(loadProfile(project('none'), schema).repository, undefined)
})

test('a valid profile file has no problem', () => {
  assert.deepEqual(checkProfile(project('valid', valid()), schema), [])
})

test('the problems name the role: a missing required role, a wrong type, a role the schema lacks, a bad pattern, an empty list', () => {
  const broken = valid()
  delete broken.branches.integration
  broken.coverageGate.lines = 'high'
  broken.extra = true
  broken.repository.slug = 'no-slash'
  broken.requiredChecks = []
  assert.deepEqual(checkProfile(project('broken', broken), schema), [
    'harness-profile.json: repository.slug: "no-slash" does not match ^[^/\\s]+/[^/\\s]+$',
    'harness-profile.json: coverageGate.lines: expected number, found string',
    'harness-profile.json: requiredChecks: needs at least 1 item(s)',
    'harness-profile.json: branches.integration: required, and missing',
    'harness-profile.json: extra: not a role of the schema'
  ])
})

test('a missing file and invalid JSON are reported', () => {
  assert.match(checkProfile(project('missing'), schema)[0], /no profile file/)
  assert.match(checkProfile(project('invalid', '{ nope'), schema)[0], /not valid JSON/)
})

test('a stack is a name or an object with an adapter name; the document must not be the profile file', () => {
  const profile = valid()
  profile.adapters.stacks = ['node-ts', { adapter: 'python', packages: ['svc'] }, { packages: [] }, 3]
  profile.paths.profileDocument = 'harness-profile.json'
  assert.deepEqual(checkProfile(project('stacks', profile), schema), [
    'harness-profile.json: adapters.stacks[2]: a stack is a name or an object with an "adapter" name',
    'harness-profile.json: adapters.stacks[3]: a stack is a name or an object with an "adapter" name',
    'harness-profile.json: paths.profileDocument must not be the profile file itself'
  ])
})

test('validate covers enum, integer and nested items', () => {
  const sample = {
    type: 'object',
    properties: {
      kind: { enum: ['a', 'b'] },
      count: { type: 'integer' },
      rows: { type: 'array', items: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
      free: { type: 'object', additionalProperties: { type: 'string' } }
    }
  }
  assert.deepEqual(validate(sample, { kind: 'a', count: 2, rows: [{ id: 'x' }], free: { k: 'v' } }), [])
  assert.deepEqual(validate(sample, { kind: 'c', count: 1.5, rows: [{}], free: { k: 1 } }), [
    'kind: must be one of a, b',
    'count: expected integer, found number',
    'rows[0].id: required, and missing',
    'free.k: expected string, found number'
  ])
  assert.deepEqual(validate(sample, null), ['(the profile file): expected object, found null'])
})
