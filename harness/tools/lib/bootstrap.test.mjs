import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import {
  bootstrap,
  buildTemplate,
  canonical,
  completeProfile,
  loadModules,
  FRAMEWORK_DIR,
  missingAnswers,
  NO_TERMS,
  retarget,
  scaffoldPlan,
  serializeProfile,
  templateProfile,
  unknownAdapters,
  adapterCatalogue
} from './bootstrap.mjs'
import { answersFromFlags, init, parseSet } from './init.mjs'
import { readLock } from './lock.mjs'
import { readSchema, validate, withDefaults } from './profile.mjs'

const dirs = []
const fresh = () => {
  const dir = mkdtempSync(join(tmpdir(), 'bootstrap-unit-'))
  dirs.push(dir)
  return dir
}
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

const ANSWERS = {
  project: { name: 'acme' },
  repository: { slug: 'acme/shop' },
  adapters: { stacks: ['node-ts'], runtimes: ['claude-code'] }
}
const modules = await loadModules(FRAMEWORK_DIR)

test('a new profile takes the defaults of the questions, the selected adapters and the starter, and is valid', () => {
  const profile = completeProfile(ANSWERS)
  assert.deepEqual(profile.branches, { production: 'main', integration: 'develop' })
  assert.deepEqual(profile.coverageGate, { statements: 90, branches: 90, functions: 90, lines: 90 })
  assert.equal(profile.adapters.host, 'github')
  assert.deepEqual(profile.requiredChecks, ['verify', 'pr-title'], 'the host adapter gives the required checks')
  assert.equal(profile.commands.docsCheck, 'npm run docs:check', 'the stack adapter gives the commands')
  assert.equal(profile.documents.rules, 'AGENTS.md', 'the starter gives the document map')
  assert.equal(profile.paths.changelog, 'CHANGELOG.md', 'the starter gives the paths')
  assert.equal(profile.project.title, 'acme')
  const schema = readSchema()
  assert.deepEqual(validate(schema, withDefaults(schema, profile)), [])
})

test('an answer wins over every default, and the term lists follow the answers', () => {
  const profile = completeProfile({
    ...ANSWERS,
    branches: { production: 'trunk' },
    commands: { lint: 'make lint' },
    requiredChecks: ['ci']
  })
  assert.deepEqual(profile.branches, { production: 'trunk', integration: 'develop' })
  assert.equal(profile.commands.lint, 'make lint')
  assert.equal(profile.commands.test, 'npm test')
  assert.deepEqual(profile.requiredChecks, ['ci'])
  assert.equal(profile.terms.projectValues, '`trunk`|`develop`|acme/shop')
  assert.equal(profile.terms.product, '\\bacme\\b')
  assert.match(profile.terms.stack, /\\bnpm\\b/, 'the stack terms are the words of the selected stack adapter')
  assert.equal(profile.terms.productGeneric, NO_TERMS)
  assert.equal(new RegExp(NO_TERMS).test('anything'), false)
})

test('the required questions without an answer are named; an empty string is no answer', () => {
  assert.deepEqual(missingAnswers(completeProfile(templateProfile())), [
    'project.name',
    'repository.slug',
    'adapters.stacks'
  ])
  assert.deepEqual(missingAnswers(completeProfile(ANSWERS)), [])
})

test('the profile file is written in the order of the schema, the unknown keys last', () => {
  const ordered = canonical({ zeta: 1, adapters: { host: 'h', stacks: [] }, repository: { slug: 's' } }, readSchema())
  assert.deepEqual(Object.keys(ordered), ['repository', 'adapters', 'zeta'])
  assert.deepEqual(Object.keys(ordered.adapters), ['stacks', 'host'])
  assert.ok(serializeProfile(ordered).endsWith('}\n'))
})

test('an adapter the framework does not have is named with the ones it has', () => {
  const problems = unknownAdapters(completeProfile({ ...ANSWERS, adapters: { stacks: ['rust'] } }), adapterCatalogue())
  assert.deepEqual(problems, ['the framework has no stack adapter "rust"; it has node-ts, python'])
})

