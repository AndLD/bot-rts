// The framework's own core documents (design §3.2): a project receives `core/` as it is, so a link in it must stay inside `core/`; a project
// document is named by its role instead.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { test } from 'node:test'
import { linkTargets } from './markdown.mjs'
import { walk } from './tree.mjs'

const CORE = join(import.meta.dirname, '..', '..', 'core')

test('every link of the core documents stays inside core/ and names a file that is there', () => {
  const files = walk(CORE).filter((path) => path.endsWith('.md'))
  assert.ok(files.length > 0)
  const outside = []
  for (const file of files) {
    for (const target of linkTargets(readFileSync(join(CORE, file), 'utf8'))) {
      const path = target.split('#')[0]
      if (!path) {
        continue
      }
      const resolved = posix.normalize(posix.join(posix.dirname(file), path))
      if (resolved.startsWith('..') || !files.includes(resolved)) {
        outside.push(`${file}: ${target}`)
      }
    }
  }
  assert.deepEqual(outside, [])
})
