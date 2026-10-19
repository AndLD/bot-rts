// Checks the CORE files of the harness for stack terms, product terms and project values (see core-leaks-lib.mjs): run by `npm run docs:check`.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { coreFiles, coreLeakProblems } from './core-leaks-lib.mjs'

const root = resolve(import.meta.dirname, '..')
const read = (path) => readFileSync(join(root, path), 'utf8')

const profile = read('docs/profile.md')
const bindings = read('docs/quality-reviews/harness/bindings.md')
const files = {}
for (const { path } of coreFiles(bindings)) {
  try {
    files[path] = read(path)
  } catch {
    // reported by coreLeakProblems as a missing file
  }
}

const problems = coreLeakProblems(files, profile, bindings)

if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}

console.log(`Checked ${Object.keys(files).length} CORE files for stack terms, product terms and project values.`)
