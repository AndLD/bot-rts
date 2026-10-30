// The `harness` command line as a project runs it: a real process, its output and its exit codes (0 done, 1 refused or failed, 2 usage).
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import { parseArgs } from './harness.mjs'

const root = mkdtempSync(join(tmpdir(), 'harness-cli-'))
after(() => rmSync(root, { recursive: true, force: true }))

const files = {
  'harness-profile.json': JSON.stringify({ adapters: { stacks: ['node-ts'] } }),
  'framework/framework.json': JSON.stringify({
    name: 'harness-framework',
    version: '0.1.0-dev',
    distributable: ['core', 'adapters']
  }),
  'framework/core/rule.md': 'A rule.\n',
  'framework/adapters/stack/node-ts/manifest.json': '{}\n'
}
for (const [path, content] of Object.entries(files)) {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), content)
}

const harness = (...args) => {
  const result = spawnSync(process.execPath, [join(import.meta.dirname, 'harness.mjs'), ...args, '--root', root], {
    encoding: 'utf8'
  })
  return { code: result.status, out: result.stdout, err: result.stderr }
}

test('sync, then check vendored passes; an edit fails it with exit code 1 and names the file', () => {
  const synced = harness('sync', '--from', 'framework')
  assert.equal(synced.code, 0, synced.err)
  assert.match(synced.out, /Synced 2 files of harness-framework 0\.1\.0-dev from framework\./)

  assert.equal(harness('check', 'vendored').code, 0)

  writeFileSync(join(root, 'harness/core/rule.md'), 'Edited.\n')
  const failed = harness('check', 'vendored')
  assert.equal(failed.code, 1)
  assert.match(failed.err, /harness check vendored: harness\/core\/rule\.md was edited/)

  assert.match(harness('diff').out, /^\+Edited\.$/m)
  assert.equal(harness('sync').code, 0)
  assert.equal(harness('check', 'vendored').code, 0)
})

test('a refused command exits with 1, a usage error with 2', () => {
  assert.equal(harness('detach').code, 1)
  assert.equal(harness('sync', '--to').code, 2)
  assert.equal(harness('sync', '--force').code, 2)
  assert.equal(harness('bootstrap').code, 2)
})

test('the arguments: words, flags with values and --local', () => {
  assert.deepEqual(parseArgs(['override', 'harness/a.md', '--reason', 'r', '--issue', 'i']), {
    words: ['override', 'harness/a.md'],
    flags: { reason: 'r', issue: 'i' }
  })
  assert.deepEqual(parseArgs(['sync', '--local']), { words: ['sync'], flags: { local: true } })
})

test('profile get prints a value and a list one item per line, and an unknown role exits with 1', () => {
  writeFileSync(
    join(root, 'harness-profile.json'),
    JSON.stringify({ adapters: { stacks: ['node-ts'] }, branches: { integration: 'dev' }, requiredChecks: ['a', 'b'] })
  )
  assert.deepEqual(harness('profile', 'get', 'branches.integration'), { code: 0, out: 'dev\n', err: '' })
  assert.equal(harness('profile', 'get', 'requiredChecks').out, 'a\nb\n')
  const unknown = harness('profile', 'get', 'no.such')
  assert.equal(unknown.code, 1)
  assert.match(unknown.err, /no value "no\.such"/)
  assert.equal(harness('profile', 'get').code, 2)
})

test('check profile fails on a profile file the schema refuses and passes on a valid one', () => {
  const failed = harness('check', 'profile')
  assert.equal(failed.code, 1)
  assert.match(failed.err, /harness check profile: harness-profile\.json: branches\.production: required, and missing/)
})

test('a changed value fails check vendored until sync --local regenerates the profile document', () => {
  const write = (integration) =>
    writeFileSync(
      join(root, 'harness-profile.json'),
      JSON.stringify({
        adapters: { stacks: ['node-ts'] },
        branches: { production: 'main', integration, productionNote: 'tagged', integrationNote: 'default' },
        paths: { profileFile: 'harness-profile.json', profileDocument: 'docs/profile.md' }
      })
    )
  write('develop')
  assert.equal(harness('sync', '--local').code, 0)
  assert.match(
    readFileSync(join(root, 'docs/profile.md'), 'utf8'),
    /^\| \*\*Integration branch\*\* \| `develop`; default \|$/m
  )
  assert.equal(harness('check', 'vendored').code, 0)

  write('trunk')
  const stale = harness('check', 'vendored')
  assert.equal(stale.code, 1)
  assert.match(stale.err, /the profile file changed since the managed files were generated: run `harness sync --local`/)

  assert.equal(harness('sync', '--local').code, 0)
  assert.match(
    readFileSync(join(root, 'docs/profile.md'), 'utf8'),
    /^\| \*\*Integration branch\*\* \| `trunk`; default \|$/m
  )
  assert.equal(harness('check', 'vendored').code, 0)

  writeFileSync(join(root, 'docs/profile.md'), 'edited by hand\n')
  assert.match(
    harness('check', 'vendored').err,
    /the managed file docs\/profile\.md differs from what the tools generated/
  )
})
