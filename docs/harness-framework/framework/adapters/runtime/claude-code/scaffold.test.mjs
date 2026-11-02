import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import { scaffoldFiles } from './scaffold.mjs'
import { scaffoldProblems } from './settings.mjs'

const dirs = []
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

test('CLAUDE.md imports the entry file of the profile', () => {
  const pointer = (profile) => scaffoldFiles(profile).find(({ path }) => path === 'CLAUDE.md').content
  assert.equal(pointer({}), '@AGENTS.md\n')
  assert.equal(pointer({ paths: { entryFile: 'RULES.md' } }), '@RULES.md\n')
})

test('the settings file it writes holds every invariant of the scaffold check', () => {
  const profile = { access: { denyRead: ['.env', '!.env.example'] } }
  const root = mkdtempSync(join(tmpdir(), 'claude-scaffold-'))
  dirs.push(root)
  for (const { path, content } of scaffoldFiles(profile).filter((file) => file.content !== undefined)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  assert.deepEqual(scaffoldProblems({ root, profile }), [])
  assert.deepEqual(scaffoldFiles(profile).find(({ path }) => path === '.gitignore').lines, [
    '.claude/settings.local.json'
  ])
})
