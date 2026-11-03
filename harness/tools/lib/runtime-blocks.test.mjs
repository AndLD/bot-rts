import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import { runtimeBlockGenerators } from './runtime-blocks.mjs'
import { checkGenerated, checkVendored, sync } from './vendor.mjs'

const dirs = []
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))
const write = (root, files) =>
  Object.entries(files).forEach(([path, text]) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  })

const profile = (runtimes) => ({
  adapters: { stacks: ['node-ts'], runtimes, host: 'github' },
  access: { denyRead: ['.env', '!.env.example'] }
})
// A runtime adapter of this shape: it gives one block, for the profile
const runtimes = {
  tidy: {
    manifest: { roles: { 'managed-blocks': { module: 'blocks.mjs', export: 'managedBlocks' } } },
    modules: {
      'blocks.mjs': {
        managedBlocks: (given) => [
          { path: '.tidyignore', block: 'deny-read', content: given.access.denyRead.join('\n') }
        ]
      }
    }
  },
  plain: { manifest: { roles: {} }, modules: {} }
}
const generators = runtimeBlockGenerators(runtimes)

function project(runtimeNames, files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'runtime-blocks-'))
  dirs.push(root)
  write(root, {
    'harness-profile.json': JSON.stringify(profile(runtimeNames)),
    'framework/framework.json': JSON.stringify({
      name: 'harness-framework',
      version: '0.1.0-dev',
      distributable: ['core', 'adapters']
    }),
    'framework/core/x.md': 'x\n',
    'framework/adapters/stack/node-ts/manifest.json': '{}',
    'framework/adapters/runtime/tidy/manifest.json': '{}',
    'framework/adapters/host/github/manifest.json': '{}',
    ...files
  })
  sync({ root, from: 'framework', generators: [] })
  return root
}
const read = (root, path) => readFileSync(join(root, path), 'utf8')

test('one generator per runtime that fills the role, and none for a runtime that does not', () => {
  assert.deepEqual(
    generators.map(({ id }) => id),
    ['blocks-tidy']
  )
})

test('the block is made with its file when the runtime is selected, and left out when it is not', () => {
  const root = project(['tidy'])
  sync({ root, local: true, generators })
  assert.equal(read(root, '.tidyignore'), '# harness:begin deny-read\n.env\n!.env.example\n# harness:end deny-read\n')
  assert.deepEqual(checkGenerated({ root, generators }), [])
  assert.deepEqual(checkVendored({ root, generators }).problems, [])

  const other = project([])
  sync({ root: other, local: true, generators })
  assert.equal(existsSync(join(other, '.tidyignore')), false)
})

test('the block is added at the end of a file of the project, whose own lines stay, and a later sync rewrites only the block', () => {
  const root = project(['tidy'], { '.tidyignore': 'dist/\nlocal-notes.txt\n' })
  sync({ root, local: true, generators })
  assert.equal(
    read(root, '.tidyignore'),
    'dist/\nlocal-notes.txt\n\n# harness:begin deny-read\n.env\n!.env.example\n# harness:end deny-read\n'
  )

  write(root, { '.tidyignore': read(root, '.tidyignore').replace('dist/', 'build/') })
  assert.deepEqual(checkGenerated({ root, generators }), [], 'a line of the project is not part of the block')

  write(root, { '.tidyignore': read(root, '.tidyignore').replace('.env\n', '.env\nkeys/\n') })
  assert.match(
    checkGenerated({ root, generators }).join('\n'),
    /the managed block "deny-read" of \.tidyignore is not what/
  )
  assert.match(
    checkVendored({ root, generators }).problems.join('\n'),
    /the managed block "deny-read" of \.tidyignore differs/
  )
  sync({ root, local: true, generators })
  assert.match(
    read(root, '.tidyignore'),
    /^build\/\nlocal-notes\.txt\n\n# harness:begin deny-read\n\.env\n!\.env\.example\n# harness:end/
  )
  assert.deepEqual(checkGenerated({ root, generators }), [])
})
