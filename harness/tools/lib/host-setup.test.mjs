import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { FRAMEWORK_DIR, loadModules } from './bootstrap.mjs'
import { decideHostSetup, hostAdapterOf, withRepositoryUrl } from './host-setup.mjs'
import { release } from './changelog.mjs'
import { init } from './init.mjs'
import { loadProfile } from './profile.mjs'

const dirs = []
const fresh = () => {
  const dir = mkdtempSync(join(tmpdir(), 'host-setup-'))
  dirs.push(dir)
  return dir
}
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

const saved = {}
const GIT_ENV = {
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@t',
  GIT_CONFIG_NOSYSTEM: '1'
}
before(() => {
  // The code under test commits: a fixed identity, and none of the machine's own Git configuration (a signing rule, a global hooks path)
  const folder = mkdtempSync(join(tmpdir(), 'git-config-'))
  dirs.push(folder)
  const config = join(folder, 'gitconfig')
  writeFileSync(config, '')
  for (const [key, value] of Object.entries({ ...GIT_ENV, GIT_CONFIG_GLOBAL: config })) {
    saved[key] = process.env[key]
    process.env[key] = value
  }
})
after(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
})

const modules = await loadModules(FRAMEWORK_DIR)
const profile = {
  repository: { slug: 'acme/shop' },
  adapters: { host: 'github' },
  branches: { production: 'main', integration: 'develop' }
}
const adapter = hostAdapterOf(profile, modules)

// A stand-in for `gh`: the host offers rulesets or does not or cannot be asked; the user administers the repository or not
function host({ rulesets = 'offered', admin = true } = {}) {
  const calls = []
  const cli = (args) => {
    calls.push(args)
    if (args.join(' ') === 'api repos/acme/shop/rulesets') {
      return {
        offered: { status: 0, stdout: '[]', stderr: '' },
        private: {
          status: 1,
          stdout: '',
          stderr: 'Upgrade to GitHub Pro or make this repository public to enable this feature.'
        },
        unreachable: { status: 1, stdout: '', stderr: 'could not resolve host' }
      }[rulesets]
    }
    if (args.includes('.permissions.admin')) {
      return { status: 0, stdout: `${admin}\n`, stderr: '' }
    }
    return { status: 0, stdout: '', stderr: '' }
  }
  return { cli, calls }
}
const decide = (options, extra = {}) =>
  decideHostSetup({ profile, adapter, harness: 'harness/tools/harness.mjs', cli: host(options).cli, ...extra })

test('a host that offers rulesets and an administrator get the protection applied, after one question in an interactive run', async () => {
  const asked = []
  const plan = await decide({}, { confirm: async (question) => (asked.push(question), true) })
  assert.equal(plan.profile.host.protection, true)
  assert.equal(plan.apply, true)
  assert.equal(asked.length, 1)
  assert.match(asked[0], /ruleset.*"allow auto-merge" on.*"delete head branches" off in acme\/shop\? \[Y\/n\]/)

  const declined = await decide({}, { confirm: async () => false })
  assert.equal(declined.apply, false)
  assert.equal(declined.profile.host.protection, true)
  assert.match(declined.messages[0], /not applied, as you answered.*host protect/)
  assert.equal((await decide({})).apply, true, 'a run with no terminal asks nothing')
})

test('a host that offers rulesets to a user without admin rights gets the files and one command for the owner', async () => {
  const plan = await decide({ admin: false })
  assert.equal(plan.apply, false)
  assert.equal(plan.profile.host.protection, true)
  assert.match(
    plan.messages[0],
    /you do not administer it.*ask an owner of the repository to run: node harness\/tools\/harness\.mjs host protect/
  )
})

test('a host that cannot protect the repository gets host.protection false and one line on what going public or a paid plan adds', async () => {
  const plan = await decide({ rulesets: 'private' })
  assert.equal(plan.profile.host.protection, false)
  assert.equal(plan.apply, false)
  assert.match(
    plan.messages[0],
    /host.protection is false.*auto-merge is off.*public, or a paid plan, adds the ruleset and auto-merge/
  )
})

test("a host that cannot be asked changes nothing and names the command, and a value the profile file has is the owner's", async () => {
  const plan = await decide({ rulesets: 'unreachable' })
  assert.equal(plan.profile.host, undefined)
  assert.equal(plan.apply, false)
  assert.match(
    plan.messages[0],
    /Host setup skipped.*could not resolve host.*run: node harness\/tools\/harness\.mjs host protect/
  )

  const set = { ...profile, host: { protection: false } }
  const asked = host()
  const kept = await decideHostSetup({ profile: set, adapter, harness: 'x', cli: asked.cli })
  assert.deepEqual([kept.profile, kept.apply, kept.messages], [set, false, []])
  assert.deepEqual(asked.calls, [], 'the host is not asked')
})

const FLAGS_PROFILE = {
  project: { name: 'acme' },
  adapters: { stacks: ['node-ts'], runtimes: ['claude-code'], host: 'github' }
}
const FLAGS = { nonInteractive: true, name: 'acme', repository: 'acme/shop', stack: 'node-ts', runtime: 'claude-code' }
async function bootstrapped(options, hostSetup) {
  const root = fresh()
  const lines = []
  const { code } = await init({
    root,
    flags: FLAGS,
    hostSetup,
    out: (line) => lines.push(line),
    err: (line) => lines.push(line)
  })
  return {
    code,
    output: lines.join('\n'),
    profile: JSON.parse(readFileSync(join(root, 'harness-profile.json'), 'utf8')),
    workflow: existsSync(join(root, '.github/workflows/update-branches.yml'))
  }
}

