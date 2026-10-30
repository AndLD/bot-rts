// Finds the `node --test` files of the framework's staging folder (scripts/test-framework.mjs). Node 20 and Node 22 read a directory argument
// of `node --test` differently, so the files are listed here instead.
import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

export const FRAMEWORK_SOURCE = 'docs/harness-framework/framework'

// The paths (relative to `root`) of every `*.test.mjs` file under `folder`, sorted
export function frameworkTestFiles(root, folder = FRAMEWORK_SOURCE) {
  return readdirSync(join(root, folder), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.test.mjs'))
    .map((entry) => relative(root, join(entry.parentPath ?? entry.path, entry.name)))
    .sort()
}
