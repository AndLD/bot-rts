import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import { sessionStartMessage } from './session-start.mjs'

const HERE = import.meta.dirname
// The samples are the adapters' own (their conformance suites replay them); the Cursor ones are written from its documentation
const SAMPLES = {
  'claude-code': join(HERE, '..', '..', 'adapters', 'runtime', 'claude-code', 'events'),
  cursor: join(HERE, '..', '..', 'adapters', 'runtime', 'cursor', 'events')
}
const dirs = []
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

const sample = (runtime, name, cwd) => ({
  ...JSON.parse(readFileSync(join(SAMPLES[runtime], name), 'utf8')),
  ...(cwd ? { cwd, workspace_roots: [cwd] } : {})
})

// A project on a branch, with the profile that names the protected branches, and (optionally) a vendored copy in pinned mode
function project(branch, { files = {}, env = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'runtime-hooks-'))
  dirs.push(root)
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: root, stdio: 'pipe' })
  const all = {
    'harness-profile.json': JSON.stringify({
      branches: { production: 'main', integration: 'develop' },
      adapters: { stacks: ['node-ts'], host: 'github' },
      paths: { phases: 'plan/phases' }
    }),
    'a.txt': 'a',
    ...files
  }
  for (const [path, text] of Object.entries(all)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  git('init', '--quiet', '--initial-branch', branch)
  git('add', '.')
  git('commit', '--quiet', '--no-verify', '-m', 'start')
  return { root, env }
}

function hook(script, event, { env = {}, path, from = HERE } = {}) {
  const result = spawnSync(process.execPath, [join(from, `${script}.mjs`)], {
    input: typeof event === 'string' ? event : JSON.stringify(event),
    encoding: 'utf8',
    env: { ...process.env, PATH: path ?? process.env.PATH, ...env }
  })
  return { code: result.status, out: result.stdout, err: result.stderr }
}

test('guard-shell refuses a push to a protected branch in the form of each runtime', () => {
  const { root } = project('feature/1.1-x')
  const claude = hook('guard-shell', sample('claude-code', 'bash-push-main.json', root))
  assert.deepEqual([claude.code, claude.out], [2, ''])
  assert.match(claude.err, /Never push to main or develop directly/)

  const cursor = hook('guard-shell', sample('cursor', 'before-shell-push-main.json', root))
  assert.equal(cursor.code, 2)
  assert.equal(JSON.parse(cursor.out).permission, 'deny')
  assert.match(JSON.parse(cursor.out).agent_message, /Never push to main or develop directly/)

  const compat = hook('guard-shell', sample('cursor', 'compat-bash-push-main.json', root))
  assert.equal(compat.code, 2, 'Cursor running the Claude Code hook gets the answer it can read')
})

test('guard-shell lets other commands through, and refuses a commit on a protected branch', () => {
  const { root } = project('develop')
  assert.equal(hook('guard-shell', sample('claude-code', 'bash-ls.json', root)).code, 0)
  assert.equal(JSON.parse(hook('guard-shell', sample('cursor', 'before-shell-ls.json', root)).out).permission, 'allow')
  const commit = { ...sample('claude-code', 'bash-ls.json', root), tool_input: { command: 'git commit -m x' } }
  assert.match(hook('guard-shell', commit).err, /You are on develop/)
  const bypass = { ...sample('claude-code', 'bash-ls.json', root), tool_input: { command: 'git push --no-verify' } }
  assert.match(hook('guard-shell', { ...bypass, cwd: project('feature/x').root }).err, /--no-verify.*owner/)
})

