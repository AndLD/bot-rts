// The mode of the probes of a migration (report 65): `probes.run` of the profile file under a local override, and what the end of the output of `migrate` and
// of `harness probes` says for each mode.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { run } from '../harness.mjs'
import { DEFAULT_PROBE_MODE, PROBE_MODES, probeAdvice, probeMode } from './probe-mode.mjs'

const dirs = []
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))
const rootWith = (local) => {
  const root = mkdtempSync(join(tmpdir(), 'probe-mode-'))
  dirs.push(root)
  if (local !== undefined) writeFileSync(join(root, 'harness-profile.local.json'), local)
  return root
}

test('the mode is ask unless the profile file says otherwise, and the ignored local file wins on one machine', () => {
  assert.equal(DEFAULT_PROBE_MODE, 'ask')
  assert.deepEqual(probeMode({ profile: {}, root: rootWith() }), { mode: 'ask', notes: [] })
  assert.equal(probeMode({ profile: { probes: { run: 'disabled' } }, root: rootWith() }).mode, 'disabled')
  assert.equal(
    probeMode({ profile: { probes: { run: 'disabled' } }, root: rootWith('{ "probes": { "run": "auto" } }') }).mode,
    'auto'
  )
  assert.equal(
    probeMode({ profile: { probes: { run: 'auto' } } }).mode,
    'auto',
    'a run with no root reads the profile only'
  )
})

test('a value that is not valid, and a local file that is not JSON, are ignored and said', () => {
  const bad = probeMode({ profile: { probes: { run: 'sometimes' } }, root: rootWith() })
  assert.equal(bad.mode, 'ask')
  assert.match(
    bad.notes[0],
    /the profile file: probes\.run "sometimes" is not one of auto, ask, disabled and is ignored/
  )
  const local = probeMode({ profile: { probes: { run: 'auto' } }, root: rootWith('{ "probes": { "run": "never" } }') })
  assert.equal(local.mode, 'auto', 'the profile file stays when the override is invalid')
  assert.match(local.notes[0], /harness-profile\.local\.json: probes\.run "never"/)
  assert.match(probeMode({ profile: {}, root: rootWith('not json') }).notes[0], /not valid JSON, so it is ignored/)
})

test('each mode says what whoever takes the version does about the probes, and names the command that lists them', () => {
  const lines = Object.fromEntries(PROBE_MODES.map((mode) => [mode, probeAdvice({ mode, from: '0.1.2', to: '0.2.0' })]))
  for (const mode of PROBE_MODES) {
    assert.equal(lines[mode].length, 1)
    assert.match(lines[mode][0], new RegExp(`probes\\.run is ${mode}`))
    assert.match(lines[mode][0], /`harness probes 0\.1\.2 0\.2\.0`/)
  }
  assert.match(lines.auto[0], /run the probes .* lists now/)
  assert.match(lines.ask[0], /do not run them yet\. Ask the owner .* only on a yes/)
  assert.match(lines.ask[0], /Where nobody can be asked, treat the mode as disabled/)
  assert.match(lines.disabled[0], /not run/)
  assert.deepEqual(probeAdvice({ mode: 'ask', notes: ['a note'], from: 'a', to: 'b' }).slice(0, 1), ['a note'])
})

test('`harness probes` ends with the advice of the mode', async () => {
  const framework = new URL('../..', import.meta.url).pathname
  const lines = []
  const code = await run(['probes', '0.1.2', '0.2.0', '--root', framework], {
    out: (line) => lines.push(line),
    err: (line) => lines.push(line)
  })
  assert.equal(code, 0, lines.join('\n'))
  assert.match(lines.at(-1), /Probes \(probes\.run is ask\)/, 'this repository leaves the mode at its default')
})
