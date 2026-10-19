import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { refusal } from './hook-guard-edit.mjs'

const SCRIPT = fileURLToPath(new URL('./hook-guard-edit.mjs', import.meta.url))

test('environment files are refused, the example file is not', () => {
  for (const path of [
    '/r/.env',
    '/r/api/.env.development',
    '/r/api/.env.test',
    '.env.production',
    'client/.env.local'
  ]) {
    assert.match(refusal(path), /never edit it/, path)
  }
  for (const path of ['/r/api/.env.example', '/r/src/env.ts', '/r/docs/environment.md', '/r/.environment']) {
    assert.equal(refusal(path), null, path)
  }
})

test('as a hook: exit code 2 for an environment file, 0 for anything else', () => {
  const run = (input) => spawnSync('node', [SCRIPT], { input, encoding: 'utf8' })
  const refused = run(JSON.stringify({ tool_input: { file_path: '/r/api/.env' } }))
  assert.equal(refused.status, 2)
  assert.match(refused.stderr, /\.env\.example/)
  assert.equal(run(JSON.stringify({ tool_input: { file_path: '/r/api/src/a.ts' } })).status, 0)
  assert.equal(run(JSON.stringify({ tool_input: {} })).status, 0)
  assert.equal(run('not json').status, 0)
})