test('guard-shell judges a Git command by the repository it acts on: a `cd` before it, `-C` and `--git-dir`, both ways', () => {
  const onFeature = project('feature/x').root
  const onDevelop = project('develop').root
  const run = (cwd, command) =>
    hook('guard-shell', { ...sample('claude-code', 'bash-ls.json', cwd), tool_input: { command } })

  // the project is on its integration branch, the other clone on a task branch: allowed
  for (const command of [
    `cd ${onFeature} && git commit -m x`,
    `git -C ${onFeature} commit -m x`,
    `git --git-dir=${onFeature}/.git --work-tree=${onFeature} commit -m x`,
    `git --git-dir ${onFeature}/.git commit -m x`,
    `GIT_DIR=${onFeature}/.git git commit -m x`,
    `cd ${onFeature} && cd .. && cd ${onFeature} && git push origin HEAD`
  ]) {
    assert.equal(run(onDevelop, command).code, 0, command)
  }
  // the project is on a task branch, the other clone on its integration branch: refused
  for (const command of [
    `cd ${onDevelop} && git commit -m x`,
    `git -C ${onDevelop} commit -m x`,
    `git --git-dir=${onDevelop}/.git commit -m x`,
    `GIT_DIR=${onDevelop}/.git git push`,
    `(cd ${onDevelop} && git status); cd ${onDevelop} && git commit -m x`
  ]) {
    assert.match(run(onFeature, command).err, /You are on develop in /, command)
  }
  // a subshell does not move the shell, and what cannot be resolved is judged as protected
  assert.match(run(onDevelop, `(cd ${onFeature} && git status); git commit -m x`).err, /You are on develop/)
  for (const command of [
    'cd /nonexistent/clone && git commit -m x',
    'cd "$OTHER" && git commit -m x',
    `git --work-tree ${onFeature} commit -m x`,
    'git -C /nonexistent commit -m x'
  ]) {
    assert.match(run(onFeature, command).err, /cannot be told/, command)
  }
  assert.equal(run(onFeature, `cd ${onDevelop} && git checkout -b feature/y && git commit -m x`).code, 0)
})

test('each hook works when started through a link to its file or to a folder above it, as it does by its real path', () => {
  const links = realpathSync(mkdtempSync(join(tmpdir(), 'hook-links-')))
  dirs.push(links)
  symlinkSync(HERE, join(links, 'hooks-link'))
  mkdirSync(join(links, 'files'))
  for (const script of ['guard-shell', 'guard-edit', 'session-start', 'format-edited']) {
    symlinkSync(join(HERE, `${script}.mjs`), join(links, 'files', `${script}.mjs`))
  }
  const { root } = project('feature/x')
  const develop = project('develop').root
  const cases = [
    ['guard-shell', sample('claude-code', 'bash-push-main.json', root), 2],
    [
      'guard-shell',
      { ...sample('claude-code', 'bash-ls.json', develop), tool_input: { command: 'git commit -m x' } },
      2
    ],
    ['guard-edit', sample('claude-code', 'write-env.json', root), 2],
    ['session-start', sample('claude-code', 'session-start.json', root), 0]
  ]
  for (const [script, event, code] of cases) {
    const direct = hook(script, event)
    assert.equal(direct.code, code, `${script} by its real path`)
    for (const from of [join(links, 'hooks-link'), join(links, 'files')]) {
      const linked = hook(script, event, { from })
      assert.deepEqual(linked, direct, `${script} through ${from}`)
    }
  }
  assert.notEqual(
    hook('session-start', sample('claude-code', 'session-start.json', root), {
      from: join(links, 'files'),
      env: { CLAUDE_PROJECT_DIR: root }
    }).out,
    ''
  )
  assert.equal(
    hook('format-edited', sample('claude-code', 'write-env.json', root), { from: join(links, 'files') }).code,
    0
  )
})

test('guard-shell on a host without protection refuses a merge while a required check is not green, through the gh of the path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gh-merge-'))
  dirs.push(dir)
  writeFileSync(
    join(dir, 'gh'),
    `#!/bin/sh\nif [ "$MERGE_CHECKS" = red ]; then echo '[{"name":"verify","bucket":"fail"}]'; else echo '[{"name":"verify","bucket":"pass"}]'; fi\n`
  )
  chmodSync(join(dir, 'gh'), 0o755)
  const unprotected = project('feature/x')
  writeFileSync(
    join(unprotected.root, 'harness-profile.json'),
    JSON.stringify({
      branches: { production: 'main', integration: 'develop' },
      adapters: { stacks: ['node-ts'], host: 'github' },
      host: { protection: false },
      requiredChecks: ['verify']
    })
  )
  const event = {
    ...sample('claude-code', 'bash-ls.json', unprotected.root),
    tool_input: { command: 'gh pr merge 12 --squash' }
  }
  const path = `${dir}:${process.env.PATH}`
  const red = hook('guard-shell', event, { env: { MERGE_CHECKS: 'red' }, path })
  assert.equal(red.code, 2)
  assert.match(red.err, /No merge while a required check is not green: verify \(fail\)/)
  assert.equal(hook('guard-shell', event, { env: { MERGE_CHECKS: 'green' }, path }).code, 0)

  const protectedHost = project('feature/x')
  assert.equal(
    hook('guard-shell', { ...event, cwd: protectedHost.root }, { env: { MERGE_CHECKS: 'red' }, path }).code,
    0,
    'a host that protects its branches refuses the merge itself'
  )
})

