import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { after, test } from 'node:test'
import { buildRuleset, detectProtection, protect, runGh } from './protect.mjs'

const profile = (overrides = {}) => ({
  repository: { slug: 'owner/name' },
  branches: { production: 'prod', integration: 'dev' },
  requiredChecks: ['verify', 'pr-title'],
  host: { protection: true },
  ...overrides
})

// A stand-in for `gh`: answers by the first words of the request and keeps every call
function standIn({ rulesets = { status: 0, stdout: '[]' }, existing } = {}) {
  const calls = []
  const gh = (args, input) => {
    calls.push({ args, input })
    if (args[0] === 'api' && args.length === 2 && args[1].endsWith('/rulesets')) {
      return existing ? { status: 0, stdout: JSON.stringify([existing]), stderr: '' } : { stderr: '', ...rulesets }
    }
    return { status: 0, stdout: '', stderr: '' }
  }
  return { gh, calls }
}

test('the ruleset protects the two branches and requires the checks of the profile file', () => {
  const ruleset = buildRuleset(profile())
  assert.deepEqual(ruleset.conditions.ref_name.include, ['refs/heads/prod', 'refs/heads/dev'])
  const checks = ruleset.rules.find((rule) => rule.type === 'required_status_checks').parameters.required_status_checks
  assert.deepEqual(checks, [{ context: 'verify' }, { context: 'pr-title' }])
  assert.deepEqual(
    ruleset.rules.map((rule) => rule.type),
    ['deletion', 'non_fast_forward', 'pull_request', 'required_status_checks']
  )
  assert.equal(
    ruleset.bypass_actors[0].bypass_mode,
    'pull_request',
    'administrators bypass only when merging a pull request'
  )
})

test('protect allows auto-merge by default and when host.autoMerge is on, and turns it off with host.autoMerge: false, keeping merged branches either way', () => {
  const patch = (host) => {
    const { gh, calls } = standIn()
    protect({ profile: profile({ host }), cli: gh })
    return calls.find((call) => call.args.includes('PATCH')).args.join(' ')
  }
  assert.match(patch({ protection: true }), /-F delete_branch_on_merge=false -F allow_auto_merge=true$/)
  assert.match(patch({ protection: true, autoMerge: true }), /allow_auto_merge=true$/)
  assert.match(patch({ protection: true, autoMerge: false }), /delete_branch_on_merge=false -F allow_auto_merge=false$/)
  const { gh } = standIn()
  assert.match(protect({ profile: profile(), cli: gh }).messages[1], /Merged branches are kept; auto-merge is allowed/)
})

test('detectProtection says whether the user administers the repository, and nothing when the host does not say', () => {
  const answer = (admin) => (args) =>
    args.includes('.permissions.admin') ? admin : { status: 0, stdout: '[]', stderr: '' }
  const detect = (admin) => detectProtection({ slug: 'owner/name', cli: answer(admin) })
  assert.equal(detect({ status: 0, stdout: 'true\n', stderr: '' }).admin, true)
  assert.equal(detect({ status: 0, stdout: 'false\n', stderr: '' }).admin, false)
  assert.equal(detect({ status: 1, stdout: '', stderr: 'nope' }).admin, undefined)
  assert.equal(detect({ status: 0, stdout: 'maybe', stderr: '' }).admin, undefined)
})

test('protect keeps merged branches, creates the ruleset and removes the classic protection', () => {
  const { gh, calls } = standIn()
  const { messages, problems } = protect({ profile: profile(), cli: gh })
  assert.deepEqual(problems, [])
  const post = calls.find((call) => call.args.includes('POST'))
  assert.deepEqual(JSON.parse(post.input), buildRuleset(profile()))
  assert.ok(
    calls.some(
      (call) =>
        call.args.join(' ') === 'api -X PATCH repos/owner/name -F delete_branch_on_merge=false -F allow_auto_merge=true'
    )
  )
  assert.deepEqual(
    calls.filter((call) => call.args.includes('DELETE')).map((call) => call.args[3]),
    ['repos/owner/name/branches/prod/protection', 'repos/owner/name/branches/dev/protection']
  )
  assert.match(messages[0], /Ruleset protected-branches applied to prod and dev in owner\/name/)
})

test('protect replaces a ruleset of the same name, and is the same request twice', () => {
  const { gh, calls } = standIn({ existing: { id: 42, name: 'protected-branches' } })
  protect({ profile: profile(), cli: gh })
  assert.ok(calls.some((call) => call.args.join(' ').startsWith('api -X PUT repos/owner/name/rulesets/42')))
  assert.ok(!calls.some((call) => call.args.includes('POST')))
})

