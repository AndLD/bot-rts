import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  cleanLogLine,
  formatDuration,
  formatReport,
  jobDurations,
  mergeTestLogs,
  parseTestLog,
  runSeconds,
  slowestFiles,
  testJobs
} from './ci-timings-lib.mjs'

// A saved excerpt of the `verify` log of run 39158838242 (the baseline of Phase 16), in the format of `gh run view --log`
const EXCERPT = readFileSync(new URL('./fixtures/verify-log-excerpt.txt', import.meta.url), 'utf8')

test('cleanLogLine removes the job and step prefix, the timestamp and colour codes', () => {
  assert.equal(
    cleanLogLine('verify\tTests\t2026-10-18T19:44:04.2829765Z PASS a.test.ts (1.5 s)'),
    'PASS a.test.ts (1.5 s)'
  )
  assert.equal(cleanLogLine('2026-10-18T19:44:04.2829765Z PASS a.test.ts'), 'PASS a.test.ts')
  assert.equal(cleanLogLine('\u001b[32m✔\u001b[39m done  '), '✔ done')
})

test('parseTestLog reads the slow files of each package from the Jest output', () => {
  const { files, packages } = parseTestLog(EXCERPT)

  assert.deepEqual(
    packages.map((entry) => [entry.package, entry.seconds]),
    [
      ['api', 168.346],
      ['client', 821.308],
      ['mcp', 10.061]
    ]
  )
  assert.deepEqual(files[0], {
    package: 'api',
    project: 'unit',
    file: 'src/engine/application/handlers/world-handlers.test.ts',
    seconds: 9.606
  })
  assert.equal(files.filter((file) => file.package === 'api').length, 2)
  assert.deepEqual(
    files.find((file) => file.file.endsWith('Economy.test.tsx')),
    { package: 'client', project: null, file: 'src/features/admin/economy/Economy.test.tsx', seconds: 494.765 }
  )
})

test('files without a printed duration are not listed', () => {
  const { files } = parseTestLog(
    '> @bot-rts/api@0.0.0 test:coverage\nPASS unit src/a.test.ts\nFAIL unit src/b.test.ts (6.1 s)'
  )

  assert.deepEqual(files, [{ package: 'api', project: 'unit', file: 'src/b.test.ts', seconds: 6.1 }])
})

test('slowestFiles orders by duration and cuts the list', () => {
  const { files } = parseTestLog(EXCERPT)

  assert.deepEqual(
    slowestFiles(files, 3).map((file) => file.file.split('/').pop()),
    ['Economy.test.tsx', 'Logs.test.tsx', 'Supervision.test.tsx']
  )
})

const JOBS = [
  {
    id: 1,
    name: 'verify',
    conclusion: 'success',
    started_at: '2026-10-18T19:27:22Z',
    completed_at: '2026-10-18T19:48:21Z',
    steps: [
      {
        name: 'Install dependencies',
        conclusion: 'success',
        started_at: '2026-10-18T19:27:52Z',
        completed_at: '2026-10-18T19:29:01Z'
      },
      {
        name: 'Markdown links',
        conclusion: 'success',
        started_at: '2026-10-18T19:30:04Z',
        completed_at: '2026-10-18T19:30:05Z'
      },
      { name: 'Coverage of changed files', conclusion: 'skipped', started_at: null, completed_at: null }
    ]
  },
  {
    id: 2,
    name: 'e2e',
    conclusion: 'success',
    started_at: '2026-10-18T19:27:21Z',
    completed_at: '2026-10-18T19:38:22Z',
    steps: []
  }
]

test('jobDurations and runSeconds measure jobs, steps and the whole run', () => {
  const [verify, e2e] = jobDurations(JOBS)

  assert.equal(verify.seconds, 1259)
  assert.equal(e2e.seconds, 661)
  assert.deepEqual(
    verify.steps.map((step) => step.seconds),
    [69, 1, null]
  )
  assert.equal(runSeconds(JOBS), 1260)
  assert.equal(runSeconds([]), null)
})

test('formatDuration prints minutes and seconds', () => {
  assert.equal(formatDuration(1259), '20 min 59 s')
  assert.equal(formatDuration(59), '59 s')
  assert.equal(formatDuration(null), '-')
})

test('formatReport lists the jobs, the major steps, the packages and the slowest files', () => {
  const report = formatReport({ runId: '39158838242', jobs: JOBS, testLog: parseTestLog(EXCERPT), top: 2 })

  assert.match(report, /^Run 39158838242: 21 min 00 s wall time/)
  assert.match(report, /verify\s+20 min 59 s\s+success/)
  assert.match(report, /1 min 09 s\s+Install dependencies/)
  assert.doesNotMatch(report, /Markdown links/)
  assert.match(report, /13 min 41 s\s+client/)
  assert.match(report, /494\.8 s\s+client\s+src\/features\/admin\/economy\/Economy\.test\.tsx/)
  assert.doesNotMatch(report, /Supervision/)
  assert.match(formatReport({ runId: '1', jobs: JOBS, all: true }), /Markdown links/)
})

test('formatReport without a test log lists only the jobs', () => {
  assert.doesNotMatch(formatReport({ runId: '1', jobs: JOBS }), /Slowest test files/)
})

test('testJobs picks the test jobs of the parallel workflow, or the one job that is named', () => {
  const jobs = [
    { name: 'changes', conclusion: 'success' },
    { name: 'static checks', conclusion: 'success' },
    { name: 'api tests', conclusion: 'success' },
    { name: 'client tests 1/3', conclusion: 'success' },
    { name: 'client tests 2/3', conclusion: null },
    { name: 'verify', conclusion: 'success' }
  ]
  assert.deepEqual(
    testJobs(jobs).map((job) => job.name),
    ['api tests', 'client tests 1/3', 'verify']
  )
  assert.deepEqual(
    testJobs(jobs, 'static checks').map((job) => job.name),
    ['static checks']
  )
})

test('mergeTestLogs joins the files and the package runs of several logs', () => {
  const merged = mergeTestLogs([
    { files: [{ file: 'a' }], packages: [{ package: 'api' }] },
    { files: [{ file: 'b' }], packages: [{ package: 'client' }] }
  ])
  assert.deepEqual(merged, {
    files: [{ file: 'a' }, { file: 'b' }],
    packages: [{ package: 'api' }, { package: 'client' }]
  })
})
