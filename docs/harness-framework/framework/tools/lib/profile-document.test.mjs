import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { derivedValues, profileDocument, renderProfileDocument, ROLES_PATH } from './profile-document.mjs'
import { readSchema } from './profile.mjs'
import { placeholderPaths } from './render.mjs'

const profile = () => ({
  project: { name: 'demo', title: 'Demo', owner: 'Someone' },
  repository: { slug: 'o/demo', host: 'GitHub' },
  adapters: { stacks: [{ adapter: 'node-ts' }, 'python'], runtimes: ['claude-code'], host: 'github' },
  coverageGate: { statements: 90, branches: 90, functions: 90, lines: 90 },
  requiredChecks: ['verify', 'pr-title'],
  requiredCheckNotes: { verify: 'the tests' },
  branches: {
    production: 'main',
    integration: 'develop',
    productionNote: 'tagged',
    integrationNote: 'default',
    retention: 'kept'
  },
  paths: {
    phases: 'docs/plan/phases',
    planIndex: 'docs/plan/INDEX.md',
    profileFile: 'harness-profile.json',
    profileDocument: 'docs/profile.md'
  },
  commands: { harnessSyncLocal: 'make sync', docsCheck: 'make check', dbUp: 'make db' },
  terms: { stack: 'sx', product: 'px', productGeneric: 'gx', projectValues: 'vx' },
  documents: { rules: 'AGENTS.md', readme: 'README.md', harnessBindings: 'docs/b.md' }
})

test('every placeholder of the template is a role of the schema or a derived value', () => {
  const properties = readSchema().properties
  const known = (path) => {
    const [head, ...rest] = path.split('.')
    if (head === 'derived') {
      return path === 'derived.adapters' || path === 'derived.coverageGate' || path === 'derived.requiredChecks'
    }
    let node = properties[head]
    for (const key of rest) {
      node = node?.properties?.[key]
    }
    return Boolean(node)
  }
  const template = readFileSync(ROLES_PATH, 'utf8')
  // Fields of an item of `contexts` are named by the item schema
  const unknown = placeholderPaths(template).filter((path) => !known(path) && !['name', 'sections'].includes(path))
  assert.deepEqual(unknown, [])
})

test('derived values: the adapters in prose, the coverage gate and the required checks with their notes', () => {
  assert.deepEqual(derivedValues(profile()), {
    adapters: '`node-ts` (stack), `python` (stack), `claude-code` (agent runtime) and `github` (host)',
    coverageGate: '90 % of statements, branches, functions and lines',
    requiredChecks: '`verify` (the tests), `pr-title`'
  })
  const uneven = { ...profile(), coverageGate: { statements: 90, branches: 80, functions: 90, lines: 70 } }
  assert.equal(
    derivedValues(uneven).coverageGate,
    '90 % of statements, 80 % of branches, 90 % of functions, 70 % of lines'
  )
  assert.deepEqual(derivedValues({}), { adapters: '', coverageGate: undefined, requiredChecks: '' })
})

test('the document holds the values, keeps the numbered sections of the profile, and leaves out roles that have no value', () => {
  const text = renderProfileDocument(profile())

  assert.match(text, /^\[← README\]\(\.\.\/README\.md\) · rules: \[`AGENTS\.md`\]\(\.\.\/AGENTS\.md\)$/m)
  assert.match(text, /^\| Project name \| `demo` \(Demo\) \|$/m)
  assert.match(text, /^\| \*\*Production branch\*\* \| `main`; tagged \|$/m)
  assert.match(text, /^\| Plan index \| \[`plan\/INDEX\.md`\]\(\.\/plan\/INDEX\.md\) \|$/m)
  assert.match(text, /^STACK='sx'$/m)
  assert.match(text, /\| `make check` \|$/m)
  assert.ok(!text.includes('Unit and integration tests'))
  const headings = text.match(/^## .+$/gm)
  assert.deepEqual(headings, [
    '## 1. Project',
    '## 2. Quality gates',
    '## 3. Branches and merging',
    '## 4. Plan',
    '## 7. Runtime versions',
    '## 8. Commands',
    '## 9. Review values',
    '## 10. Document map'
  ])
  assert.ok(!text.includes('{{'))
  assert.ok(!text.includes('Product specification'))
})

test('a changed value changes the document, and the sections of a role group come back with its roles', () => {
  const before = renderProfileDocument(profile())
  const changed = { ...profile(), branches: { ...profile().branches, integration: 'trunk' } }
  const after = renderProfileDocument(changed)

  assert.notEqual(after, before)
  assert.match(after, /^\| \*\*Integration branch\*\* \| `trunk`; default \|$/m)

  const withApi = {
    ...profile(),
    api: { prefix: '/v1', versioning: 'v', description: 'd' },
    contexts: [{ name: 'Core', sections: '01' }]
  }
  const text = renderProfileDocument(withApi)
  assert.match(text, /^## 5\. Public API$/m)
  assert.match(text, /^\| Core \| 01 \|$/m)
})

test('the generator writes to the path the profile names', () => {
  assert.equal(profileDocument.path(profile()), 'docs/profile.md')
  assert.equal(profileDocument.render({ profile: profile() }), renderProfileDocument(profile()))
  assert.throws(() => renderProfileDocument({ paths: {} }), /nowhere to write/)
  assert.ok(ROLES_PATH.endsWith(join('profile', 'roles.md')))
})
