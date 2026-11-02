import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatCommand, isFormatted } from './format.mjs'

test('Prettier handles source, data and Markdown files and leaves binaries, generated folders and unknown files alone', () => {
  for (const path of ['a.ts', 'a.tsx', 'a.mjs', 'a.json', 'docs/a.md', 'a.yml', 'client/src/a.css']) {
    assert.equal(isFormatted(path), true, path)
  }
  for (const path of [
    'a.png',
    'a.txt',
    'node_modules/x/a.js',
    'client/.next/a.js',
    'api/ts-built/a.js',
    'coverage/a.json',
    'dist/a.js',
    'Makefile'
  ]) {
    assert.equal(isFormatted(path), false, path)
  }
})

test('the command runs Prettier from the installation of the project and never downloads it', () => {
  assert.deepEqual(formatCommand({ path: 'api/src/a.ts' }), {
    command: 'npx',
    args: ['--no-install', 'prettier', '--write', 'api/src/a.ts']
  })
  assert.equal(formatCommand({ path: 'a.png' }), null)
})
