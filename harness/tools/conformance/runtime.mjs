// The checks of an agent-runtime adapter (design §4.2, §5): each hook of the framework, fed that runtime's recorded event samples through `io.mjs`,
// refuses what the Git rules forbid and lets the rest through; and the adapter's own logic roles.
//
// conformance.json of a runtime adapter:
//   events    the folder of the recorded samples, relative to the adapter
//   samples   the file of each event: sessionStart, shellRefused (a push to the production branch), shellAllowed (`ls -la`),
//             editRefused (a write of an environment file), editAllowed (an edit of a source file), editAfter (the event after a file edit)
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
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