test('the scaffold joins the ignore lines of every part and renders the core files with the profile', () => {
  const profile = withDefaults(readSchema(), completeProfile(ANSWERS))
  const files = Object.fromEntries(scaffoldPlan({ profile, modules }).map(({ path, content }) => [path, content]))
  const ignore = files['.gitignore'].split('\n')
  assert.ok(['.env', 'node_modules/', '.claude/settings.local.json'].every((line) => ignore.includes(line)))
  assert.equal(new Set(ignore).size, ignore.length)
  assert.match(files['AGENTS.md'], /^# acme — rules for agents/)
  assert.match(files['AGENTS.md'], /<!-- harness:begin git-rules -->\n<!-- harness:end git-rules -->/)
  assert.match(files['docs/engineering/stack.md'], /The stack adapters of the profile: node-ts \(TypeScript on Node/)
  assert.ok(files['docs/development-plan/issues/README.md'].startsWith('[← Development plan](../README.md)'))
  assert.ok(files['docs/development-plan/issues/archived/README.md'].startsWith('[← Issue queue](../README.md)'))
  assert.match(files['docs/development-plan/issues/README.md'], /\[archive\]\(\.\/archived\/README\.md\)/)
  assert.ok(!Object.keys(files).some((path) => /phase-\d+-issues/.test(path)), 'no open-ended phase is made any more')
  assert.ok(files['.github/workflows/ci.yml'] && files['CLAUDE.md'] && files['package.json'])
})

test('the scaffold writes the product-knowledge skeleton, which the entry file points to and the product-knowledge check accepts', () => {
  const profile = withDefaults(readSchema(), completeProfile(ANSWERS))
  const files = Object.fromEntries(scaffoldPlan({ profile, modules }).map(({ path, content }) => [path, content]))
  assert.deepEqual(profile.productKnowledge.excluded, ['open-questions.md', 'backlog.md'])
  for (const path of ['README.md', 'glossary.md', 'open-questions.md', 'backlog.md']) {
    assert.ok(files[`docs/product/${path}`], path)
  }
  assert.match(
    files['docs/product/README.md'],
    /^\[← README\]\(\.\.\/\.\.\/README\.md\)\n\n# acme — product specification/
  )
  assert.match(files['docs/product/glossary.md'], /\| Term \| Code name \| Aliases \| Definition \|/)
  assert.match(files['docs/product/open-questions.md'], /\| Id \| Question \| Kind \| Section \| Blocks \| Owner \|/)
  assert.match(
    files['AGENTS.md'],
    /\| understand what the product is or does \| the \[product specification\]\(\.\/docs\/product\/README\.md\)/
  )
})

test('a project with two stacks gets one CI workflow whose job ids are unique, each stack with its own static job and its own coverage jobs', () => {
  const profile = withDefaults(
    readSchema(),
    completeProfile({
      ...ANSWERS,
      adapters: {
        stacks: [
          { adapter: 'node-ts', packages: ['web'] },
          { adapter: 'python', packages: ['api'] }
        ],
        runtimes: ['claude-code']
      },
      coveragePackages: ['web', 'api']
    })
  )
  const files = Object.fromEntries(scaffoldPlan({ profile, modules }).map(({ path, content }) => [path, content]))
  const ci = files['.github/workflows/ci.yml']
  const jobIds = [...ci.slice(ci.indexOf('\njobs:')).matchAll(/^ {2}([a-z][\w-]*):$/gm)].map((match) => match[1])
  assert.equal(new Set(jobIds).size, jobIds.length, jobIds.join(', '))
  assert.deepEqual(jobIds, ['pr-title', 'changes', 'static-node-ts', 'web', 'static-python', 'api', 'verify'])
  assert.match(ci, /needs: \[changes, static-node-ts, web, static-python, api\]/)
  assert.equal(files['.nvmrc'], '22\n', 'both stacks name the Node version, as one line')
  assert.match(files['pyproject.toml'], /members = \["api"\]/)
})

test('without an agent runtime the project gets the agent-neutral minimum', () => {
  const profile = withDefaults(readSchema(), completeProfile({ ...ANSWERS, adapters: { stacks: ['node-ts'] } }))
  const files = scaffoldPlan({ profile, modules })
  assert.ok(!files.some(({ path }) => path === 'CLAUDE.md' || path.startsWith('.claude/')))
  const stack = files.find(({ path }) => path === 'docs/engineering/stack.md').content
  assert.match(stack, /agent-runtime adapters of the profile: none \(the agent-neutral minimum/)
})

test('two parts of the scaffold that write the same file are refused, unless it is a file of lines', () => {
  const profile = withDefaults(readSchema(), completeProfile(ANSWERS))
  const twice = {
    ...modules,
    runtime: {
      'claude-code': {
        manifest: { roles: { 'scaffold-files': { module: 'm.mjs', export: 'scaffoldFiles' } } },
        modules: { 'm.mjs': { scaffoldFiles: () => [{ path: 'AGENTS.md', content: 'mine' }] } }
      }
    }
  }
  assert.throws(() => scaffoldPlan({ profile, modules: twice }), /AGENTS\.md is written by two parts of the scaffold/)
})

test('the bootstrap refuses to overwrite a file the project already has, and writes nothing', async () => {
  const root = fresh()
  writeFileSync(join(root, 'harness-profile.json'), JSON.stringify(ANSWERS))
  writeFileSync(join(root, 'README.md'), 'my own\n')
  await assert.rejects(bootstrap({ root }), /refusing to overwrite README\.md: .*pass --force/)
  assert.equal(existsSync(join(root, 'AGENTS.md')), false)
  assert.equal(existsSync(join(root, 'harness')), false)
  assert.equal(readFileSync(join(root, 'README.md'), 'utf8'), 'my own\n')
})

test('the bootstrap names the roles the profile file lacks and the profile problems', async () => {
  const root = fresh()
  writeFileSync(join(root, 'harness-profile.json'), JSON.stringify({ project: { name: 'x' } }))
  await assert.rejects(bootstrap({ root }), /no value for repository\.slug, adapters\.stacks/)
  writeFileSync(join(root, 'harness-profile.json'), JSON.stringify({ ...ANSWERS, coverageGate: { lines: 'all' } }))
  await assert.rejects(bootstrap({ root }), /coverageGate\.lines: expected number/)
  rmSync(join(root, 'harness-profile.json'))
  await assert.rejects(bootstrap({ root }), /there is no harness-profile\.json: run `harness init`/)
})

test('a bootstrapped project is not bootstrapped again', async () => {
  const root = fresh()
  writeFileSync(join(root, 'harness-profile.json'), JSON.stringify(ANSWERS))
  writeFileSync(join(root, 'harness.lock.json'), JSON.stringify({ mode: 'pinned' }))
  await assert.rejects(bootstrap({ root }), /bootstrapped already: `harness sync` keeps it current/)
})

test('the template repository holds every adapter, the empty questions, and a lock that marks its own files', () => {
  const out = fresh()
  buildTemplate({ out })
  const lock = readLock(out)
  assert.deepEqual(lock.template, ['README.md', 'BOOTSTRAP.md'])
  assert.deepEqual(lock.adapters, {
    stacks: ['node-ts', 'python'],
    runtimes: ['claude-code', 'cursor'],
    hosts: ['github']
  })
  assert.equal(lock.source.type, 'path')
  assert.ok(existsSync(join(out, 'harness', 'adapters', 'runtime', 'claude-code', 'manifest.json')))
  assert.ok(existsSync(join(out, 'BOOTSTRAP.md')))
  assert.match(readFileSync(join(out, 'README.md'), 'utf8'), /node harness\/tools\/harness\.mjs init/)
  const profile = JSON.parse(readFileSync(join(out, 'harness-profile.json'), 'utf8'))
  assert.deepEqual(profile.project, { name: '' })
  assert.deepEqual(profile.adapters, { stacks: [], runtimes: [], host: 'github' })
  assert.throws(() => buildTemplate({ out }), /is not empty/)
})

test('--set takes JSON when it parses, the text otherwise; flags answer their questions', () => {
  assert.deepEqual(parseSet('coverageGate.lines=80'), ['coverageGate.lines', 80])
  assert.deepEqual(parseSet('commands.lint=make lint'), ['commands.lint', 'make lint'])
  assert.deepEqual(parseSet('coveragePackages=["api"]'), ['coveragePackages', ['api']])
  assert.throws(() => parseSet('nothing'), /--set needs role=value/)

  const { answers, given } = answersFromFlags(
    { project: { name: 'old' } },
    { name: 'new', stack: 'node-ts, python', runtime: '', set: ['branches.production=trunk'] }
  )
  assert.equal(answers.project.name, 'new')
  assert.deepEqual(answers.adapters, { stacks: ['node-ts', 'python'], runtimes: [] })
  assert.equal(answers.branches.production, 'trunk')
  assert.deepEqual([...given].sort(), ['adapters.runtimes', 'adapters.stacks', 'branches.production', 'project.name'])
})

test('init without the required answers fails, names their flags, and writes nothing', async () => {
  const root = fresh()
  await assert.rejects(
    init({ root, flags: { nonInteractive: true, name: 'acme' } }),
    /no value for repository\.slug \(--repository\), adapters\.stacks \(--stack\)/
  )
  assert.equal(existsSync(join(root, 'harness-profile.json')), false)
})

test('init asks only what no flag answered, and an empty reply takes the value offered', async () => {
  const root = fresh()
  const prompts = []
  // Answers for: stacks, runtimes, host, coverage gate, production, integration (name and repository came by flag)
  const input = ['node-ts', '', '', '80', '', 'next'].join('\n')
  await assert.rejects(
    init({
      root,
      flags: { name: 'acme', repository: 'acme/shop', from: join(root, 'missing') },
      input,
      out: (line) => prompts.push(line)
    }),
    /holds no framework\.json/
  )
  assert.equal(prompts.length, 6)
  assert.ok(prompts[0].startsWith('Stack adapters (available: node-ts, python)'))
  const written = JSON.parse(readFileSync(join(root, 'harness-profile.json'), 'utf8'))
  assert.deepEqual(written.adapters, { stacks: ['node-ts'], runtimes: [], host: 'github' })
  assert.equal(written.coverageGate.branches, 80)
  assert.deepEqual(written.branches, { production: 'main', integration: 'next' })
})

test('retarget points the framework paths of the starting values at another framework folder', () => {
  assert.equal(retarget('`node harness/tools/harness.mjs plan log <n>`', '.'), '`node tools/harness.mjs plan log <n>`')
  assert.deepEqual(retarget({ a: ['harness/core/x.md', 'a harness/ b'] }, 'vendor'), {
    a: ['vendor/core/x.md', 'a harness/ b']
  })
  assert.equal(retarget(7, '.'), 7)
})

test('--self makes the framework tree at the root a project of its own: mode self, nothing vendored, paths without harness/', async () => {
  const root = fresh()
  // The tree of a framework repository: what a sync would copy (in the framework's own repository the root also holds its project files)
  for (const path of JSON.parse(readFileSync(join(FRAMEWORK_DIR, 'framework.json'), 'utf8')).distributable) {
    cpSync(join(FRAMEWORK_DIR, path), join(root, path), { recursive: true })
  }
  cpSync(join(FRAMEWORK_DIR, 'profile', 'starter.json'), join(root, 'profile', 'starter.json'))
  const readme = readFileSync(join(root, 'README.md'), 'utf8')
  writeFileSync(
    join(root, 'harness-profile.json'),
    JSON.stringify({
      project: { name: 'framework-itself' },
      repository: { slug: 'acme/framework-itself' },
      adapters: { stacks: ['node-ts'], runtimes: ['claude-code'] },
      paths: { frameworkDir: '.' },
      host: { protection: false }
    })
  )
  const problems = []
  // The bootstrap commits: a fixed identity, so that the test does not depend on the machine's Git configuration (CI has none)
  const identity = {
    GIT_AUTHOR_NAME: 't',
    GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@t'
  }
  const saved = Object.fromEntries(Object.keys(identity).map((key) => [key, process.env[key]]))
  Object.assign(process.env, identity)
  let done
  try {
    ;({ messages: done } = await bootstrap({ root, self: true, out: () => {}, err: (line) => problems.push(line) }))
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }

  const lock = readLock(root)
  assert.equal(lock.mode, 'self')
  assert.equal(lock.files, undefined)
  assert.ok(!existsSync(join(root, 'harness')), 'nothing is vendored')
  assert.equal(readFileSync(join(root, 'README.md'), 'utf8'), readme, 'the framework keeps its own README')
  assert.match(done.join('\n'), /Kept the files of the framework itself: .*README\.md/)

  const settings = JSON.parse(readFileSync(join(root, '.claude', 'settings.json'), 'utf8'))
  assert.equal(
    settings.hooks.PreToolUse[0].hooks[0].command,
    'node "$CLAUDE_PROJECT_DIR/tools/runtime-hooks/guard-shell.mjs"'
  )
  const entry = readFileSync(join(root, 'AGENTS.md'), 'utf8')
  assert.match(entry, /\(\.\/core\/method\/method\.md#6-session-protocol/)
  assert.match(entry, /\[`core\/procedures\/start-task\.md`\]\(\.\/core\/procedures\/start-task\.md\)/)
  assert.match(
    readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8'),
    /node tools\/harness\.mjs ci changes/
  )
  assert.equal(
    JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts.prepare,
    'git config core.hooksPath tools/git-hooks'
  )
  assert.deepEqual(
    problems.filter((line) => /^harness check (vendored|generated|scaffold|profile|values|adapters)/.test(line)),
    [],
    'the checks that belong to the mode find nothing'
  )
})

test('--self cannot be combined with --detached or --from', async () => {
  await assert.rejects(() => bootstrap({ root: fresh(), self: true, detached: true }), /cannot be combined/)
  await assert.rejects(() => bootstrap({ root: fresh(), self: true, from: '/somewhere' }), /cannot be combined/)
})
