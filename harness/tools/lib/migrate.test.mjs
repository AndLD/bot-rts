// Taking a version (task 3.5): `sync` places the files and starts `harness migrate` of the new version in a new process, which regenerates the
// managed files with the new version's tools. A project whose old `sync` could not start it runs `harness migrate` itself.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, before, test } from 'node:test'
import { run } from '../harness.mjs'
import { FRAMEWORK_DIR } from './bootstrap.mjs'
import { readLock, writeLock } from './lock.mjs'
import { listMigrations, migrate } from './migrate.mjs'
import { baseVersion, compareVersions, isDevelopment } from './versions.mjs'
import { sync } from './vendor.mjs'

const dirs = []
const fresh = () => {
  const dir = mkdtempSync(join(tmpdir(), 'migrate-'))
  dirs.push(dir)
  return dir
}
const saved = {}
before(() => {
  // The bootstrap commits: a fixed identity, and none of the machine's own Git configuration
  const config = join(fresh(), 'gitconfig')
  writeFileSync(config, '')
  const env = {
    GIT_AUTHOR_NAME: 't',
    GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@t',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: config
  }
  for (const [key, value] of Object.entries(env)) {
    saved[key] = process.env[key]
    process.env[key] = value
  }
})
after(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true }))
})

async function harness(root, argv) {
  const lines = []
  const code = await run([...argv, '--no-host-setup', '--root', root], {
    out: (line) => lines.push(line),
    err: (line) => lines.push(line)
  })
  return { code, output: lines.join('\n') }
}

// A check run by the project's own vendored tools, as its CI runs it; the exit code and what it printed
function projectCommand(root, ...args) {
  const result = spawnSync(process.execPath, [join(root, 'harness/tools/harness.mjs'), ...args, '--root', root], {
    encoding: 'utf8'
  })
  return { code: result.status, output: result.stdout + result.stderr }
}
const check = (root, name) => projectCommand(root, 'check', name)

