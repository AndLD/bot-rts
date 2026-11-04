import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { after, test } from 'node:test'
import { isMain } from './main-module.mjs'

const base = realpathSync(mkdtempSync(join(tmpdir(), 'main-module-')))
after(() => rmSync(base, { recursive: true, force: true }))

const real = join(base, 'real', 'script.mjs')
mkdirSync(join(base, 'real'))
writeFileSync(real, '')
symlinkSync(real, join(base, 'file-link.mjs'))
symlinkSync(join(base, 'real'), join(base, 'folder-link'))
symlinkSync(join(base, 'folder-link'), join(base, 'link-of-link'))
const url = pathToFileURL(real).href

test('a script is the main module when it was started by its real path or through any link to it', () => {
  assert.equal(isMain(url, real), true)
  assert.equal(isMain(url, join(base, 'file-link.mjs')), true)
  assert.equal(isMain(url, join(base, 'folder-link', 'script.mjs')), true)
  assert.equal(isMain(url, join(base, 'link-of-link', 'script.mjs')), true)
  assert.equal(isMain(url, join(base, 'real', '..', 'real', 'script.mjs')), true)
})

test('a script that was imported, or started as something else, is not the main module', () => {
  assert.equal(isMain(url, join(base, 'other.mjs')), false)
  assert.equal(isMain(url, undefined), false)
  assert.equal(isMain(url, ''), false)
  assert.equal(isMain(url, join(base, 'real')), false)
  assert.equal(isMain(pathToFileURL(join(base, 'gone.mjs')).href, real), false)
})
