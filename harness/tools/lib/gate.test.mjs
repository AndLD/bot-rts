import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import { isDocumentationOnly } from './changes.mjs'
import { changedFiles, planPush, rangesOfPush, runGate, UNREADABLE } from './gate.mjs'
import { STACKS } from './stacks.mjs'

const profile = (overrides = {}) => ({
  branches: { production: 'main', integration: 'develop' },
  coveragePackages: ['api', 'client', 'mcp'],
  adapters: { stacks: ['node-ts'], host: 'github' },
  gate: {
    outside: ['.github/**'],
    isolated: ['scripts/**', 'docs/**', 'harness/**', 'harness.lock.json'],
    needs: { database: ['api'] },
    prepare: { database: 'scripts/database.mjs' },
    steps: [
      { label: 'script tests', run: [['npm', 'run', 'test:scripts']], when: ['scripts/**'] },
      {
        label: 'generated files are up to date',
        run: [['npm', 'run', 'generate']],
        unlessOnly: ['mcp/**', 'scripts/**'],
        diff: ['api/openapi.json'],
        hint: 'Commit the regenerated files first'
      }
    ]
  },
  ...overrides
})
const plan = (files, overrides) => planPush(files, { profile: profile(overrides), exists: () => true })
const labels = (result) => [...new Set(result.steps.map((step) => step.label))]

test('a push that changes no file runs nothing (the empty claim push)', () => {
  assert.equal(plan([]).skip, 'the push changes no file')
  assert.equal(plan(['', '']).skip, 'the push changes no file')
})

test('a push that changes only Markdown runs the documentation checks and no code check', () => {
  const result = plan(['docs/profile.md', 'README.md'])
  assert.equal(result.skip, null)
  assert.deepEqual(result.steps, [{ label: 'documentation checks', command: 'harness', args: ['check', 'all'] }])
  assert.match(result.note, /only documentation/)
})

test('a push that changes code and Markdown runs the documentation checks too, first', () => {
  const result = plan(['README.md', 'client/src/a.ts'])
  assert.equal(result.steps[0].label, 'documentation checks')
  assert.ok(labels(result).includes('typecheck client'))
  assert.ok(!labels(plan(['client/src/a.ts'])).includes('documentation checks'))
})

test('one package: the checks of that package only, and the steps of the project that apply', () => {
  const result = plan(['client/src/a.ts'])
  assert.ok(!labels(result).some((label) => /api|mcp/.test(label)))
  assert.ok(labels(result).includes('generated files are up to date'))
  assert.ok(
    !labels(plan(['mcp/src/a.ts'])).includes('generated files are up to date'),
    'a change that stays in mcp cannot make them stale'
  )
  assert.ok(labels(plan(['scripts/a.mjs'])).includes('script tests'))
  assert.ok(!labels(plan(['client/src/a.ts'])).includes('script tests'))
})

test('a project step with commands and a diff check expands into them, the diff check carrying its hint', () => {
  const steps = plan(['api/src/a.ts']).steps.filter((step) => step.label === 'generated files are up to date')
  assert.deepEqual(
    steps.map((step) => [step.command, ...step.args].join(' ')),
    ['npm run generate', 'git diff --exit-code -- api/openapi.json']
  )
  assert.equal(steps[1].hint, 'Commit the regenerated files first')
})

test('the steps of a package that needs a database carry the need, and the others do not', () => {
  const steps = plan(['api/src/a.ts', 'client/src/b.ts']).steps
  assert.ok(steps.filter((step) => step.package === 'api').every((step) => step.need === 'database'))
  assert.ok(steps.filter((step) => step.package === 'client').every((step) => !step.need))
  assert.ok(steps.some((step) => step.need === 'database'))
})

test('files outside the gate need no check, and isolated ones no full run', () => {
  const outside = plan(['.github/workflows/ci.yml'])
  assert.equal(outside.skip, null)
  assert.deepEqual(
    outside.steps.map((step) => step.label),
    []
  )
  assert.ok(!labels(plan(['scripts/a.mjs'])).includes('typecheck'))
  assert.ok(labels(plan(['lib/a.ts'])).includes('typecheck'))
})

