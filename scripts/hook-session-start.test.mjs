import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { lastNextStep, sessionStartMessage } from './hook-session-start.mjs'

const SCRIPT = fileURLToPath(new URL('./hook-session-start.mjs', import.meta.url))
const ROOT = fileURLToPath(new URL('..', import.meta.url))

const FILES = {
  'docs/development-plan/phases/phase-3-world.md':
    '# Phase 3 — World\n\n**Status:** ✅ Done · **Work log:** [phase-3-log](./work-logs/phase-3-log.md)\n',
  'docs/development-plan/phases/phase-9-admin.md':
    '# Phase 9 — Admin\n\n**Status:** 🟡 In progress · **Work log:** [phase-9-log](./work-logs/phase-9-log.md)\n',
  'docs/development-plan/phases/phase-10-market.md':
    '# Phase 10 — Market\n\n**Status:** ⬜ Not started · **Work log:** [phase-10-log](./work-logs/phase-10-log.md)\n',
  'docs/development-plan/phases/work-logs/phase-9-log.md':
    '### a\n- **Next step:** first\n- **Verify with:** x\n\n### b\n- **Next step:** start 9.4 (the console)\n- **Verify with:** y\n',
  'docs/development-plan/phases/README.md': '# not a phase\n**Status:** 🟡'
}
const readText = (path) => FILES[path]
const list = () => Object.keys(FILES).map((path) => path.split('/').pop())

test('lastNextStep returns the newest "Next step" line, or null', () => {
  assert.equal(lastNextStep(FILES['docs/development-plan/phases/work-logs/phase-9-log.md']), 'start 9.4 (the console)')
  assert.equal(lastNextStep('### a\n- **Verify with:** x'), null)
})

test('the message names the branch, the phase in progress and its last next step, and only that phase', () => {
  const message = sessionStartMessage('feature/9.4-console', readText, list)
  assert.match(message, /^Branch: feature\/9\.4-console$/m)
  assert.match(message, /Phase in progress: # ?Phase 9 — Admin|Phase in progress: Phase 9 — Admin/)
  assert.match(
    message,
    /Last next step \(docs\/development-plan\/phases\/work-logs\/phase-9-log\.md\): start 9\.4 \(the console\)/
  )
  assert.doesNotMatch(message, /Phase 3|Phase 10/)
})

test('the message says so when no phase is in progress, the branch is unknown or the log has no next step', () => {
  assert.match(
    sessionStartMessage(
      '',
      () => '# P\n**Status:** ✅ Done',
      () => ['phase-1-a.md']
    ),
    /Branch: unknown\nNo phase is in progress\./
  )
  const files = { ...FILES, 'docs/development-plan/phases/work-logs/phase-9-log.md': '### a\n' }
  assert.match(
    sessionStartMessage('b', (path) => files[path], list),
    /No next step is recorded/
  )
})

test('as a hook: prints the state of this repository', () => {
  const result = spawnSync('node', [SCRIPT], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT }
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /^Branch: .+/m)
  assert.match(result.stdout, /Phase in progress: .*Phase 15/)
  assert.match(result.stdout, /Session protocol/)
})
