import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { isFormatted } from './hook-format-edited.mjs'

const SCRIPT = fileURLToPath(new URL('./hook-format-edited.mjs', import.meta.url))
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

test('source, data and document files are formatted; generated and foreign folders are not', () => {
  for (const path of ['a/b.ts', 'a/b.tsx', 'a.mjs', 'a.json', 'docs/a.md', 'a.yml']) {
    assert.equal(isFormatted(path), true, path)
  }
  for (const path of [
    'a.png',
    'a.txt',
    'node_modules/x/a.js',
    'client/.next/a.js',
    'api/ts-built/a.js',
    'coverage/a.json',
    'Makefile'
  ]) {
    assert.equal(isFormatted(path), false, path)
  }
})

test('as a hook: formats the edited file with the Prettier configuration of the repository', () => {
  const directory = mkdtempSync(join(tmpdir(), 'format-hook-'))
  const file = join(directory, 'sample.json')
  writeFileSync(file, '{"a":1,   "b":[1,2]}')

  const result = spawnSync('node', [SCRIPT], {
    input: JSON.stringify({ cwd: ROOT, tool_input: { file_path: file } }),
    encoding: 'utf8'
  })

  assert.equal(result.status, 0)
  assert.equal(readFileSync(file, 'utf8'), '{ "a": 1, "b": [1, 2] }\n')
})

test('as a hook: never fails, whatever the input', () => {
  const run = (input) => spawnSync('node', [SCRIPT], { input, encoding: 'utf8' })
  assert.equal(run('not json').status, 0)
  assert.equal(run(JSON.stringify({ tool_input: { file_path: '/does/not/exist.ts' } })).status, 0)
  assert.equal(run(JSON.stringify({ tool_input: {} })).status, 0)
})
