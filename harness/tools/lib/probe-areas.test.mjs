// The areas of the cold-start probes (task 3.15): the probes of a bindings file, the check that they name areas that exist, and what taking versions asks of
// them (the probes to run again, and the starting probe of an area no probe covers), on a project that takes a version that touches the plan format.
import assert from 'node:assert/strict'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import { run } from '../harness.mjs'
import {
  areasOfNote,
  checkProbes,
  parseProbes,
  probePlan,
  probeProblems,
  probesReport,
  startingProbes,
  touchedAreas
} from './probe-areas.mjs'

const dirs = []
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))
const FRAMEWORK = new URL('../..', import.meta.url).pathname
const AREAS = Object.keys(JSON.parse(readFileSync(join(FRAMEWORK, 'migrations/areas.json'), 'utf8')).areas)

const BINDINGS = `# Bindings

| Probe | Scenario | Areas | Words read at the last review |
| ----- | -------- | ----- | ----------------------------- |
| P1 | Start the next task | entry rules, plan format | 5200 |
| P2 | Open the pull request | Git rules, procedures | — |
| not a probe | x | y | z |
`

const note = (version, areas) =>
  `# Migration to ${version} from the previous\n\n## What changed for a project\n\nx\n\n## Areas touched\n\n<!-- areas:begin -->\n${areas.map((area) => `- ${area}`).join('\n') || 'None.'}\n<!-- areas:end -->\n\n## Required actions\n\nNone.\n`

test('the probes of a bindings file are read with their areas, and a probe that names no area, or one that does not exist, is a problem', () => {
  const probes = parseProbes(BINDINGS)
  assert.deepEqual(
    probes.map((probe) => [probe.id, probe.areas, probe.words]),
    [
      ['P1', ['entry rules', 'plan format'], '5200'],
      ['P2', ['Git rules', 'procedures'], '—']
    ]
  )
  assert.deepEqual(probeProblems(probes, AREAS, 'b.md'), [])
  const bad = probeProblems(
    [
      { id: 'P3', areas: [] },
      { id: 'P4', areas: ['plan format', 'made up'] }
    ],
    AREAS,
    'b.md'
  )
  assert.match(bad[0], /b\.md: the probe P3 names no area/)
  assert.match(bad[1], /the probe P4 names the area "made up", which is not an area of the migration notes/)
})

test('the scaffold’s bindings stub has starting probes that each name areas of the migration notes', () => {
  const stub = readFileSync(join(FRAMEWORK, 'core/templates/scaffold/harness-bindings.md'), 'utf8')
  const probes = parseProbes(stub)
  assert.deepEqual(
    probes.map((probe) => probe.id),
    ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']
  )
  assert.deepEqual(probeProblems(probes, AREAS, 'stub'), [])
  assert.match(probes.find((probe) => probe.id === 'P5').scenario, /Add a phase to the plan/)
  assert.match(probes.find((probe) => probe.id === 'P6').scenario, /Put a defect found in use into the plan/)
  assert.ok(probes.every((probe) => probe.areas.length >= 2))
  assert.deepEqual(
    probeProblems(
      parseProbes(readFileSync(join(FRAMEWORK, 'docs/quality-reviews/harness/bindings.md'), 'utf8')),
      AREAS,
      'own'
    ),
    []
  )
})

test('the framework has a starting probe for every area of its migration notes', () => {
  const starting = startingProbes(readFileSync(join(FRAMEWORK, 'core/reviews/harness/starting-probes.md'), 'utf8'))
  assert.deepEqual(
    AREAS.filter((area) => !starting.has(area)),
    [],
    'an area without a starting probe would leave a project with nothing to run'
  )
  assert.match(starting.get('plan format'), /Start the next task of the plan/)
})

test('the notes list their areas between the markers, and the plan asks to rerun what a version touched', () => {
  assert.deepEqual(areasOfNote(note('0.2.0', ['plan format', 'procedures'])), ['plan format', 'procedures'])
  assert.deepEqual(areasOfNote(note('0.2.0', [])), [])
  assert.deepEqual(areasOfNote('no markers'), [])
  const probes = parseProbes(BINDINGS)
  const { rerun, uncovered } = probePlan({ probes, touched: ['plan format', 'review method', 'procedures'] })
  assert.deepEqual(
    rerun.map(({ probe, areas }) => [probe.id, areas]),
    [
      ['P1', ['plan format']],
      ['P2', ['procedures']]
    ]
  )
  assert.deepEqual(uncovered, ['review method'])
})

