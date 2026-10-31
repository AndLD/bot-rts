// The term lists of this repository's profile file catch the leak kinds that the harness reviews found by hand (H-20261019-16), and let the
// placeholders pass. They test this project's values, so they stay here while the scan itself is the framework's (harness check core).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { coreLeakProblems } from '../harness/tools/lib/core-scan.mjs'
import { coreEntries } from '../harness/tools/lib/layers.mjs'

const BINDINGS = coreEntries(['AGENTS.md sections 1 7', 'docs/method.md'])
const BINDING_LINE = '**Role binding.** The integration branch is `develop`, Phase 12.'
const AGENTS = (body) => `# Rules\n## 1. A\n${body}\n## 2. Moved\nA bot moves.\n## 7. Git\n${BINDING_LINE}\n`

// The lists of the real profile file, for the values that the lists must catch
const REAL_PROFILE = JSON.parse(readFileSync(new URL('../harness-profile.json', import.meta.url), 'utf8')).terms
const REAL_FILES = (text) => ({ 'AGENTS.md': AGENTS('ok'), 'docs/method.md': text })

test('the profile lists catch a game noun, a task-id branch example and a link to a dated file', () => {
  const cases = [
    ['The soak test sustains N players.', 'the product term "players"'],
    ['A player must learn it.', 'the product term "player"'],
    ['For example `feature/3.12-some-task`.', 'the project value "feature/3"'],
    ['See `bugfix/12.1-fix`.', 'the project value "bugfix/1"'],
    ['The report [2026-10-19](./harness/2026-10-19.md).', 'the project value "2026-10-19.md"'],
    ['The report [second](./2026-10-19-2.md).', 'the project value "2026-10-19-2.md"']
  ]
  for (const [text, expected] of cases) {
    const problems = coreLeakProblems(REAL_FILES(text), REAL_PROFILE, BINDINGS)
    assert.equal(problems.length, 1, text)
    assert.ok(problems[0].includes(expected), `${text}: ${problems[0]}`)
  }
})

test('the profile lists let a placeholder branch example and a template date pattern pass', () => {
  const text = 'Branch `feature/<id>-<slug>`; reports are named `YYYY-MM-DD.md`.'
  assert.deepEqual(coreLeakProblems(REAL_FILES(text), REAL_PROFILE, BINDINGS), [])
})
