// The Markdown library of the checks, merged from both copies of the link check: anchors as the host renders them (`_` stays), targets without
// code, schemes and template placeholders.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { blankFences, headingAnchors, linkTargets, slugify } from './markdown.mjs'

test('slugify follows the host: punctuation goes, `-` and `_` stay, spaces become `-`', () => {
  assert.equal(slugify('5.4 The "arena" and metrics'), '54-the-arena-and-metrics')
  assert.equal(slugify('1. Mission & non-negotiables'), '1-mission--non-negotiables')
  assert.equal(slugify('FORECAST_HORIZON_WEEKS'), 'forecast_horizon_weeks')
  assert.equal(slugify('Résumé — été'), 'résumé--été')
})

test('headingAnchors numbers repeated headings and ignores headings inside fences', () => {
  const text = '# Title\n## Notes\n```\n# not a heading\n```\n## Notes\n### `Code` and [link](x.md)\n'
  assert.deepEqual([...headingAnchors(text)], ['title', 'notes', 'notes-1', 'code-and-link'])
})

test('linkTargets returns relative targets only, outside code, and skips the placeholders of a template', () => {
  const text = [
    '[a](./a.md) [b](../b.md#part "title") [c](#local)',
    '[web](https://example.com) [mail](mailto:x@example.com)',
    '[profile]({{rel:documents.profile}})',
    '`[inline](./skip.md)`',
    '```',
    '[fenced](./skip.md)',
    '```'
  ].join('\n')
  assert.deepEqual(linkTargets(text), ['./a.md', '../b.md#part', '#local'])
})

test('blankFences keeps the line numbers of the text around a fence', () => {
  assert.equal(blankFences('a\n```\nb\n```\nc'), 'a\n\n\n\nc')
})