test('the gate and CI agree on what is documentation only: one rule', () => {
  const cases = [
    ['README.md', 'docs/plan.md'],
    ['harness/core/method/method.md'],
    ['README.md', 'api/src/x.ts'],
    ['.github/workflows/ci.yml'],
    ['docs/profile.md', 'package.json']
  ]
  for (const files of cases) {
    const result = plan(files)
    const onlyDocumentation = result.steps.every((step) => step.label === 'documentation checks')
    assert.equal(onlyDocumentation && result.steps.length > 0, isDocumentationOnly(files), files.join(', '))
  }
  const patterns = ['**/*.md', 'docs/**']
  const withDocsFolder = plan(['docs/report/chart.svg'], { checks: { documentationPaths: patterns } })
  assert.deepEqual(labels(withDocsFolder), ['documentation checks'])
})

// Two stacks: the node-ts preset for the client and a stand-in for a second stack, each owning its folders
const second = {
  manifest: { roles: { 'local-gate-plan': { module: 'gate.mjs' } } },
  modules: {
    'gate.mjs': {
      plan: ({ files, packages }) => ({
        steps: [{ label: `second stack ${packages.join(',')}`, command: 'check', args: files }],
        coveragePackages: []
      })
    }
  }
}

test('with two stacks each changed file goes to the stack that owns it, and a file no stack owns to none', () => {
  const two = {
    adapters: {
      stacks: [
        { adapter: 'node-ts', packages: ['client'] },
        { adapter: 'second', packages: ['service'] }
      ],
      host: 'github'
    },
    coveragePackages: ['client', 'service']
  }
  const stacks = { 'node-ts': STACKS['node-ts'], second }
  const run = (files) => planPush(files, { profile: profile(two), stacks, exists: () => true })

  const client = run(['client/src/a.ts'])
  assert.ok(labels(client).includes('typecheck client'))
  assert.ok(!labels(client).some((label) => label.startsWith('second')))

  const service = run(['service/app.py'])
  const own = service.steps.find((step) => step.label.startsWith('second'))
  assert.deepEqual(
    [own.label, own.args],
    ['second stack service', ['service/app.py']],
    'the second stack plans for its folder and its files only'
  )
  assert.ok(!labels(service).some((label) => /client/.test(label)))

  const both = run(['client/src/a.ts', 'service/app.py'])
  assert.ok(labels(both).includes('typecheck client') && labels(both).includes('second stack service'))
  assert.ok(
    !run(['package-lock.json']).steps.some(
      (step) => step.label.includes('typecheck') || step.label.startsWith('second')
    ),
    'a root file is no stack’s'
  )
})

test('rangesOfPush reads the refs of a push: new branches against the integration branch, deletions skipped', () => {
  const zero = '0'.repeat(40)
  const stdin = [
    `refs/heads/a aaaa refs/heads/a ${zero}`,
    `refs/heads/b bbbb refs/heads/b cccc`,
    `refs/heads/c ${zero} refs/heads/c dddd`,
    ''
  ].join('\n')
  assert.deepEqual(rangesOfPush(stdin, 'develop'), ['origin/develop..aaaa', 'cccc..bbbb'])
  assert.deepEqual(rangesOfPush('', 'develop'), [])
})

const dirs = []
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

test('the files of a push come from Git, and a range that cannot be read makes the gate run everything', () => {
  const root = mkdtempSync(join(tmpdir(), 'gate-git-'))
  dirs.push(root)
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: root, encoding: 'utf8' }).trim()
  git('init', '--quiet', '--initial-branch', 'develop')
  writeFileSync(join(root, 'a.txt'), 'a')
  git('add', '.')
  git('commit', '--quiet', '-m', 'one')
  const first = git('rev-parse', 'HEAD')
  mkdirSync(join(root, 'src'))
  writeFileSync(join(root, 'src', 'b.ts'), 'b')
  git('add', '.')
  git('commit', '--quiet', '-m', 'two')
  assert.deepEqual(changedFiles(root, [`${first}..HEAD`]), ['src/b.ts'])
  assert.deepEqual(changedFiles(root, [`${'f'.repeat(40)}..HEAD`]), [UNREADABLE])
})

