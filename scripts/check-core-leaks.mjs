// Checks the CORE files of the harness for stack terms, product terms and project values (see core-leaks-lib.mjs): run by `npm run docs:check`.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { coreFiles, coreLeakProblems, frameworkCoreProblems } from './core-leaks-lib.mjs'
import { FRAMEWORK_SOURCE } from './framework-tests-lib.mjs'
import { profile } from './harness-profile.mjs'

const root = resolve(import.meta.dirname, '..')
const read = (path) => readFileSync(join(root, path), 'utf8')

const bindings = read('docs/quality-reviews/harness/bindings.md')
const files = {}
for (const { path } of coreFiles(bindings)) {
  try {
    files[path] = read(path)
  } catch {
    // reported by coreLeakProblems as a missing file
  }
}

// The core of the framework (its staging folder is outside the layer map above): every file under `core/`, the placeholders included
const frameworkCore = `${FRAMEWORK_SOURCE}/core`
const frameworkFiles = {}
for (const entry of readdirSync(join(root, frameworkCore), { recursive: true, withFileTypes: true })) {
  if (entry.isFile()) {
    const path = relative(root, join(entry.parentPath ?? entry.path, entry.name))
    frameworkFiles[path] = read(path)
  }
}

const problems = [
  ...coreLeakProblems(files, profile.terms, bindings),
  ...frameworkCoreProblems(frameworkFiles, profile.terms, frameworkCore)
]

if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}

console.log(
  `Checked ${Object.keys(files).length} CORE files and ${Object.keys(frameworkFiles).length} files of ${frameworkCore} for stack terms, product terms and project values.`
)
