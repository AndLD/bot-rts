// The checks of an agent-runtime adapter (design §4.2, §5): each hook of the framework, fed that runtime's recorded event samples through `io.mjs`,
// refuses what the Git rules forbid and lets the rest through; and the adapter's own logic roles, the executors of a flow among them.
//
// conformance.json of a runtime adapter:
//   events    the folder of the recorded samples, relative to the adapter
//   samples   the file of each event: sessionStart, shellRefused (a push to the production branch), shellAllowed (`ls -la`),
//             editRefused (a write of an environment file), editAllowed (an edit of a source file), editAfter (the event after a file edit)
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { OPERATIONS, OPTIONAL_OPERATIONS, PERMISSIONS_OPERATION, PROMPT_SLOT } from '../lib/flow-executors.mjs'
import { EXECUTORS } from '../lib/flow-steps.mjs'
import { usageProblems } from '../lib/flow-usage.mjs'
import { Skip } from './skip.mjs'

const SAMPLES = ['sessionStart', 'shellRefused', 'shellAllowed', 'editRefused', 'editAllowed', 'editAfter']
// A branch that is not protected, where the shell hook has nothing to refuse but the command
const WORK_BRANCH = 'feature/1.1-conformance'
const branched = new WeakSet()

function readSample(context, key) {
  const { events, samples } = context.conformance
  assert.ok(events && samples?.[key], `conformance.json has no events folder, or no samples.${key}`)
  const path = join(resolve(context.dir, events), samples[key])
  assert.ok(existsSync(path), `${path} (samples.${key}) does not exist`)
  return JSON.parse(readFileSync(path, 'utf8'))
}

// Runs the framework's hook `script` on a sample, in the fixture project on a work branch
function hook(context, script, key) {
  const project = context.project()
  if (!branched.has(project)) {
    execFileSync('git', ['checkout', '--quiet', '-b', WORK_BRANCH], { cwd: project.root, env: project.env })
    branched.add(project)
  }
  const event = { ...readSample(context, key), cwd: project.root, workspace_roots: [project.root] }
  const result = spawnSync(process.execPath, [join(context.framework(), 'tools', 'runtime-hooks', `${script}.mjs`)], {
    input: JSON.stringify(event),
    encoding: 'utf8',
    env: { ...project.env, CLAUDE_PROJECT_DIR: project.root, CURSOR_PROJECT_DIR: project.root }
  })
  return { code: result.status, out: result.stdout, err: result.stderr }
}

// The refusal in the form of the runtime: exit code 2 with the reason on standard error or on standard output
const refuses = (result) => result.code === 2 && `${result.err}${result.out}`.trim().length > 0

// The kinds of means an operation of an executor returns (the runtime contract, role `executors`)
const MEANS_KINDS = ['tool', 'command', 'from', 'owner']
const carriesPrompt = (means) =>
  (means.command ?? []).includes(PROMPT_SLOT) ||
  JSON.stringify(means.input ?? {}).includes(PROMPT_SLOT) ||
  Boolean(means.owner)

function meansProblems(where, list) {
  if (!Array.isArray(list)) return [`${where} returns no list of means`]
  return list.flatMap((means, index) => {
    const at = `${where}[${index}]`
    const kinds = MEANS_KINDS.filter((kind) => means?.[kind] !== undefined)
    const problems = []
    if (typeof means?.via !== 'string' || !means.via) problems.push(`${at} has no \`via\` (where the means applies)`)
    if (kinds.length !== 1)
      problems.push(`${at} needs exactly one of ${MEANS_KINDS.join(', ')}, it has ${kinds.join(', ') || 'none'}`)
    if (means?.tool !== undefined && (typeof means.input !== 'object' || means.input === null))
      problems.push(`${at} names the tool ${means.tool} without an input object`)
    if (
      means?.command !== undefined &&
      !(Array.isArray(means.command) && means.command.every((word) => typeof word === 'string'))
    )
      problems.push(`${at} has a command that is not a list of words`)
    return problems
  })
}

