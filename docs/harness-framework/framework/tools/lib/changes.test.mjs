// "Documentation only", one rule for CI and the push gate (design §7.1), merged from the second copy's `ci-changes`. Its patterns come from
// the profile file: every Markdown file by default; a project whose `docs/` holds only documentation adds `docs/**`.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { changedPaths, ciChanges, isDocumentation, isDocumentationOnly } from './changes.mjs'

test('by default only Markdown files are documentation, anywhere', () => {
  for (const path of ['README.md', 'AGENTS.md', 'api/results/README.md', 'docs/plan/phase-1.md']) {
    assert.ok(isDocumentation(path), path)
  }
  for (const path of [
    'docs/framework/tools/x.mjs',
    'docs/x.json',
    'package.json',
    '.github/workflows/ci.yml',
    'scripts/ci.mjs'
  ]) {
    assert.ok(!isDocumentation(path), path)
  }
})

test('a project may count a whole folder as documentation', () => {
  const patterns = ['**/*.md', 'docs/**']
  assert.ok(isDocumentation('docs/report/data-sanity/toys.svg', patterns))
  assert.ok(!isDocumentation('api/data/client/sales.json', patterns))
})

test('a change is documentation only when every path is; a change of no file is too', () => {
  assert.equal(isDocumentationOnly(['docs/profile.md', 'README.md']), true)
  assert.equal(isDocumentationOnly(['docs/profile.md', 'api/src/config.py']), false)
  assert.equal(isDocumentationOnly([]), true)
})

test('ci changes lists the change from the merge base, writes the step output, and runs the checks when in doubt', () => {
  const root = mkdtempSync(join(tmpdir(), 'harness-changes-'))
  try {
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
    const commit = (file, message) => {
      writeFileSync(join(root, file), message)
      git('add', '.')
      git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--quiet', '-m', message)
      return git('rev-parse', 'HEAD')
    }
    git('init', '--quiet')
    const base = commit('a.ts', 'code')
    const docs = commit('README.md', 'docs')
    const output = join(root, 'output')
    writeFileSync(output, '')

    assert.deepEqual(changedPaths(root, base, docs), ['README.md'])
    assert.equal(ciChanges({ root, profile: {}, base, head: docs, output }).code, false)
    const code = commit('b.ts', 'more code')
    assert.equal(ciChanges({ root, profile: {}, base, head: code, output }).code, true)
    assert.equal(readFileSync(output, 'utf8'), 'code=false\ncode=true\n')

    for (const doubtful of [undefined, '0000000000000000000000000000000000000000', 'no-such-commit']) {
      const result = ciChanges({ root, profile: {}, base: doubtful, head: docs, output: null })
      assert.equal(result.code, true, String(doubtful))
      assert.equal(result.paths, null)
    }
    assert.equal(
      ciChanges({ root, profile: { checks: { documentationPaths: ['**'] } }, base, head: code, output: null }).code,
      false
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
