// The reports of users (task 3.16): the switches and their local override, what is triaged and how many a session, the candidates in the indexes, the
// verdicts (a duplicate, a close one, one fixed already, a regression, a new one, not a defect), the command, the hook line and the rules of the switches.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { reportRules, renderEntryBlock } from './entry.mjs'
import { parseIssueFile } from './issue-queue.mjs'
import { parseProcedure, procedureApplies } from './procedures.mjs'
import { reportsCommand } from './reports-command.mjs'
import {
  LOCAL_OVERRIDE_FILE,
  candidates,
  intakeLines,
  recordedReports,
  reportSettings,
  reporterVersion,
  selectForTriage,
  triagePlan,
  untriaged
} from './reports.mjs'
import { inapplicableSkillPaths, renderProceduresBlock } from './skills.mjs'
import { reportLinesOf, sessionStartMessage } from '../runtime-hooks/session-start.mjs'

const dirs = []
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))
const folder = () => {
  const dir = mkdtempSync(join(tmpdir(), 'reports-'))
  dirs.push(dir)
  return dir
}

const issue = (id, title, { status = '⬜', area = 'Git rules', reported = '—', fixedIn } = {}) =>
  parseIssueFile(
    `${id}.md`,
    `# ${id} — ${title}\n\n**Status:** ${status} · **Size:** 2 SP · **Area:** ${area} · **Reported:** ${reported}${fixedIn ? ` · **Fixed in:** ${fixedIn}` : ''}\n`
  )
const QUEUE = {
  open: [
    issue('I-1', 'The guard refuses a commit in another clone', { reported: '[#4](https://h/r/issues/4)' }),
    issue('I-2', 'Pipes in a task description break the split', { area: 'plan format' })
  ],
  archived: [
    issue('I-7', 'Symbolic links switch the hooks off', {
      status: '✅',
      area: 'runtime adapters',
      reported: '[#2](https://h/r/issues/2)',
      fixedIn: '0.1.2'
    })
  ]
}
const report = (number, title, body = '') => ({
  number,
  title,
  url: `https://h/r/issues/${number}`,
  state: 'open',
  body
})

test('the switches are the profile file’s, under a local override that is checked, and off where the host cannot list reports', () => {
  const root = folder()
  const profile = { reports: { intake: 'auto', triageLimit: 3, upstream: 'off' } }
  assert.deepEqual(reportSettings({ profile, root }), { intake: 'auto', triageLimit: 3, upstream: 'off', notes: [] })
  assert.equal(reportSettings({ profile: {}, root }).intake, 'off', 'without the role everything is off')

  writeFileSync(
    join(root, LOCAL_OVERRIDE_FILE),
    JSON.stringify({ reports: { intake: 'off', triageLimit: 1, upstream: 'maybe' } })
  )
  const overridden = reportSettings({ profile, root })
  assert.deepEqual([overridden.intake, overridden.triageLimit, overridden.upstream], ['off', 1, 'off'])
  assert.match(overridden.notes.join('\n'), /reports\.upstream "maybe" is not valid and is ignored/)

  writeFileSync(join(root, LOCAL_OVERRIDE_FILE), '{ not json')
  assert.match(reportSettings({ profile, root }).notes.join('\n'), /not valid JSON/)
  assert.equal(reportSettings({ profile, root }).intake, 'auto')

  rmSync(join(root, LOCAL_OVERRIDE_FILE))
  const incapable = reportSettings({ profile: { reports: { intake: 'auto', upstream: 'ask' } }, root, capable: false })
  assert.deepEqual([incapable.intake, incapable.upstream], ['off', 'off'])
  assert.match(incapable.notes.join('\n'), /no `reports` role/)
})