test('guard-shell refuses `gh pr merge --auto` into the production branch and on a release branch, and lets it through on a task pull request', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gh-auto-'))
  dirs.push(dir)
  writeFileSync(
    join(dir, 'gh'),
    `#!/bin/sh\necho "{\\"baseRefName\\":\\"$PR_BASE\\",\\"headRefName\\":\\"$PR_HEAD\\"}"\n`
  )
  chmodSync(join(dir, 'gh'), 0o755)
  const path = `${dir}:${process.env.PATH}`
  const { root } = project('feature/x')
  const event = (command, cwd = root) => ({
    ...sample('claude-code', 'bash-ls.json', cwd),
    tool_input: { command }
  })
  const run = (command, base, head, cwd) =>
    hook('guard-shell', event(command, cwd), { env: { PR_BASE: base, PR_HEAD: head }, path })

  assert.equal(run('gh pr merge 5 --auto --squash', 'develop', 'feature/3.1-x').code, 0)
  assert.match(run('gh pr merge 5 --auto --squash', 'main', 'release/0.1.2').err, /production branch/)
  assert.match(run('gh pr merge 5 --auto --merge', 'develop', 'release/0.1.2').err, /never on a release or hotfix/i)
  assert.equal(
    run('gh pr merge 5 --squash', 'main', 'release/0.1.2').code,
    0,
    'a merge without --auto is not this guard'
  )

  const off = project('feature/x')
  writeFileSync(
    join(off.root, 'harness-profile.json'),
    JSON.stringify({
      branches: { production: 'main', integration: 'develop' },
      adapters: { stacks: ['node-ts'], host: 'github' },
      host: { protection: true, autoMerge: false }
    })
  )
  assert.match(run('gh pr merge 5 --auto --squash', 'develop', 'feature/x', off.root).err, /Auto-merge is off/)
})

test('guard-edit refuses an environment file in each runtime, the vendored framework in pinned mode only, and nothing else', () => {
  const { root } = project('feature/x')
  const claude = hook('guard-edit', sample('claude-code', 'write-env.json', root))
  assert.equal(claude.code, 2)
  assert.match(claude.err, /\.env\.example/)
  const cursor = hook('guard-edit', sample('cursor', 'pre-tool-write-env.json', root))
  assert.equal(JSON.parse(cursor.out).permission, 'deny')
  assert.equal(hook('guard-edit', sample('claude-code', 'edit-source.json', root)).code, 0)

  const pinned = project('feature/x', {
    files: {
      'harness.lock.json': JSON.stringify({
        mode: 'pinned',
        source: { type: 'path', location: 'x' },
        adapters: {},
        files: {}
      }),
      'harness/tools/a.mjs': 'x'
    }
  })
  const vendored = {
    ...sample('claude-code', 'edit-source.json', pinned.root),
    tool_input: { file_path: join(pinned.root, 'harness/tools/a.mjs') }
  }
  assert.match(hook('guard-edit', vendored).err, /harness\/tools\/a\.mjs is the vendored framework/)
  const detached = project('feature/x', {
    files: {
      'harness.lock.json': JSON.stringify({
        mode: 'detached',
        source: { type: 'path', location: 'x' },
        adapters: {},
        files: {}
      }),
      'harness/tools/a.mjs': 'x'
    }
  })
  assert.equal(
    hook('guard-edit', {
      ...vendored,
      cwd: detached.root,
      tool_input: { file_path: join(detached.root, 'harness/tools/a.mjs') }
    }).code,
    0,
    'a detached copy is the project’s own'
  )
})

test('format-edited runs the formatter of the stack that owns the file, from the installation of the project, and never blocks', () => {
  const { root } = project('feature/x', { files: { 'api/src/a.ts': 'const a  = 1' } })
  const dir = mkdtempSync(join(tmpdir(), 'npx-stand-in-'))
  dirs.push(dir)
  const log = join(dir, 'log.txt')
  writeFileSync(join(dir, 'npx'), `#!/bin/sh\necho "$@" >> '${log}'\n`)
  chmodSync(join(dir, 'npx'), 0o755)
  const path = `${dir}:${process.env.PATH}`
  for (const event of [
    sample('claude-code', 'after-edit.json', root),
    sample('cursor', 'after-file-edit.json', root)
  ]) {
    const result = hook(
      'format-edited',
      {
        ...event,
        ...(event.tool_input
          ? { tool_input: { file_path: join(root, 'api/src/a.ts') } }
          : { file_path: join(root, 'api/src/a.ts') })
      },
      { path }
    )
    assert.deepEqual([result.code, result.out], [0, ''])
  }
  const calls = readFileSync(log, 'utf8').trim().split('\n')
  assert.deepEqual(
    calls,
    ['--no-install prettier --write api/src/a.ts', '--no-install prettier --write api/src/a.ts'],
    'never downloads a formatter'
  )
  writeFileSync(join(root, 'logo.png'), 'x')
  hook(
    'format-edited',
    { ...sample('claude-code', 'after-edit.json', root), tool_input: { file_path: join(root, 'logo.png') } },
    { path }
  )
  assert.equal(readFileSync(log, 'utf8').trim().split('\n').length, 2, 'a file the stack does not format is left alone')
  assert.equal(hook('format-edited', 'not json').code, 0)
  assert.equal(
    hook('format-edited', sample('claude-code', 'after-edit.json', root)).code,
    0,
    'a file that does not exist'
  )
})