const git = (root, ...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

const PROCEDURE = 'core/procedures/start-task.md'

// Two versions of the framework: a copy of this tree, and a next one in which a procedure (and so a generated skill) changed
function versions() {
  const manifest = JSON.parse(readFileSync(join(FRAMEWORK_DIR, 'framework.json'), 'utf8'))
  const copy = (version, change) => {
    const dir = fresh()
    for (const path of manifest.distributable) {
      cpSync(join(FRAMEWORK_DIR, path), join(dir, path), { recursive: true })
    }
    writeFileSync(join(dir, 'framework.json'), JSON.stringify({ ...manifest, version }, null, 2))
    change?.(dir)
    return dir
  }
  const first = copy('1.0.0')
  const second = copy('1.1.0', (dir) => {
    writeFileSync(
      join(dir, PROCEDURE),
      `${readFileSync(join(dir, PROCEDURE), 'utf8')}\nA step the next version added.\n`
    )
  })
  return { first, second }
}

async function projectAt(source) {
  const root = fresh()
  const { code, output } = await harness(root, [
    'init',
    '--non-interactive',
    '--name',
    'acme',
    '--repository',
    'acme/shop',
    '--stack',
    'node-ts',
    '--runtime',
    'claude-code',
    '--from',
    source
  ])
  assert.equal(code, 0, output)
  assert.equal(check(root, 'generated').code, 0)
  // The bootstrap leaves the project on its integration branch; a version is taken on a branch of its own
  git(root, 'checkout', '-q', '-b', 'chore/take-version')
  return root
}

test('sync alone brings the managed files to the new version: the new version’s tools regenerate them in a new process', async () => {
  const { first, second } = versions()
  const root = await projectAt(first)

  const result = await harness(root, ['sync', '--from', second])
  assert.equal(result.code, 0, result.output)
  assert.match(result.output, /Synced \d+ files of harness-framework 1\.1\.0/)
  assert.match(result.output, /Migrated to harness-framework 1\.1\.0\./)
  assert.equal(readLock(root).version, '1.1.0')
  assert.equal(check(root, 'generated').code, 0)
  const skill = readFileSync(join(root, '.claude/skills/start-task/SKILL.md'), 'utf8')
  assert.match(skill, /A step the next version added\./)
  assert.equal((await harness(root, ['check', 'vendored'])).code, 0)
})

test('a sync that cannot start the migration leaves the managed files stale, and `harness migrate` brings them in', async () => {
  const { first, second } = versions()
  const root = await projectAt(first)

  // What a consumer of an older version gets: the files are in place and nothing started the new version's tools
  sync({ root, from: second, startMigrate: () => [] })
  assert.match(check(root, 'generated').output, /not what the tools generate now/)

  const result = projectCommand(root, 'migrate')
  assert.equal(result.code, 0, result.output)
  assert.equal(check(root, 'generated').code, 0)
  assert.equal((await harness(root, ['check', 'vendored'])).code, 0)
})

test('migrate needs a lock, and a failing migration of the new version fails the sync with the way to run it again', async () => {
  await assert.rejects(() => migrate({ root: fresh() }), /nothing to migrate/)

  const { first, second } = versions()
  const root = await projectAt(first)
  writeFileSync(join(second, 'tools/harness.mjs'), 'console.error("boom"); process.exit(3)\n')
  const result = await harness(root, ['sync', '--from', second])
  assert.equal(result.code, 1)
  assert.match(
    result.output,
    /`harness migrate` of the new version failed \(exit 3\)[^]*boom[^]*run `node harness\/tools\/harness\.mjs migrate`/
  )
  assert.equal(readLock(root).version, '1.1.0', 'the files and the lock are in place')
})

// A framework whose migrations folder holds the scripts and notes given, as `{ '0.2.0.mjs': text, '0.2.0.md': text }`
function scriptedFramework(version, migrations) {
  const dir = fresh()
  const files = {
    'framework.json': JSON.stringify({
      name: 'harness-framework',
      version,
      distributable: ['migrations', 'framework.json']
    }),
    ...Object.fromEntries(Object.entries(migrations).map(([name, text]) => [`migrations/${name}`, text]))
  }
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  return dir
}

// A script that adds its line to `log.txt` once: it checks its starting state, so a second run changes nothing
const script = (version, extra = '') => `import { existsSync, readFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
export default ({ root }) => {
  ${extra}
  const file = join(root, 'log.txt')
  const text = existsSync(file) ? readFileSync(file, 'utf8') : ''
  if (text.includes('${version}\\n')) return ['${version}: already done']
  appendFileSync(file, '${version}\\n')
  return ['${version}: done']
}
`

function scriptedProject(source) {
  const root = fresh()
  writeFileSync(join(root, 'harness-profile.json'), JSON.stringify({ adapters: { stacks: [], runtimes: [] } }))
  sync({ root, from: source, generators: [], startMigrate: () => [] })
  return root
}

const logOf = (root) => (existsSync(join(root, 'log.txt')) ? readFileSync(join(root, 'log.txt'), 'utf8') : '')

test('migrate runs the scripts of every version after the project\u2019s own, in order, records them, and prints the notes in order', async () => {
  const source = scriptedFramework('0.4.0', {
    '0.3.0.mjs': script('0.3.0'),
    '0.1.1.md': '# Migration to 0.1.1\n',
    '0.2.0.mjs': script('0.2.0'),
    '0.2.0.md': '# Migration to 0.2.0\n',
    '0.4.0.mjs': script('0.4.0'),
    '0.4.0.md': '# Migration to 0.4.0\n',
    '0.5.0.mjs': script('0.5.0')
  })
  const root = scriptedProject(source)
  assert.equal(readLock(root).migrations, undefined, 'a lock without the record counts as 0.1.0 with nothing applied')

  const { messages } = await migrate({ root, generators: [] })
  assert.equal(logOf(root), '0.2.0\n0.3.0\n0.4.0\n', 'the scripts up to the target, oldest first; 0.5.0 is after it')
  assert.deepEqual(readLock(root).migrations, { version: '0.4.0', applied: ['0.2.0', '0.3.0', '0.4.0'] })
  const notes = messages.filter((line) => line.startsWith('Migration note of'))
  assert.deepEqual(notes, [
    'Migration note of 0.1.1 (follow its required actions):',
    'Migration note of 0.2.0 (follow its required actions):',
    'Migration note of 0.4.0 (follow its required actions):'
  ])

  const again = await migrate({ root, generators: [] })
  assert.equal(logOf(root), '0.2.0\n0.3.0\n0.4.0\n')
  assert.equal(again.messages.filter((line) => /^Migration (script|note)/.test(line)).length, 0, 'nothing is pending')
})

// The notes of a line of development versions: dev.1, dev.2 and the final 0.2.0, each tree holding the notes up to its own version
const NOTES = ['0.1.1.md', '0.2.0-dev.1.md', '0.2.0-dev.2.md', '0.2.0.md']
const notesUpTo = (last) =>
  Object.fromEntries(NOTES.slice(0, NOTES.indexOf(`${last}.md`) + 1).map((name) => [name, `# Migration to ${name}\n`]))
const noteVersions = (messages) =>
  messages
    .filter((line) => line.startsWith('Migration note of'))
    .map((line) => /^Migration note of (\S+) /.exec(line)[1])

test('a development version has a note of its own: a project that follows the development versions reads each one, and the final note replaces them', async () => {
  const root = scriptedProject(scriptedFramework('0.2.0-dev.1', notesUpTo('0.2.0-dev.1')))
  assert.deepEqual(noteVersions((await migrate({ root, generators: [] })).messages), ['0.1.1', '0.2.0-dev.1'])

  sync({
    root,
    from: scriptedFramework('0.2.0-dev.2', notesUpTo('0.2.0-dev.2')),
    generators: [],
    startMigrate: () => []
  })
  assert.deepEqual(
    noteVersions((await migrate({ root, generators: [] })).messages),
    ['0.2.0-dev.2'],
    'only what the project has not read'
  )

  sync({ root, from: scriptedFramework('0.2.0', notesUpTo('0.2.0')), generators: [], startMigrate: () => [] })
  assert.deepEqual(
    noteVersions((await migrate({ root, generators: [] })).messages),
    ['0.2.0'],
    'the final note is the complete story'
  )
})

test('a jump over the development versions reads the final note and not the development notes it covers', async () => {
  const fromStart = scriptedProject(scriptedFramework('0.2.0', notesUpTo('0.2.0')))
  assert.deepEqual(noteVersions((await migrate({ root: fromStart, generators: [] })).messages), ['0.1.1', '0.2.0'])

  const fromDev = scriptedProject(scriptedFramework('0.2.0-dev.1', notesUpTo('0.2.0-dev.1')))
  await migrate({ root: fromDev, generators: [] })
  sync({ root: fromDev, from: scriptedFramework('0.2.0', notesUpTo('0.2.0')), generators: [], startMigrate: () => [] })
  assert.deepEqual(noteVersions((await migrate({ root: fromDev, generators: [] })).messages), ['0.2.0'])
})

test('the script of a development version is not run, and the notes are listed with the development versions in order', () => {
  const source = scriptedFramework('0.2.0', {
    ...notesUpTo('0.2.0'),
    '0.2.0-dev.1.mjs': script('dev'),
    '0.2.0.mjs': script('0.2.0')
  })
  assert.deepEqual(
    listMigrations(join(source, 'migrations')).map(({ version, note, script }) => [
      version,
      Boolean(note),
      Boolean(script)
    ]),
    [
      ['0.1.1', true, false],
      ['0.2.0-dev.1', true, false],
      ['0.2.0-dev.2', true, false],
      ['0.2.0', true, true]
    ]
  )
})

test('a script runs twice without change, and a run that stopped resumes with the scripts not yet applied', async () => {
  const source = scriptedFramework('0.3.0', {
    '0.2.0.mjs': script('0.2.0'),
    '0.3.0.mjs': script('0.3.0', "if (!process.env.MIGRATE_TEST_OK) throw new Error('the second script stops')")
  })
  const root = scriptedProject(source)

  await assert.rejects(() => migrate({ root, generators: [] }), /the second script stops/)
  assert.deepEqual(readLock(root).migrations, { version: '0.1.0', applied: ['0.2.0'] }, 'the first script is recorded')

  process.env.MIGRATE_TEST_OK = '1'
  try {
    const { messages } = await migrate({ root, generators: [] })
    assert.ok(!messages.some((line) => line.includes('0.2.0: ')), 'the applied script is not run again')
    assert.equal(logOf(root), '0.2.0\n0.3.0\n')

    // The same scripts again, as if the record were lost: they find their work done
    writeLock(root, { ...readLock(root), migrations: undefined })
    const rerun = await migrate({ root, generators: [] })
    assert.ok(rerun.messages.includes('  0.2.0: already done') && rerun.messages.includes('  0.3.0: already done'))
    assert.equal(logOf(root), '0.2.0\n0.3.0\n')
  } finally {
    delete process.env.MIGRATE_TEST_OK
  }
})

test('a development version runs the script of its final version without recording it, and the final version runs it once more', async () => {
  const migrations = { '0.2.0.mjs': script('0.2.0'), '0.2.0.md': '# Migration to 0.2.0\n' }
  const root = scriptedProject(scriptedFramework('0.2.0-dev.1', migrations))
  await migrate({ root, generators: [] })
  assert.equal(logOf(root), '0.2.0\n')
  assert.deepEqual(readLock(root).migrations, { version: '0.2.0-dev.1', applied: [] })

  const final = scriptedFramework('0.2.0', migrations)
  sync({ root, from: final, generators: [], startMigrate: () => [] })
  const { messages } = await migrate({ root, generators: [] })
  assert.ok(messages.includes('  0.2.0: already done'), 'the script ran again and found its work done')
  assert.deepEqual(readLock(root).migrations, { version: '0.2.0', applied: ['0.2.0'] })
})

test('a project that is detached, or the framework itself, only regenerates the managed files', async () => {
  const root = scriptedProject(scriptedFramework('0.2.0', { '0.2.0.mjs': script('0.2.0') }))
  writeLock(root, { ...readLock(root), mode: 'self' })
  const { messages } = await migrate({ root, generators: [] })
  assert.match(messages.join('\n'), /only a pinned project has migrations to run/)
  assert.equal(logOf(root), '')
})

test('versions are compared as x.y.z with a development version before its final one', () => {
  assert.ok(compareVersions('0.1.2', '0.1.10') < 0)
  assert.ok(compareVersions('0.2.0-dev.2', '0.2.0') < 0)
  assert.ok(compareVersions('0.2.0-dev.2', '0.2.0-dev.10') < 0)
  assert.ok(compareVersions('0.2.0-dev', '0.2.0-dev.1') < 0)
  assert.equal(compareVersions('v1.0.0', '1.0.0'), 0)
  assert.ok(compareVersions('0.2.0', '0.1.9') > 0)
  assert.equal(baseVersion('0.2.0-dev.3'), '0.2.0')
  assert.ok(isDevelopment('0.2.0-dev.3') && !isDevelopment('0.2.0'))
  assert.throws(() => compareVersions('latest', '1.0.0'), /not a version/)
})

test('a sync is refused on a protected branch and with uncommitted changes, before it touches a file', async () => {
  const { first, second } = versions()
  const root = await projectAt(first)
  const head = git(root, 'rev-parse', 'HEAD')

  writeFileSync(join(root, 'notes.txt'), 'my work\n')
  const dirty = await harness(root, ['sync', '--from', second])
  assert.equal(dirty.code, 1)
  assert.match(dirty.output, /uncommitted changes \(notes\.txt\)[^]*harness rollback/)

  rmSync(join(root, 'notes.txt'))
  git(root, 'checkout', '-q', 'develop')
  const protectedBranch = await harness(root, ['sync', '--from', second])
  assert.equal(protectedBranch.code, 1)
  assert.match(protectedBranch.output, /you are on develop, a protected branch/)

  assert.equal(readLock(root).version, '1.0.0', 'nothing was synced')
  assert.equal(git(root, 'status', '--porcelain'), '')
  assert.equal(git(root, 'rev-parse', 'HEAD'), head)
})

test('the migration is one commit that records where it started, and rollback restores exactly the files it changed or added', async () => {
  const { first, second } = versions()
  const root = await projectAt(first)
  const start = git(root, 'rev-parse', 'HEAD')

  const result = await harness(root, ['sync', '--from', second])
  assert.equal(result.code, 0, result.output)
  assert.equal(git(root, 'rev-parse', 'HEAD~1'), start, 'one commit on top of the start')
  assert.equal(git(root, 'status', '--porcelain'), '', 'nothing is left uncommitted')
  assert.match(git(root, 'log', '-1', '--format=%s'), /^chore\(framework\): migrate to 1\.1\.0$/)
  assert.deepEqual(readLock(root).migrations, {
    version: '1.1.0',
    applied: [],
    start: { commit: start, version: '1.0.0' }
  })

  // The agent's own work follows as separate commits, and is not touched by the rollback
  writeFileSync(join(root, 'agent.txt'), 'the agent\u2019s work\n')
  git(root, 'add', '.')
  git(root, 'commit', '-q', '-m', 'feat: my work')

  const undone = projectCommand(root, 'rollback')
  assert.equal(undone.code, 0, undone.output)
  assert.equal(git(root, 'diff', start, '--stat', '--', '.', ':!agent.txt'), '', 'every file is as it was at the start')
  assert.equal(readFileSync(join(root, 'agent.txt'), 'utf8'), 'the agent\u2019s work\n')
  assert.equal(readLock(root).version, '1.0.0')

  const again = projectCommand(root, 'rollback')
  assert.equal(again.code, 1)
  assert.match(again.output, /nothing to roll back/)
})

test('after the sync of an older version, migrate takes the sync\u2019s changes into its own commit, and refuses any other change', async () => {
  const { first, second } = versions()
  const root = await projectAt(first)
  const start = git(root, 'rev-parse', 'HEAD')

  sync({ root, from: second, startMigrate: () => [] })
  writeFileSync(join(root, 'notes.txt'), 'not the sync\u2019s\n')
  const refused = projectCommand(root, 'migrate')
  assert.equal(refused.code, 1)
  assert.match(refused.output, /uncommitted changes that a sync does not write \(notes\.txt\)/)
  rmSync(join(root, 'notes.txt'))

  const migrated = projectCommand(root, 'migrate')
  assert.equal(migrated.code, 0, migrated.output)
  assert.equal(git(root, 'rev-parse', 'HEAD~1'), start)
  assert.equal(git(root, 'status', '--porcelain'), '')

  assert.equal(projectCommand(root, 'rollback').code, 0)
  assert.equal(git(root, 'diff', start, '--stat'), '')
})

test('after the sync of an older version, which keeps no record of where the project was, migrate starts from the version the last commit holds', async () => {
  const { first, second } = versions()
  for (const version of ['1.0.0', '1.1.0']) {
    writeFileSync(join(second, `migrations/${version}.md`), `# Migration to ${version}\n`)
  }
  const root = await projectAt(first)
  const start = git(root, 'rev-parse', 'HEAD')

  // What the sync of 1.0.0 leaves: the new version in the lock and nothing else of the lock changed
  sync({ root, from: second, generators: [], startMigrate: () => [] })
  const { migrations: _recorded, ...lock } = readLock(root)
  writeLock(root, lock)

  const { lock: migrated, messages } = await migrate({ root, generators: [] })
  assert.deepEqual(migrated.migrations.start, { commit: start, version: '1.0.0' })
  assert.deepEqual(noteVersions(messages), ['1.1.0'], 'the project had taken 1.0.0 and the notes before it')
  assert.match(
    messages.at(-2),
    /^Probes \(probes\.run is ask\): do not run them yet\./,
    'the end of the output says what the probes ask'
  )
})
