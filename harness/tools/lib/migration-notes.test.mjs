import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { areasOf, AREAS_BEGIN, AREAS_END, noteProblems, NOTE_HEADINGS, WATCHED, withAreas } from './migration-notes.mjs'
import { claims } from './layers.mjs'
import { walk } from './tree.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const NOTE = (version = '1.2.0', list = '') =>
  `# Migration to ${version} from 1.1.0\n\n${NOTE_HEADINGS.map((heading) => `## ${heading}\n\n${heading === 'Areas touched' ? `${AREAS_BEGIN}\n${list}${AREAS_END}\n` : 'Text.\n'}`).join('\n')}`
const SPEC = {
  ignore: ['**/*.test.mjs'],
  areas: { 'Git rules': ['core/rules/git.md'], procedures: ['core/procedures/**'], checks: ['tools/**'] }
}

test('a note has its title, its five sections in order and one pair of area markers', () => {
  assert.deepEqual(noteProblems(NOTE(), '1.2.0'), [])
  assert.match(noteProblems(NOTE(), '1.3.0')[0], /first line must be "# Migration to 1\.3\.0 from <previous version>"/)
  assert.match(
    noteProblems(NOTE().replace('## Optional actions', '## Extras'), '1.2.0')[0],
    /sections must be, in order: "What changed for a project"/
  )
  assert.match(
    noteProblems(NOTE().replace(AREAS_END, ''), '1.2.0')[0],
    /must hold one <!-- areas:begin --> and one <!-- areas:end -->/
  )
})

test('the areas of a version are those whose globs match a changed path, in the order of the list; tests are ignored', () => {
  const changed = ['tools/lib/a.mjs', 'core/procedures/release.md', 'tools/lib/a.test.mjs', 'core/rules/git.md']
  assert.deepEqual(areasOf(changed, SPEC), { areas: ['Git rules', 'procedures', 'checks'], unmatched: [] })
  assert.deepEqual(areasOf(['tools/lib/a.test.mjs'], SPEC), { areas: [], unmatched: [] })
})

test('a changed path that belongs to no area is reported, so that the list stays complete', () => {
  assert.deepEqual(areasOf(['core/method/method.md', 'tools/x.mjs'], SPEC), {
    areas: ['checks'],
    unmatched: ['core/method/method.md']
  })
})

test('withAreas writes the list between the markers and leaves the rest', () => {
  const written = withAreas(NOTE(), ['procedures', 'checks'])
  assert.match(written, new RegExp(`${AREAS_BEGIN}\\n- procedures\\n- checks\\n${AREAS_END}`))
  assert.deepEqual(noteProblems(written, '1.2.0'), [])
  assert.match(withAreas(written, []), new RegExp(`${AREAS_BEGIN}\\nNone\\.\\n${AREAS_END}`))
  assert.equal(withAreas(NOTE(), ['a']).replace(/- a\n/, ''), NOTE())
})

test('the areas of the framework cover every file it distributes from the watched folders', () => {
  const spec = JSON.parse(readFileSync(`${ROOT}migrations/areas.json`, 'utf8'))
  const paths = WATCHED.flatMap((folder) => walk(`${ROOT}${folder}`).map((path) => `${folder}/${path}`))
  assert.ok(paths.length > 100)
  assert.deepEqual(areasOf(paths, spec).unmatched, [])
  assert.deepEqual(
    Object.keys(spec.areas).filter(
      (name) => !spec.areas[name].some((glob) => paths.some((path) => claims([glob], path)))
    ),
    [],
    'an area no file matches is stale'
  )
})

test('the note of 0.1.1 has the shape, and so does every note of the framework', () => {
  const versions = walk(`${ROOT}migrations`)
    .filter((name) => /^\d+\.\d+\.\d+\.md$/.test(name))
    .map((name) => name.replace(/\.md$/, ''))
  assert.ok(versions.includes('0.1.1'))
  for (const version of versions) {
    assert.deepEqual(noteProblems(readFileSync(`${ROOT}migrations/${version}.md`, 'utf8'), version), [], version)
  }
})