// The run of a plan, with the steps' processes and the project's preparation stood in for
function gateRun({ results = {}, prepare, stdin = 'refs/heads/x HEAD refs/heads/x ' }) {
  const root = mkdtempSync(join(tmpdir(), 'gate-run-'))
  dirs.push(root)
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: root, stdio: 'pipe' })
  mkdirSync(join(root, 'api', 'src'), { recursive: true })
  writeFileSync(join(root, 'api', 'src', 'a.ts'), 'a')
  git('init', '--quiet', '--initial-branch', 'develop')
  git('add', '.')
  git('commit', '--quiet', '-m', 'start')
  const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  writeFileSync(join(root, 'api', 'src', 'b.ts'), 'b')
  git('add', '.')
  git('commit', '--quiet', '-m', 'change')
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  const ran = []
  const out = []
  const err = []
  const run = (step) => {
    ran.push(`${step.command} ${step.args.join(' ')}`.trim())
    return results[step.command] ?? results[step.label] ?? 0
  }
  const promise = runGate({
    root,
    profile: profile(),
    stdin: `refs/heads/x ${head} refs/heads/x ${base}`,
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    run,
    prepare
  })
  return promise.then((code) => ({ code, ran, out, err }))
}

test('a failing test fails the push with its exit code, names the step and runs nothing after it', async () => {
  const result = await gateRun({ results: { 'typecheck api': 0, 'lint api': 3 }, prepare: async () => ({}) })
  assert.equal(result.code, 3)
  assert.deepEqual(result.err, ['pre-push: "lint api" failed'])
  assert.ok(!result.ran.some((command) => command.includes('test:coverage') || command.includes('jest')))
})

test('a passing push runs every step in order, announcing each once', async () => {
  const result = await gateRun({ prepare: async () => ({ message: 'a database answers' }) })
  assert.equal(result.code, 0)
  assert.match(
    result.out[0],
    /pre-push: 1 changed file\(s\); checks: typecheck api, lint api, format changed files, tests related to 1 changed file\(s\) of api/
  )
  assert.equal(result.out.filter((line) => line === 'pre-push: lint api').length, 1)
  assert.ok(result.out.includes('a database answers'))
  assert.ok(result.ran.at(-1).startsWith('git diff --exit-code'))
})

test('a need is prepared once, before the first step that has it; when the preparation stops the push, nothing runs', async () => {
  const prepared = []
  const passed = await gateRun({ prepare: async (need) => void prepared.push(need) })
  assert.equal(passed.code, 0)
  assert.deepEqual(prepared, ['database'])

  const stopped = await gateRun({
    prepare: async () => {
      throw new Error('start Docker Desktop, then push again')
    }
  })
  assert.equal(stopped.code, 1)
  assert.deepEqual(stopped.err, ['start Docker Desktop, then push again'])
  assert.ok(!stopped.ran.some((command) => command.includes('jest')), 'the tests did not run')
})

test('a failed diff check prints the hint of the step', async () => {
  const result = await gateRun({ results: { git: 1 }, prepare: async () => ({}) })
  assert.equal(result.code, 1)
  assert.deepEqual(result.err.slice(-2), [
    'pre-push: "generated files are up to date" failed',
    'Commit the regenerated files first'
  ])
})

test('--dry-run prints the plan and runs nothing', async () => {
  const root = mkdtempSync(join(tmpdir(), 'gate-dry-'))
  dirs.push(root)
  mkdirSync(dirname(join(root, 'x')), { recursive: true })
  const ran = []
  const out = []
  const code = await runGate({
    root,
    profile: profile(),
    stdin: '',
    dryRun: true,
    out: (line) => out.push(line),
    err: () => {},
    run: (step) => ran.push(step)
  })
  assert.equal(code, 0)
  assert.deepEqual(ran, [])
  assert.match(out[0], /the push changes no file/)
})
