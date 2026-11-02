import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { denyRules, HOOKS, scaffoldProblems, settingsFor } from './settings.mjs'

const profile = { access: { denyRead: ['.env', '.env.*', '!.env.example', '*.pem', 'secrets/keys.txt'] } }
const dirs = []
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

function project(settings) {
  const root = mkdtempSync(join(tmpdir(), 'claude-settings-'))
  dirs.push(root)
  mkdirSync(join(root, '.claude'))
  if (settings !== undefined) {
    writeFileSync(
      join(root, '.claude', 'settings.json'),
      typeof settings === 'string' ? settings : JSON.stringify(settings)
    )
  }
  return root
}

test('the deny rules read a pattern without a slash at any depth, keep a path, and write a carve-out as a rule of its own', () => {
  assert.deepEqual(denyRules(profile.access.denyRead), [
    'Read(**/.env)',
    'Read(**/.env.*)',
    'Read(!**/.env.example)',
    'Read(**/*.pem)',
    'Read(secrets/keys.txt)'
  ])
  assert.deepEqual(denyRules(undefined), [])
})

test('the settings call the vendored hooks for the four events of the preset, and carry the deny rules', () => {
  const settings = settingsFor(profile)
  assert.deepEqual(Object.keys(settings.hooks), ['SessionStart', 'PreToolUse', 'PostToolUse'])
  assert.equal(settings.hooks.PreToolUse.length, 2)
  assert.equal(settings.hooks.PreToolUse[0].matcher, 'Bash')
  assert.equal(
    settings.hooks.PreToolUse[0].hooks[0].command,
    'node "$CLAUDE_PROJECT_DIR/harness/tools/runtime-hooks/guard-shell.mjs"'
  )
  assert.deepEqual(settings.permissions.deny, denyRules(profile.access.denyRead))
  assert.equal(HOOKS.length, 4)
})

test('settings written from the profile pass the scaffold check', () => {
  assert.deepEqual(scaffoldProblems({ root: project(settingsFor(profile)), profile }), [])
})

test('a missing hook entry, a hook of another matcher and a missing deny rule each fail, naming it', () => {
  const settings = settingsFor(profile)
  delete settings.hooks.SessionStart
  settings.hooks.PreToolUse[0].matcher = 'Shell'
  settings.permissions.deny = settings.permissions.deny.filter((rule) => rule !== 'Read(**/*.pem)')
  const problems = scaffoldProblems({ root: project(settings), profile })
  assert.deepEqual(
    problems.map((problem) => problem.replace('.claude/settings.json: ', '')),
    [
      'the SessionStart hook must run harness/tools/runtime-hooks/session-start.mjs',
      'the PreToolUse hook for Bash must run harness/tools/runtime-hooks/guard-shell.mjs',
      'permissions.deny lacks Read(**/*.pem), the deny rule of access.denyRead'
    ]
  )
})

test('a hook that runs another script, a missing file and a file that is not JSON fail', () => {
  const settings = settingsFor(profile)
  settings.hooks.PostToolUse[0].hooks[0].command = 'node scripts/hook-format-edited.mjs'
  assert.match(
    scaffoldProblems({ root: project(settings), profile })[0],
    /PostToolUse hook for Edit\|Write must run .*format-edited\.mjs/
  )
  assert.match(
    scaffoldProblems({ root: project(undefined), profile })[0],
    /missing; the claude-code runtime expects it/
  )
  assert.match(scaffoldProblems({ root: project('{'), profile })[0], /not valid JSON/)
})
