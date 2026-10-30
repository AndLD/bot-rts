// The places of this repository that hold the vendored framework (task 17.4): the documentation check and the pre-push hook run
// `harness check vendored` first, the formatter leaves the copy alone, and the copy in the repository equals its source.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { checkVendored } from '../harness/tools/lib/vendor.mjs'

const root = resolve(import.meta.dirname, '..')
const read = (path) => readFileSync(join(root, path), 'utf8')
const CHECK = 'node harness/tools/harness.mjs check vendored'

test('the documentation check runs the vendored check first', () => {
  const { scripts } = JSON.parse(read('package.json'))
  assert.ok(scripts['docs:check'].startsWith(`${CHECK} && `))
})

test('the pre-push hook runs the vendored check on every push, before the local gate and its documentation-only skip', () => {
  const hook = read('.githooks/pre-push')
  const check = hook.indexOf(CHECK)
  assert.ok(check > 0, 'the hook runs the vendored check')
  assert.ok(check < hook.indexOf('exec node scripts/local-gate.mjs'), 'before the local gate')
  assert.ok(!hook.slice(0, check).includes('exit 0'), 'nothing before it ends the hook')
})

test('the formatter leaves the vendored copy and its lock alone', () => {
  const ignored = read('.prettierignore').split('\n')
  assert.ok(ignored.includes('harness'))
  assert.ok(ignored.includes('harness.lock.json'))
})

test('the vendored copy equals its source and its lock', () => {
  assert.deepEqual(checkVendored({ root }).problems, [])
})
