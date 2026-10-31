// The link check on a throwaway Git repository: broken links, and the index rule of an indexed folder.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import { checkLinks, indexProblems, trackedEntries } from './links.mjs'

const root = mkdtempSync(join(tmpdir(), 'harness-links-'))
after(() => rmSync(root, { recursive: true, force: true }))

const files = {
  'docs/report/README.md': '# Reports\n\n[one](./one.md)\n[machines](./machines/README.md)\n',
  'docs/report/one.md': '# One\n',
  'docs/report/machines/README.md': '# Machines\n',
  'docs/report/.hidden.md': 'hidden\n',
  'docs/plain/README.md': '# Plain\n',
  'docs/plain/loose.md': '# Not linked, and not indexed\n'
}
for (const [path, content] of Object.entries(files)) {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), content)
}
execFileSync('git', ['init', '-q'], { cwd: root })
execFileSync('git', ['add', '-A'], { cwd: root })

const tracked = Object.keys(files)

test('the entries of a folder are its tracked files and the first segment of a deeper path, without hidden ones', () => {
  assert.deepEqual(trackedEntries(tracked, 'docs/report'), ['README.md', 'machines', 'one.md'])
  assert.deepEqual(trackedEntries(tracked, 'docs/report/'), ['README.md', 'machines', 'one.md'])
  assert.deepEqual(trackedEntries(tracked, 'docs/none'), [])
})

test('an indexed folder passes when its README links every file and subfolder', () => {
  assert.deepEqual(indexProblems({ root, indexedFolders: ['docs/report'], tracked }), [])
})

test('a document left out of the index, and a folder with no README, are problems', () => {
  const added = [...tracked, 'docs/report/new-report.md']
  assert.deepEqual(indexProblems({ root, indexedFolders: ['docs/report'], tracked: added }), [
    'docs/report/README.md: does not link "new-report.md"; add it to the index'
  ])
  assert.deepEqual(indexProblems({ root, indexedFolders: ['docs/report', 'docs/missing'], tracked }), [
    'docs/missing: the folder has no README.md to index it'
  ])
})

test('checkLinks applies the index rule only to the indexed folders, and by default to none', () => {
  assert.deepEqual(checkLinks({ root }).problems, [])
  assert.deepEqual(checkLinks({ root, indexedFolders: ['docs/report'] }).problems, [])
  assert.deepEqual(checkLinks({ root, indexedFolders: ['docs/plain'] }).problems, [
    'docs/plain/README.md: does not link "loose.md"; add it to the index'
  ])
})

test('the index rule goes with broken links in one result', () => {
  writeFileSync(join(root, 'docs/plain/README.md'), '# Plain\n\n[gone](./gone.md)\n')
  const { problems } = checkLinks({ root, indexedFolders: ['docs/plain'] })
  assert.deepEqual(problems, [
    'docs/plain/README.md: broken link "./gone.md" (no such file docs/plain/gone.md)',
    'docs/plain/README.md: does not link "loose.md"; add it to the index'
  ])
})