function project() {
  const root = mkdtempSync(join(tmpdir(), 'probe-areas-'))
  dirs.push(root)
  const write = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  write('migrations/0.1.1.md', note('0.1.1', ['checks']))
  write('migrations/0.2.0-dev.1.md', note('0.2.0-dev.1', ['plan format']))
  write('migrations/0.2.0-dev.2.md', note('0.2.0-dev.2', ['review method']))
  write('migrations/0.2.0.md', note('0.2.0', ['plan format', 'review method']))
  write('migrations/0.3.0.md', note('0.3.0', ['host adapters']))
  write('migrations/areas.json', readFileSync(join(FRAMEWORK, 'migrations/areas.json'), 'utf8'))
  write('docs/bindings.md', BINDINGS)
  cpSync(
    join(FRAMEWORK, 'core/reviews/harness/starting-probes.md'),
    join(root, 'core/reviews/harness/starting-probes.md')
  )
  const profile = { paths: { frameworkDir: '.' }, documents: { harnessBindings: 'docs/bindings.md' } }
  return { root, profile }
}

test('taking a version that touches the plan format: the probes that exercise it run again, with the words of the last review, and the area with no probe gets its starting probe', () => {
  const { root, profile } = project()
  assert.deepEqual(touchedAreas({ folder: join(root, 'migrations'), from: '0.1.2', to: '0.2.0' }), [
    'plan format',
    'review method'
  ])
  const lines = probesReport({ root, profile, from: '0.1.2', to: '0.2.0' })
  assert.match(lines[0], /Areas touched by the versions after 0\.1\.2 up to 0\.2\.0: plan format, review method\./)
  assert.ok(lines.includes('  P1 (plan format): Start the next task; last review: 5200'))
  assert.ok(!lines.some((line) => line.includes('P2')), 'a probe that exercises none of the areas stays')
  assert.match(
    lines.find((line) => line.startsWith('  review method:')),
    /^ {2}review method: "Review the code of the project\."/
  )

  // A development version has a note of its own, which the final note replaces; a range with no area has nothing to run
  assert.deepEqual(touchedAreas({ folder: join(root, 'migrations'), from: '0.1.2', to: '0.2.0-dev.1' }), [
    'plan format'
  ])
  assert.deepEqual(touchedAreas({ folder: join(root, 'migrations'), from: '0.2.0-dev.1', to: '0.2.0-dev.2' }), [
    'review method'
  ])
  assert.deepEqual(touchedAreas({ folder: join(root, 'migrations'), from: '0.2.0-dev.1', to: '0.2.0' }), [
    'plan format',
    'review method'
  ])
  assert.match(
    probesReport({ root, profile, from: '0.3.0', to: '0.3.5' })[0],
    /list no area, so no probe needs to run again/
  )
  assert.ok(
    probesReport({ root, profile: { ...profile, documents: {} }, from: '0.1.2', to: '0.2.0' }).includes(
      'No probe of the project exercises these areas.'
    )
  )
})

test('the check holds the names of the areas in the project’s bindings, and the command prints the report', async () => {
  const { root, profile } = project()
  assert.deepEqual(checkProbes({ root, profile }).problems, [])
  writeFileSync(
    join(root, 'docs/bindings.md'),
    BINDINGS.replace('entry rules, plan format', 'entry rules, plan formats')
  )
  const problems = checkProbes({ root, profile }).problems
  assert.equal(problems.length, 1)
  assert.match(problems[0], /the probe P1 names the area "plan formats"/)
  assert.deepEqual(checkProbes({ root, profile: { ...profile, documents: {} } }).problems, [])

  writeFileSync(
    join(root, 'harness-profile.json'),
    JSON.stringify({
      ...profile,
      paths: { ...profile.paths, phases: 'x', planIndex: 'y', changelog: 'c', changelogFragments: 'f', plan: 'p' }
    })
  )
  const lines = []
  const code = await run(['probes', '0.1.2', '0.2.0', '--root', root], {
    out: (line) => lines.push(line),
    err: (line) => lines.push(line)
  })
  assert.equal(code, 0, lines.join('\n'))
  assert.match(lines.join('\n'), /Areas touched by the versions after 0\.1\.2 up to 0\.2\.0/)
})
