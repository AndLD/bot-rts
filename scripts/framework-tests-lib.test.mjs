import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { FRAMEWORK_SOURCE, frameworkTestFiles } from './framework-tests-lib.mjs'

test('lists the test files under the folder, nested ones included, sorted and relative to the root', () => {
  const root = mkdtempSync(join(tmpdir(), 'framework-tests-'))
  try {
    mkdirSync(join(root, 'f/tools/lib'), { recursive: true })
    mkdirSync(join(root, 'f/tests'), { recursive: true })
    for (const file of [
      'tools/lib/b.test.mjs',
      'tests/a.test.mjs',
      'tools/lib/b.mjs',
      'tests/notes.md',
      'top.test.mjs'
    ]) {
      writeFileSync(join(root, 'f', file), '')
    }
    assert.deepEqual(frameworkTestFiles(root, 'f'), ['f/tests/a.test.mjs', 'f/tools/lib/b.test.mjs', 'f/top.test.mjs'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('the real framework folder has at least the skeleton test', () => {
  const files = frameworkTestFiles(join(import.meta.dirname, '..'))
  assert.ok(files.includes(`${FRAMEWORK_SOURCE}/tests/skeleton.test.mjs`))
})