test('a report is triaged when an issue or a task records it, and a session triages no more than the limit, oldest first', () => {
  const recorded = recordedReports({
    queue: QUEUE,
    taskTexts: ['see [issue 30](https://github.com/o/r/issues/30) and #31']
  })
  assert.deepEqual(
    [...recorded].sort((a, b) => a - b),
    [2, 4, 30, 31]
  )
  const reports = [
    report(9, 'Nine'),
    report(4, 'Four'),
    report(31, 'Thirty-one'),
    report(12, 'Twelve'),
    report(5, 'Five'),
    report(20, 'Twenty')
  ]
  const waiting = untriaged(reports, recorded)
  assert.deepEqual(
    waiting.map((item) => item.number),
    [5, 9, 12, 20]
  )
  const { now, waiting: later } = selectForTriage(waiting, 3)
  assert.deepEqual(
    now.map((item) => item.number),
    [5, 9, 12]
  )
  assert.equal(later, 1)
})

test('the intake line of the session start: nothing when off, the list when notify, the limit when auto, and the error when the host cannot be read', () => {
  const reports = [report(5, 'Five'), report(9, 'Nine'), report(12, 'Twelve'), report(20, 'Twenty')]
  const recorded = new Set([4])
  assert.deepEqual(intakeLines({ settings: { intake: 'off' }, reports, recorded }), [])
  const notify = intakeLines({ settings: { intake: 'notify', triageLimit: 3 }, reports, recorded })
  assert.match(notify[0], /Reports: 4 open, 4 not triaged yet \(#5 Five; #9 Nine; #12 Twelve; #20 Twenty\)/)
  assert.match(notify[1], /Do not process them: the owner starts the triage/)
  const auto = intakeLines({ settings: { intake: 'auto', triageLimit: 3 }, reports, recorded })
  assert.match(
    auto[1],
    /Triage the first 3 before other work, by the procedure triage-reports \(at most 3 a session; 1 wait\)/
  )
  assert.match(
    intakeLines({ settings: { intake: 'auto' }, reports: [], recorded, error: 'gh not found' })[0],
    /could not be read from the host \(gh not found\)/
  )
  assert.match(
    intakeLines({ settings: { intake: 'auto', triageLimit: 3 }, reports: [report(4, 'Four')], recorded })[0],
    /1 open, 0 not triaged yet\./
  )
})

test('a report is compared with the indexes first: the titles and areas of the open and archived issues, and the open tasks', () => {
  const tasks = [{ id: '3.4', title: 'Adapters of a project’s own repository (local:)' }]
  const symlink = candidates({
    report: report(40, 'Hooks do nothing through a symbolic link', 'Version: 0.1.1. runtime hooks'),
    queue: QUEUE,
    tasks
  })
  assert.equal(symlink[0].id, 'I-7')
  assert.equal(symlink[0].where, 'archive')
  assert.equal(symlink[0].fixedIn, '0.1.2')
  const guard = candidates({ report: report(41, 'The guard refuses my commit in another clone'), queue: QUEUE, tasks })
  assert.equal(guard[0].id, 'I-1')
  assert.deepEqual(candidates({ report: report(42, 'Something unrelated entirely'), queue: QUEUE, tasks }), [])
  assert.equal(reporterVersion(report(1, 't', 'Framework version: 0.1.1\n')), '0.1.1')
  assert.equal(reporterVersion(report(1, 'no version here')), null)
})

test('the verdicts: a duplicate, a close one, one fixed already, a regression, a new one, and not a defect', () => {
  const open = { id: 'I-1', where: 'open' }
  const fixed = { id: 'I-7', where: 'archive', fixedIn: '0.1.2' }
  assert.deepEqual(triagePlan({ relation: 'same', candidate: open }).steps, [
    'add the report to the `Reported:` of I-1',
    'answer the report as a duplicate of I-1'
  ])
  assert.match(
    triagePlan({ relation: 'close', candidate: open }).steps[0],
    /add a new issue to the queue that names the related I-1/
  )
  assert.deepEqual(triagePlan({ relation: 'same', candidate: fixed, version: '0.1.1' }).steps, [
    'add the report to the `Reported:` of I-7',
    'answer the report: fixed in 0.1.2'
  ])
  const regression = triagePlan({ relation: 'same', candidate: fixed, version: '0.1.2' }).steps
  assert.match(regression[0], /a regression: I-7 was fixed in 0\.1\.2 and the reporter's version 0\.1\.2 has the fix/)
  assert.match(regression[1], /add a new issue that links I-7/)
  assert.match(
    triagePlan({ relation: 'different' }).steps[0],
    /add a new issue to the queue, with the report in its `Reported:`/
  )
  assert.match(
    triagePlan({ relation: 'same', candidate: null }).steps[0],
    /add a new issue/,
    'no candidate, a new issue'
  )
  const notDefect = triagePlan({ relation: 'not-a-defect' })
  assert.match(notDefect.steps.join(' '), /productGeneric/)
  assert.ok(
    notDefect.approval && triagePlan({ relation: 'different' }).approval,
    'what is said on the host needs the owner'
  )
  assert.throws(() => triagePlan({ relation: 'maybe' }), /the relation is one of/)
})

// A host adapter that answers from a list, and records what was said to it
function fakeHost(reports, said = []) {
  return {
    manifest: { roles: { reports: { module: 'reports.mjs' } } },
    modules: {
      'reports.mjs': {
        listReports: () => reports,
        showReport: ({ number }) => reports.find((item) => item.number === Number(number)),
        searchReports: ({ text }) => reports.filter((item) => item.title.includes(text)),
        commentReport: (call) => said.push(['comment', call]),
        closeReport: (call) => said.push(['close', call]),
        createReport: (call) => (said.push(['create', call]), 'https://h/r/issues/99'),
        slugOfUrl: (url) => /github\.com\/(.+?)(?:\.git)?$/.exec(url)?.[1] ?? null
      }
    }
  }
}

function project() {
  const root = folder()
  mkdirSync(join(root, 'plan/issues/archived'), { recursive: true })
  const write = (path, text) => writeFileSync(join(root, path), text)
  write('plan/issues/README.md', '# Issue queue\n\n<!-- issue-queue:start -->\n<!-- issue-queue:end -->\n')
  write('plan/issues/archived/README.md', '# Archived\n\n<!-- issue-queue:start -->\n<!-- issue-queue:end -->\n')
  write(
    'plan/issues/I-1.md',
    '# I-1 — The guard refuses a commit in another clone\n\n**Status:** ⬜ · **Size:** 2 SP · **Area:** Git rules · **Reported:** [#4](https://h/r/issues/4)\n'
  )
  write(
    'plan/issues/archived/I-7.md',
    '# I-7 — Symbolic links switch the hooks off\n\n**Status:** ✅ · **Size:** 2 SP · **Area:** runtime adapters · **Reported:** [#2](https://h/r/issues/2) · **Fixed in:** 0.1.2\n'
  )
  write(
    'harness.lock.json',
    JSON.stringify({ mode: 'pinned', source: { type: 'git', url: 'https://github.com/o/framework' } })
  )
  const profile = {
    adapters: { host: 'fake' },
    repository: { slug: 'o/app' },
    paths: { phases: 'plan/phases', planIndex: 'plan/README.md', issues: 'plan/issues' },
    reports: { intake: 'auto', triageLimit: 2, upstream: 'ask' }
  }
  return { root, profile }
}

test('the command lists what is not triaged, compares a report with the indexes, and prints what a verdict does', () => {
  const { root, profile } = project()
  const hosts = {
    fake: fakeHost([
      report(2, 'Hooks do nothing through a symbolic link', 'Version: 0.1.1'),
      report(4, 'Guard'),
      report(5, 'Five'),
      report(6, 'Six')
    ])
  }
  const run = (words, flags = {}) => reportsCommand({ words, flags, root, profile, hosts })

  assert.deepEqual(run(['status']).lines, ['intake: auto', 'triageLimit: 2', 'upstream: ask'])
  const list = run(['list', '--untriaged'], { untriaged: true })
  assert.deepEqual(
    list.lines.filter((line) => line.startsWith('#')).map((line) => line.split(' ')[0]),
    ['#5', '#6']
  )
  assert.match(list.lines.at(-1), /2 to triage in a session of 2 at most/)

  const found = run(['candidates', '2'])
  assert.match(found.lines[0], /reporter's version 0\.1\.1/)
  assert.match(
    found.lines[1],
    /^I-7 \[archive\] Symbolic links switch the hooks off \(runtime adapters\); fixed in 0\.1\.2/
  )
  assert.match(run(['candidates', '5']).lines[1], /no candidate in the indexes/)

  assert.match(
    run(['plan'], { relation: 'same', candidate: 'I-7', version: '0.1.1' }).lines[1],
    /2\. answer the report: fixed in 0\.1\.2/
  )
  assert.match(run(['plan'], { relation: 'same', candidate: 'I-7', version: '0.1.2' }).lines[0], /1\. a regression/)
  assert.equal(run(['plan'], { relation: 'weird' }).code, 1)
  assert.equal(run(['search', 'symbolic']).lines.length, 1)
  assert.match(run(['show', '4']).lines[0], /#4 \[open\] Guard/)
  assert.equal(run(['nonsense']).code, 1)
})

test('what is said on the host needs the owner’s approval, and a report upstream follows the upstream switch', () => {
  const { root, profile } = project()
  const said = []
  const hosts = { fake: fakeHost([report(4, 'Guard')], said) }
  const run = (words, flags = {}, settings = profile) =>
    reportsCommand({ words, flags, root, profile: settings, hosts })

  for (const [words, flags] of [
    [['comment', '4'], { body: 'thanks' }],
    [['close', '4'], {}],
    [['create'], { title: 'T', body: 'B', upstream: true }]
  ]) {
    const refused = run(words, flags)
    assert.equal(refused.code, 1)
    assert.match(refused.lines[0], /needs the owner's approval: ask, then run it again with --approved/)
  }
  assert.deepEqual(said, [])

  assert.equal(run(['comment', '4'], { body: 'thanks', approved: true }).code, 0)
  assert.equal(run(['close', '4'], { approved: true }).code, 0)
  assert.deepEqual(
    said.map(([what]) => what),
    ['comment', 'close']
  )
  assert.equal(said[0][1].slug, 'o/app')

  // Upstream: the framework's repository comes from the lock; `ask` needs approval, `post` does not, `off` refuses
  assert.match(
    run(['create'], { title: 'T', body: 'B', upstream: true, approved: true }).lines[0],
    /https:\/\/h\/r\/issues\/99/
  )
  assert.equal(said.at(-1)[1].slug, 'o/framework')
  const post = { ...profile, reports: { ...profile.reports, upstream: 'post' } }
  assert.equal(run(['create'], { title: 'T', body: 'B', upstream: true }, post).code, 0)
  const off = { ...profile, reports: { ...profile.reports, upstream: 'off' } }
  assert.match(
    run(['create'], { title: 'T', body: 'B', upstream: true, approved: true }, off).lines[0],
    /reporting upstream is off/
  )
  writeFileSync(
    join(root, 'harness.lock.json'),
    JSON.stringify({ mode: 'pinned', source: { type: 'path', location: 'framework' } })
  )
  assert.match(run(['create'], { title: 'T', body: 'B', upstream: true, approved: true }).lines[0], /cannot be told/)
})

test('a host without the reports role keeps the switches off', () => {
  const { root, profile } = project()
  const result = reportsCommand({
    words: ['list'],
    flags: {},
    root,
    profile,
    hosts: { fake: { manifest: { roles: {} }, modules: {} } }
  })
  assert.equal(result.code, 1)
  assert.match(result.lines[0], /has no `reports` role/)
  assert.deepEqual(
    reportsCommand({
      words: ['status'],
      flags: {},
      root,
      profile,
      hosts: { fake: { manifest: { roles: {} }, modules: {} } }
    }).lines.slice(0, 3),
    ['intake: off', 'triageLimit: 2', 'upstream: off']
  )
})

test('the session start prints the intake lines once, and says so when the host cannot be read', async () => {
  const { root, profile } = project()
  const host = fakeHost([report(4, 'Guard'), report(5, 'Five')]).modules['reports.mjs']
  const list = (path) =>
    path === 'plan/issues' ? ['README.md', 'I-1.md'] : path === 'plan/issues/archived' ? ['README.md', 'I-7.md'] : []
  const readText = (path) => readFileSyncAt(join(root, path), 'utf8')
  const lines = await reportLinesOf({ root, profile, readText, list, host })
  assert.match(lines[0], /Reports: 2 open, 1 not triaged yet \(#5 Five\)/)
  const broken = await reportLinesOf({
    root,
    profile,
    readText,
    list,
    host: {
      listReports: () => {
        throw new Error('gh is down\nmore')
      }
    }
  })
  assert.deepEqual(broken, ['Reports: could not be read from the host (gh is down).'])
  assert.deepEqual(
    await reportLinesOf({ root, profile: { ...profile, reports: { intake: 'off' } }, readText, list, host }),
    []
  )

  const message = sessionStartMessage('feature/x', readText, list, 'plan/phases', 'docs/method.md', null, null, lines)
  assert.match(message, /Reports: 2 open[^]*Read the method/)
})

import { readFileSync as readFileSyncAt } from 'node:fs'

test('a procedure with a switch applies only when the switch is on: no skill and no row of the reading map otherwise', () => {
  const triage = parseProcedure(
    '---\nname: triage-reports\ndescription: Use when reports come in.\ninvocation: explicit\nwhen: reports.intake\n---\n\nbody here\n'
  )
  assert.equal(triage.when, 'reports.intake')
  assert.equal(procedureApplies(triage, { reports: { intake: 'auto' } }), true)
  assert.equal(procedureApplies(triage, { reports: { intake: 'notify' } }), true)
  assert.equal(procedureApplies(triage, { reports: { intake: 'off' } }), false)
  assert.equal(procedureApplies(triage, {}), false)
  assert.equal(
    procedureApplies(parseProcedure('---\nname: x\ndescription: d\ninvocation: auto\n---\nbody\n'), {}),
    true
  )

  const documents = { rules: 'AGENTS.md' }
  const off = renderProceduresBlock({ documents, reports: { intake: 'off', upstream: 'off' } }, [triage])
  assert.doesNotMatch(off, /triage-reports/)
  assert.match(renderProceduresBlock({ documents, reports: { intake: 'auto' } }, [triage]), /triage-reports/)

  const runtimes = {
    'claude-code': {
      manifest: { roles: { 'procedure-packaging': { module: 'm' } } },
      modules: { m: { skillPath: (procedure) => `.claude/skills/${procedure.name}/SKILL.md` } }
    }
  }
  assert.deepEqual(
    inapplicableSkillPaths({ adapters: { runtimes: ['claude-code'] }, reports: { intake: 'off' } }, runtimes, [triage]),
    ['.claude/skills/triage-reports/SKILL.md']
  )
  assert.deepEqual(
    inapplicableSkillPaths({ adapters: { runtimes: ['claude-code'] }, reports: { intake: 'auto' } }, runtimes, [
      triage
    ]),
    []
  )
})

test('a switch that is on adds one line to the Git rules of the entry file, pointing to its procedure, and a switch that is off adds nothing', () => {
  const base = {
    branches: { integration: 'dev', production: 'prod' },
    repository: { host: 'Host' },
    host: { protection: true, autoMerge: true },
    paths: { profileDocument: 'docs/profile.md', issues: 'docs/issues' },
    documents: { rules: 'AGENTS.md', method: 'harness/core/method/method.md', stack: 'docs/stack.md' }
  }
  const none = renderEntryBlock('git-rules', base)
  assert.doesNotMatch(none, /triage-reports|report-upstream/)
  assert.deepEqual(reportRules(base), [])

  const auto = renderEntryBlock('git-rules', { ...base, reports: { intake: 'auto', upstream: 'off' } })
  assert.equal(auto.match(/triage-reports/g).length, 1)
  assert.match(
    auto,
    /Triage the open reports of users before other work[^]*Answers and closings on the host need the owner's approval/
  )
  assert.match(
    renderEntryBlock('git-rules', { ...base, reports: { intake: 'notify' } }),
    /\*\*Do not process them\*\*: the owner starts the triage/
  )
  const upstream = renderEntryBlock('git-rules', { ...base, reports: { intake: 'off', upstream: 'ask' } })
  assert.match(upstream, /report-upstream/)
  assert.doesNotMatch(upstream, /triage-reports/)
  assert.ok(none.length < upstream.length && none.length < auto.length)
  assert.match(auto, /\[profile\]\(\.\/docs\/profile\.md\)/, 'links are written relative to the entry file')
})