test('session-start prints the branch, the phase in progress and its next step, to the stdout of Claude Code and as context to Cursor', () => {
  const { root } = project('feature/x', {
    files: {
      'plan/phases/phase-3-x.md':
        '# Phase 3 — X\n\n**Status:** 🟡 In progress · **Work log:** [log](./work-logs/phase-3-log.md)\n',
      'plan/phases/work-logs/phase-3-log.md': '- **Next step:** do the thing\n'
    }
  })
  const claude = hook('session-start', sample('claude-code', 'session-start.json', root), {
    env: { CLAUDE_PROJECT_DIR: root }
  })
  assert.equal(claude.code, 0)
  assert.match(
    claude.out,
    /^Branch: feature\/x\nPhase in progress: Phase 3 — X \(plan\/phases\/phase-3-x\.md\)\nLast next step \(plan\/phases\/work-logs\/phase-3-log\.md\): do the thing/
  )
  const cursor = hook('session-start', sample('cursor', 'session-start.json', root), {
    env: { CURSOR_PROJECT_DIR: root }
  })
  assert.match(JSON.parse(cursor.out).additional_context, /Phase in progress: Phase 3 — X/)
})

test('session-start with no phase in progress prints the next task by the order of development, and by the execution order of a phase, not by its table', () => {
  const row = (id, mark) => `| ${id} | **Task ${id}**: text | C1 | 1 | ${mark} |\n`
  const header = '| # | Task | Agent | SP | Status |\n| --- | --- | --- | --- | --- |\n'
  const profile = JSON.stringify({
    branches: { production: 'main', integration: 'develop' },
    adapters: { stacks: ['node-ts'], host: 'github' },
    paths: { phases: 'plan/phases', planIndex: 'plan/README.md' }
  })
  const run = (files) =>
    hook(
      'session-start',
      sample(
        'claude-code',
        'session-start.json',
        project('develop', { files: { 'harness-profile.json': profile, ...files } }).root
      )
    )

  const indexed = run({
    'plan/README.md':
      '# Plan\n\n**Order of development** (a date)\n\n| Release | Tasks, in order |\n| --- | --- |\n| `0.1.1` | 1.3, 1.1 |\n',
    'plan/phases/phase-1-x.md': `# Phase 1 — X\n\n**Status:** ⬜ Not started\n\n**Execution order:** the plan index says.\n\n${header}${row('1.1', '⬜')}${row('1.2', '⬜')}${row('1.3', '⬜')}`
  })
  assert.match(
    indexed.out,
    /No phase is in progress\.\nNext task: 1\.3 Task 1\.3 \(plan\/phases\/phase-1-x\.md\), by the order of development/
  )

  const ordered = run({
    'plan/phases/phase-1-x.md': `# Phase 1 — X\n\n**Status:** ⬜ Not started\n\n**Execution order:** 1.2 first, because 1.1 needs it; then 1.1.\n\n${header}${row('1.1', '⬜')}${row('1.2', '⬜')}`
  })
  assert.match(ordered.out, /Next task: 1\.2 Task 1\.2 .*by the execution order/)

  const finished = run({
    'plan/phases/phase-1-x.md': `# Phase 1 — X\n\n**Status:** ✅ Done\n\n${header}${row('1.1', '✅')}`
  })
  assert.match(finished.out, /No phase is in progress\.\nRead the method/)
})

test('the session start message says what it knows and what it does not', () => {
  const none = sessionStartMessage(
    'develop',
    () => '',
    () => [],
    'plan/phases',
    'docs/method.md'
  )
  assert.equal(
    none,
    'Branch: develop\nNo phase is in progress.\nRead the method, section "Session protocol" (docs/method.md), before you start or resume a phase.'
  )
})
