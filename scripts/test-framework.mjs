// Runs the tests of the framework's staging folder (docs/harness-framework/framework/), the same `node --test` run for CI's static job and the
// pre-push hook. A failing test fails the run. It stays until 17.15 moves the framework to its own repository.
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { frameworkTestFiles } from './framework-tests-lib.mjs'

const root = resolve(import.meta.dirname, '..')
const files = frameworkTestFiles(root)

if (files.length === 0) {
  console.error('No test file found in the framework folder: the framework must have tests (H-20261030-01).')
  process.exit(1)
}

const result = spawnSync(process.execPath, ['--test', ...files], { cwd: root, stdio: 'inherit' })
process.exit(result.status ?? 1)