test('the bootstrap of a protectable repository sets the protection, auto-merge and the workflow, and leaves out the step that does it', async () => {
  const gh = host()
  const result = await bootstrapped({}, { cli: gh.cli })
  assert.equal(result.code, 0, result.output)
  assert.equal(result.profile.host.protection, true)
  assert.equal(result.workflow, true)
  assert.ok(gh.calls.some((call) => call.join(' ').includes('allow_auto_merge=true')))
  assert.ok(gh.calls.some((call) => call.includes('POST') && call.some((arg) => arg.endsWith('/rulesets'))))
  assert.match(result.output, /Host setup: setting the ruleset/)
  assert.doesNotMatch(result.output, /Protect both branches/)
  assert.match(result.output, /\n {2}2\. Read the scaffolded files/)
})

test('the bootstrap of a repository the host cannot protect has host.protection false, no workflow, and no step that protects', async () => {
  const gh = host({ rulesets: 'private' })
  const result = await bootstrapped({}, { cli: gh.cli })
  assert.equal(result.code, 0, result.output)
  assert.equal(result.profile.host.protection, false)
  assert.equal(result.workflow, false)
  assert.ok(!gh.calls.some((call) => call.includes('POST') || call.includes('PATCH')), 'nothing is set on the host')
  assert.match(result.output, /auto-merge is off/)
  assert.doesNotMatch(result.output, /Protect both branches/)
})

test('the bootstrap of a repository the user does not administer writes the files and names the command for the owner', async () => {
  const gh = host({ admin: false })
  const result = await bootstrapped({}, { cli: gh.cli })
  assert.equal(result.code, 0, result.output)
  assert.equal(result.profile.host.protection, true)
  assert.equal(result.workflow, true)
  assert.ok(!gh.calls.some((call) => call.includes('POST') || call.includes('PATCH')))
  assert.match(result.output, /ask an owner of the repository to run/)
  assert.match(result.output, /Protect both branches/)
})

test('without the host setup (--no-host-setup, or a caller that gives none) the host is not asked and the profile file has no host.protection', async () => {
  const result = await bootstrapped({}, false)
  assert.equal(result.code, 0, result.output)
  assert.equal(result.profile.host, undefined)
  assert.equal(result.workflow, true, 'by default the host protects, so the workflow is scaffolded')
  assert.match(result.output, /Protect both branches/)
})

test('a bootstrapped project has the address of its repository, and its first release writes real compare and tag links', async () => {
  const root = fresh()
  const { code } = await init({ root, flags: FLAGS, hostSetup: false })
  assert.equal(code, 0)
  const profile = loadProfile(root)
  assert.equal(profile.repository.url, 'https://github.com/acme/shop')

  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' })
  git('checkout', '-q', '-b', 'release/0.1.1')
  mkdirSync(join(root, profile.paths.changelogFragments), { recursive: true })
  writeFileSync(join(root, profile.paths.changelogFragments, 'first.md'), 'Added: the first thing.\n')
  git('add', '-A')
  git('commit', '-q', '-m', 'docs: a fragment')
  release({
    root,
    profile: { ...profile, release: { ...profile.release, lockCommand: undefined } },
    date: '2026-01-01'
  })

  const changelog = readFileSync(join(root, profile.paths.changelog), 'utf8')
  assert.match(changelog, /^\[Unreleased\]: https:\/\/github\.com\/acme\/shop\/compare\/v0\.1\.1\.\.\.HEAD$/m)
  assert.match(changelog, /^\[0\.1\.1\]: https:\/\/github\.com\/acme\/shop\/releases\/tag\/v0\.1\.1$/m)
  assert.doesNotMatch(changelog, /undefined/)
})

test('an address the profile file has is kept, and one the project has no host adapter for is not invented', async () => {
  const kept = fresh()
  writeFileSync(
    join(kept, 'harness-profile.json'),
    JSON.stringify({ ...FLAGS_PROFILE, repository: { slug: 'acme/shop', url: 'https://git.example.com/acme/shop' } })
  )
  const { code } = await init({ root: kept, flags: { nonInteractive: true }, hostSetup: false })
  assert.equal(code, 0)
  assert.equal(loadProfile(kept).repository.url, 'https://git.example.com/acme/shop')

  const profile = { repository: { slug: 'acme/shop' } }
  assert.deepEqual(withRepositoryUrl(profile, undefined), profile)
  assert.deepEqual(withRepositoryUrl(profile, { manifest: { roles: {} }, modules: {} }), profile)
  assert.equal(withRepositoryUrl(profile, adapter).repository.url, 'https://github.com/acme/shop')
})

test('the first steps of the selected adapters are in the next steps of the bootstrap and in the scaffolded stack file', async () => {
  const root = fresh()
  const lines = []
  const { code } = await init({
    root,
    flags: { ...FLAGS, stack: 'python' },
    hostSetup: false,
    out: (line) => lines.push(line),
    err: (line) => lines.push(line)
  })
  assert.equal(code, 0, lines.join('\n'))
  assert.match(lines.join('\n'), /\n {2}\d\. Python: run `uv lock` once and commit `uv\.lock`\./)
  const stack = readFileSync(join(root, 'docs/engineering/stack.md'), 'utf8')
  assert.match(stack, /Done once, by hand, after the bootstrap:\n\n- Python: run `uv lock` once/)

  const plain = fresh()
  const quiet = []
  await init({ root: plain, flags: FLAGS, hostSetup: false, out: (line) => quiet.push(line) })
  assert.doesNotMatch(quiet.join('\n'), /uv lock/)
  assert.doesNotMatch(readFileSync(join(plain, 'docs/engineering/stack.md'), 'utf8'), /Done once/)
})