test('the host answering that rulesets need a public repository or a paid plan means protection is not available', () => {
  const needs = {
    status: 1,
    stdout: '',
    stderr: 'gh: Upgrade to GitHub Pro or make this repository public to enable this feature. (HTTP 403)'
  }
  assert.deepEqual(detectProtection({ slug: 'owner/name', cli: standIn({ rulesets: needs }).gh }).available, false)
  assert.equal(detectProtection({ slug: 'owner/name', cli: standIn().gh }).available, true)
})

test('an answer that is neither a ruleset list nor the plan notice is an error, not a guess', () => {
  const offline = { status: 1, stdout: '', stderr: 'error connecting to api.github.com' }
  assert.throws(
    () => detectProtection({ slug: 'owner/name', cli: standIn({ rulesets: offline }).gh }),
    /cannot tell whether the host can protect owner\/name/
  )
})

test('a profile that says the host protects, when it cannot, fails and changes nothing', () => {
  const needs = { status: 1, stdout: '', stderr: 'Upgrade to GitHub Pro or make this repository public' }
  const { gh, calls } = standIn({ rulesets: needs })
  const { problems } = protect({ profile: profile(), cli: gh })
  assert.match(problems[0], /host\.protection is true in the profile file, but .*set host\.protection to false/)
  assert.equal(calls.length, 1, 'only the detection ran')
})

test('a profile that says the host cannot protect, when it can, fails too; when both say no there is nothing to do', () => {
  const unprotected = profile({ host: { protection: false } })
  assert.match(protect({ profile: unprotected, cli: standIn().gh }).problems[0], /set host\.protection to true/)

  const needs = { status: 1, stdout: '', stderr: 'Upgrade to GitHub Pro' }
  const { gh, calls } = standIn({ rulesets: needs })
  const result = protect({ profile: unprotected, cli: gh })
  assert.deepEqual(result.problems, [])
  assert.match(result.messages[0], /Nothing to protect/)
  assert.equal(calls.length, 1)
})

test('a failing request names the call and stops', () => {
  const gh = (args) =>
    args.includes('PATCH') ? { status: 1, stdout: '', stderr: 'HTTP 403' } : { status: 0, stdout: '[]', stderr: '' }
  assert.throws(() => protect({ profile: profile(), cli: gh }), /gh api -X PATCH failed: HTTP 403/)
})

// The real runner against a stand-in executable on the path: the request that leaves the process is the one the tests above see
const dirs = []
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

test('runGh passes the arguments and the standard input to the gh command', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gh-stand-in-'))
  dirs.push(dir)
  const log = join(dir, 'log.txt')
  writeFileSync(join(dir, 'gh'), `#!/bin/sh\necho "$@" > '${log}'\ncat >> '${log}'\n`)
  chmodSync(join(dir, 'gh'), 0o755)
  const path = process.env.PATH
  process.env.PATH = `${dir}:${path}`
  try {
    assert.equal(runGh(['api', 'x'], 'body').status, 0)
  } finally {
    process.env.PATH = path
  }
  assert.equal(readFileSync(log, 'utf8'), 'api x\nbody')
})

test('harness host protect applies the ruleset through a gh on the path (the request of the profile file reaches the host)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gh-cli-'))
  dirs.push(dir)
  const sent = join(dir, 'ruleset.json')
  writeFileSync(
    join(dir, 'gh'),
    `#!/bin/sh\ncase "$*" in\n  *--input*) cat > '${sent}';;\n  "api repos/owner/name/rulesets") echo '[]';;\nesac\n`
  )
  chmodSync(join(dir, 'gh'), 0o755)
  const project = mkdtempSync(join(tmpdir(), 'gh-project-'))
  dirs.push(project)
  writeFileSync(
    join(project, 'harness-profile.json'),
    JSON.stringify({
      repository: { slug: 'owner/name' },
      branches: { production: 'prod', integration: 'dev' },
      requiredChecks: ['verify'],
      adapters: { stacks: ['x'], host: 'github' }
    })
  )
  const harness = join(import.meta.dirname, '..', '..', '..', 'tools', 'harness.mjs')
  const output = execFileSync('node', [harness, 'host', 'protect', '--root', project], {
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
    encoding: 'utf8'
  })
  assert.match(output, /Ruleset protected-branches applied to prod and dev in owner\/name/)
  const ruleset = JSON.parse(readFileSync(sent, 'utf8'))
  assert.deepEqual(ruleset.conditions.ref_name.include, ['refs/heads/prod', 'refs/heads/dev'])
})
