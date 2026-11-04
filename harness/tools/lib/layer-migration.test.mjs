// The layer map of a project with its own layers takes the phase folders and the issue queue (issue I-3).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classify } from './layers.mjs'
import { layersForPlan } from './layer-migration.mjs'

const FILE = `{
  "paths": { "phases": "docs/plan/phases", "issues": "docs/plan/issues" },
  "layers": {
    "scope": ["docs/**"],
    "state": [
      "docs/plan/phases/phase-*.md",
      "CHANGELOG.md"
    ],
    "entry": ["README.md"]
  }
}
`
const profileOf = (text) => JSON.parse(text)
const FILES = [
  'docs/plan/phases/phase-1-x.md',
  'docs/plan/phases/phase-2-y/README.md',
  'docs/plan/phases/phase-2-y/2.1.md',
  'docs/plan/phases/phase-2-y/2.1.log.md',
  'docs/plan/phases/phase-2-y/log.md',
  'docs/plan/issues/README.md',
  'docs/plan/issues/I-1.md',
  'docs/plan/issues/archived/README.md'
]
const problems = (text) => {
  const { layers, scope, excluded = [] } = profileOf(text).layers
  return classify(FILES, {
    scope,
    excluded,
    core: [],
    blocks: [],
    layers: {
      core: [],
      domain: [],
      adapter: [],
      profile: [],
      state: layers?.state ?? profileOf(text).layers.state,
      entry: []
    }
  }).problems
}

test('the phase folders and the issue queue join the layer that claims the one-file phases, and the check of layers then passes', () => {
  assert.equal(problems(FILE).length, 7)
  const { text, added, manual } = layersForPlan(FILE, profileOf(FILE))
  assert.deepEqual(added, ['docs/plan/phases/phase-*/**', 'docs/plan/issues/**'])
  assert.deepEqual(manual, [])
  assert.deepEqual(profileOf(text).layers.state, [
    'docs/plan/phases/phase-*.md',
    'docs/plan/issues/**',
    'docs/plan/phases/phase-*/**',
    'CHANGELOG.md'
  ])
  assert.deepEqual(problems(text), [])
  assert.match(text, /^ {6}"docs\/plan\/phases\/phase-\*\/\*\*",$/m, 'one entry to a line, as the file had them')

  const again = layersForPlan(text, profileOf(text))
  assert.deepEqual([again.text, again.added], [text, []], 'run twice, it changes nothing')
})

test('a layer that claims the folders already, a project with no layer map and one that cannot be edited safely', () => {
  const claimed = FILE.replace('"docs/plan/phases/phase-*.md",', '"docs/plan/**",')
  assert.deepEqual(layersForPlan(claimed, profileOf(claimed)).added, [])
  const none = '{ "paths": { "phases": "p", "issues": "i" } }'
  assert.deepEqual(layersForPlan(none, profileOf(none)), { text: none, added: [], manual: [] })

  const inline = FILE.replace(/"state": \[[^\]]*\]/, '"state": ["docs/plan/phases/phase-*.md", "CHANGELOG.md"]')
  const { text, added, manual } = layersForPlan(inline, profileOf(inline))
  assert.equal(text, inline)
  assert.deepEqual([added, manual], [[], ['docs/plan/phases/phase-*/**', 'docs/plan/issues/**']])
})