/** The problems of what the role `executors` returns; the conformance check and the tests of the presets share it. */
export function executorProblems(executors) {
  if (!executors || typeof executors !== 'object' || Array.isArray(executors)) return ['executorsFor returns no object']
  const kinds = Object.keys(executors)
  if (!kinds.length) return ['the runtime offers no executor: return `{ manual }` at least (the cursor preset)']
  const problems = kinds
    .filter((kind) => !EXECUTORS.includes(kind))
    .map((kind) => `"${kind}" is no executor (${EXECUTORS.join(', ')})`)
  for (const kind of kinds.filter((each) => EXECUTORS.includes(each))) {
    const executor = executors[kind]
    if (typeof executor?.means !== 'string' || !executor.means) problems.push(`${kind}: no \`means\` text`)
    if (typeof executor?.wakeups !== 'boolean') problems.push(`${kind}: \`wakeups\` is not true or false`)
    if (!(Number.isFinite(executor?.cacheMinutes) && executor.cacheMinutes >= 0))
      problems.push(`${kind}: \`cacheMinutes\` is not a number of minutes`)
    const missing = OPERATIONS.filter((operation) => typeof executor?.[operation] !== 'function')
    if (missing.length) {
      problems.push(`${kind}: no ${missing.join(', ')} operation`)
      continue
    }
    const request = { prompt: PROMPT_SLOT, model: 'Sonnet 5.5', effort: 'high', cwd: '.', name: 'flow-1-step-1' }
    const start = executor.start(request)
    const resume = executor.continue({ ...request, worker: 'worker-1' })
    const report = executor.report({ worker: 'worker-1' })
    const context = executor.context({ worker: 'worker-1' })
    problems.push(
      ...meansProblems(`${kind}.start`, start),
      ...meansProblems(`${kind}.continue`, resume),
      ...meansProblems(`${kind}.report`, report),
      ...meansProblems(`${kind}.context`, context)
    )
    if (Array.isArray(start) && !start.length) problems.push(`${kind}: start offers no means`)
    if (Array.isArray(report) && !report.length)
      problems.push(`${kind}: report offers no means to fetch the full report`)
    if (Array.isArray(start) && start.some((means) => !means.from && !carriesPrompt(means)))
      problems.push(`${kind}.start: a means does not carry the prompt (the slot ${PROMPT_SLOT})`)
    if (kind === 'session' && Array.isArray(resume) && !resume.length)
      problems.push('session: continue offers no means')
    for (const operation of OPTIONAL_OPERATIONS.filter((each) => executor[each] !== undefined)) {
      if (typeof executor[operation] !== 'function') problems.push(`${kind}: \`${operation}\` is not an operation`)
      else problems.push(...meansProblems(`${kind}.${operation}`, executor[operation]()))
    }
    if (executor[PERMISSIONS_OPERATION] !== undefined) {
      const said = typeof executor[PERMISSIONS_OPERATION] === 'function' ? executor[PERMISSIONS_OPERATION]({}) : null
      if (typeof said !== 'string' || !said.trim())
        problems.push(`${kind}: \`${PERMISSIONS_OPERATION}\` returns no text saying what a worker is allowed`)
    }
    try {
      assert.deepEqual(JSON.parse(JSON.stringify(start)), start)
    } catch {
      problems.push(`${kind}.start returns means that are not plain data`)
    }
  }
  return problems
}

export const runtimeChecks = [
  {
    name: 'the recorded event samples exist and are JSON',
    run: (context) => {
      for (const key of SAMPLES) {
        assert.equal(typeof readSample(context, key), 'object', key)
      }
    }
  },
  {
    name: 'guard-shell refuses a push to the production branch and lets an ordinary command through',
    run: (context) => {
      const refused = hook(context, 'guard-shell', 'shellRefused')
      assert.ok(refuses(refused), `the push was not refused with a reason: ${JSON.stringify(refused)}`)
      const allowed = hook(context, 'guard-shell', 'shellAllowed')
      assert.equal(allowed.code, 0, `an ordinary command was refused: ${allowed.err}`)
    }
  },
  {
    name: 'guard-edit refuses the edit of an environment file and lets a source file through',
    run: (context) => {
      const refused = hook(context, 'guard-edit', 'editRefused')
      assert.ok(
        refuses(refused),
        `the write of an environment file was not refused with a reason: ${JSON.stringify(refused)}`
      )
      const allowed = hook(context, 'guard-edit', 'editAllowed')
      assert.equal(allowed.code, 0, `the edit of a source file was refused: ${allowed.err}`)
    }
  },
  {
    name: 'the session-start and format hooks answer the runtime without blocking it',
    run: (context) => {
      for (const [script, key] of [
        ['session-start', 'sessionStart'],
        ['format-edited', 'editAfter']
      ]) {
        const result = hook(context, script, key)
        assert.equal(result.code, 0, `${script} exited ${result.code}: ${result.err}`)
      }
    }
  },
  {
    name: 'hook configuration: the runtime file for the profile is JSON',
    run: async (context) => {
      const entry = context.manifest.roles['hook-configuration']
      if (!entry?.module) {
        throw new Skip(
          'the hook-configuration role has no module (the rules that need a hook fall to the Git hooks and CI)'
        )
      }
      const { modules } = await context.adapter()
      const configuration = modules[entry.module][entry.export](context.profile())
      assert.ok(configuration && typeof configuration === 'object' && Object.keys(configuration).length > 0)
      assert.deepEqual(JSON.parse(JSON.stringify(configuration)), configuration)
    }
  },
  {
    name: 'procedure packaging: the text carries the name, the trigger and the steps, and is the same on every run',
    run: async (context) => {
      const { modules } = await context.adapter()
      const entry = context.manifest.roles['procedure-packaging']
      const procedure = {
        name: 'demo-procedure',
        description: 'Use when a demonstration is needed.',
        invocation: 'explicit'
      }
      const body = '# Demonstrate\n\n1. Do the first step.\n'
      const pack = modules[entry.module][entry.export]
      const text = pack(procedure, body)
      assert.equal(typeof text, 'string')
      assert.ok(
        text.includes(procedure.name) && text.includes(procedure.description) && text.includes('Do the first step.')
      )
      assert.equal(pack(procedure, body), text)
      assert.ok(text.endsWith('\n'))
    }
  },
  {
    name: 'executors: each starts, continues and reports a worker and reads its context, by means of the runtime',
    run: async (context) => {
      const entry = context.manifest.roles.executors
      assert.ok(
        entry?.module,
        'the executors role is not filled: a runtime without automation offers the manual executor (the cursor preset)'
      )
      const { modules } = await context.adapter()
      const problems = executorProblems(modules[entry.module][entry.export](context.profile()))
      assert.deepEqual(problems, [])
    }
  },
  {
    name: 'usage: a way to read the account and a table of coefficients that is complete',
    run: async (context) => {
      const entry = context.manifest.roles.usage
      if (!entry) {
        throw new Skip('the usage role is empty: the framework asks the owner for the use of the account')
      }
      const { modules } = await context.adapter()
      assert.deepEqual(usageProblems(modules[entry.module][entry.export](context.profile())), [])
    }
  },
  {
    name: 'scaffold files: paths inside the project, with content or lines',
    run: async (context) => {
      const entry = context.manifest.roles['scaffold-files']
      if (!entry) {
        throw new Skip('the scaffold-files role is empty')
      }
      const { modules } = await context.adapter()
      const files = modules[entry.module][entry.export](context.profile())
      assert.ok(Array.isArray(files) && files.length > 0)
      for (const file of files) {
        assert.ok(
          typeof file.path === 'string' && !isAbsolute(file.path) && !file.path.split('/').includes('..'),
          `${file.path} is not a path inside the project`
        )
        assert.ok(typeof file.content === 'string' || Array.isArray(file.lines), `${file.path} has content or lines`)
      }
    }
  }
]
