// The local gate driver (design §3.4 and §7.3), `harness gate`, run by the pre-push hook: it reads the refs of the push from standard input, takes the
// files they change and runs only the checks those files need. The driver is the same for every stack: it routes each changed file to the stack
// that owns it (`plan` of the stack adapter's `local-gate-plan` role), adds the documentation checks for a push that changes documentation, and the
// project's own steps (`gate.steps` of the profile file). The full run is CI's.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { documentationPaths, isDocumentation } from './changes.mjs'
import { claims } from './layers.mjs'
import { failureReport, maxLinesOf, outputFolder, stdioToFile } from './output.mjs'
import { owns, selectedStacks, stackModule, STACKS } from './stacks.mjs'

// The name of a change that cannot be listed: not documentation, in no package, so every stack runs its full plan
export const UNREADABLE = 'unknown.ts'
const HARNESS = join(import.meta.dirname, '..', 'harness.mjs')

// The variables that point Git at a repository (`git rev-parse --local-env-vars`). Git runs the hooks of a linked worktree with
// GIT_DIR=<repo>/.git/worktrees/<name>: a step that kept it and ran Git in a folder of its own would act on the pushing repository (I-8).
export const REPOSITORY_ENV = Object.freeze([
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_CONFIG',
  'GIT_CONFIG_PARAMETERS',
  'GIT_CONFIG_COUNT',
  'GIT_OBJECT_DIRECTORY',
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_IMPLICIT_WORK_TREE',
  'GIT_GRAFT_FILE',
  'GIT_INDEX_FILE',
  'GIT_NO_REPLACE_OBJECTS',
  'GIT_REPLACE_REF_BASE',
  'GIT_PREFIX',
  'GIT_INTERNAL_SUPER_PREFIX',
  'GIT_SHALLOW_FILE',
  'GIT_COMMON_DIR'
])

/** The environment without the variables that point Git at a repository; `GIT_CONFIG_KEY_<n>` and `GIT_CONFIG_VALUE_<n>` go with their count. */
export function withoutRepositoryEnv(env) {
  return Object.fromEntries(
    Object.entries(env).filter(([name]) => !REPOSITORY_ENV.includes(name) && !/^GIT_CONFIG_(KEY|VALUE)_\d+$/.test(name))
  )
}

/** The ranges of a push: the hook gets "<local ref> <local sha> <remote ref> <remote sha>" lines; a new branch is compared with the integration branch. */
export function rangesOfPush(stdin, integration) {
  const zero = /^0+$/
  const ranges = []

  for (const line of stdin.split('\n').filter(Boolean)) {
    const [, localSha, , remoteSha] = line.split(' ')
    if (!localSha || zero.test(localSha)) {
      continue // deleting a branch
    }
    ranges.push(remoteSha && !zero.test(remoteSha) ? `${remoteSha}..${localSha}` : `origin/${integration}..${localSha}`)
  }
  return ranges
}

/** The files changed by the ranges; a range that cannot be read (a base the clone does not have) makes the gate run everything. */
export function changedFiles(root, ranges) {
  const files = new Set()
  for (const range of ranges) {
    let names
    try {
      names = execFileSync('git', ['diff', '--name-only', range], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).split('\n')
    } catch {
      names = [UNREADABLE] // no stack plan can follow it to its tests, so the whole package runs
    }
    names.filter(Boolean).forEach((name) => files.add(name))
  }
  return [...files]
}

// A project step applies when a relevant file matches `when` (default: any), unless every relevant file matches `unlessOnly`
function stepApplies(step, files) {
  const hit = (patterns, file) => claims(patterns, file)
  if (files.length === 0) {
    return false // nothing the gate looks at changed
  }
  if (step.when && !files.some((file) => hit(step.when, file))) {
    return false
  }
  return !(step.unlessOnly && files.every((file) => hit(step.unlessOnly, file)))
}

// The commands of a project step, and the check that the files it regenerates did not change
function expandProjectStep(step) {
  const commands = (step.run ?? []).map(([command, ...args]) => ({ label: step.label, command, args }))
  return step.diff?.length
    ? [
        ...commands,
        { label: step.label, command: 'git', args: ['diff', '--exit-code', '--', ...step.diff], hint: step.hint }
      ]
    : commands
}

/**
 * The plan of the gate for a push.
 * @param {string[]} files the paths the push changes
 * @param {{ profile: object, stacks?: object, exists: (file: string) => boolean }} options `stacks` are the loaded stack adapters
 * @returns {{ skip: string | null, steps: object[] }} `skip` is the reason when the push needs no check at all
 */
export function planPush(files, { profile, stacks = STACKS, exists }) {
  const changed = [...new Set(files.filter(Boolean))]
  if (changed.length === 0) {
    return { skip: 'the push changes no file', steps: [] }
  }

  const patterns = documentationPaths(profile)
  const gate = profile.gate ?? {}
  const steps = []
  if (changed.some((file) => isDocumentation(file, patterns))) {
    steps.push({ label: 'documentation checks', command: 'harness', args: ['check', 'all'] })
  }

  const relevant = changed.filter((file) => !isDocumentation(file, patterns) && !claims(gate.outside ?? [], file))
  if (changed.every((file) => isDocumentation(file, patterns))) {
    return { skip: null, steps, note: 'the push changes only documentation, so no code check is needed' }
  }

  const selected = selectedStacks(profile, stacks)
  const isolated = (file) => claims(gate.isolated ?? [], file)
  for (const stack of selected) {
    const own = relevant.filter((file) => owns(stack, file, selected.length))
    const planner = stackModule(stack, 'local-gate-plan')
    if (own.length === 0 || !planner) {
      continue
    }
    const packages = stack.folders.length ? stack.folders : (profile.coveragePackages ?? [])
    const { steps: stackSteps } = planner.plan({
      files: own,
      packages,
      integration: profile.branches.integration,
      exists,
      isolated
    })
    steps.push(
      ...stackSteps.map((step) => {
        const need = Object.entries(gate.needs ?? {}).find(([, owners]) => owners.includes(step.package))?.[0]
        return need ? { ...step, need } : step
      })
    )
  }

  for (const step of gate.steps ?? []) {
    // `when` looks at every changed file, so a step for the scripts runs for a change that is documentation as well
    const subject = step.when ? changed : relevant
    if (stepApplies(step, subject)) {
      steps.push(...expandProjectStep(step))
    }
  }
  return { skip: null, steps }
}

/** Runs a step with the process in `env`; `harness` is the framework's own command line. */
function defaultRun(step, root, env, { file } = {}) {
  const [command, args] =
    step.command === 'harness' ? [process.execPath, [HARNESS, ...step.args]] : [step.command, step.args]
  const target = file ? stdioToFile(file) : null
  try {
    return (
      spawnSync(command, args, { cwd: join(root, step.cwd ?? '.'), stdio: target?.stdio ?? 'inherit', env }).status ?? 1
    )
  } finally {
    target?.close()
  }
}

/**
 * `harness gate [--dry-run] [--verbose]`: plans the push on standard input and runs the plan; returns the exit code. A step runs with its output in a file and prints
 * nothing when it passes; a step that fails prints the file's path and its failing lines, at most `output.maxLines` (`verbose` lets the steps print as they run).
 * @param {{ root: string, profile: object, stdin: string, dryRun?: boolean, verbose?: boolean, out: Function, err: Function, run?: Function, prepare?: Function, stacks?: object, env?: object }} options
 *   `run(step, root, env, { file }) → exit code` (`file` is where a quiet step's output goes) and `prepare(need, root, run)` are the seams of the tests; every step runs in `env` (the process's by
 *   default) without the variables that point Git at a repository
 */
export async function runGate({
  root,
  profile,
  stdin,
  dryRun = false,
  verbose = false,
  out,
  err,
  run = defaultRun,
  prepare,
  stacks = STACKS,
  env = process.env
}) {
  const stepEnv = withoutRepositoryEnv(env)
  const folder = verbose ? null : outputFolder('gate')
  let counter = 0
  const outputOf = (step) => (folder ? join(folder, `${(counter += 1)}-${step.label.replace(/\W+/g, '-')}.log`) : null)
  let current = null
  const runStep = (step, at) =>
    run(!verbose && step.quiet ? { ...step, ...step.quiet } : step, at, stepEnv, {
      file: (current = outputOf(step)) ?? undefined
    })
  const files = changedFiles(root, rangesOfPush(stdin, profile.branches.integration))
  const plan = planPush(files, { profile, stacks, exists: (file) => existsSync(join(root, file)) })

  if (plan.skip) {
    out(`pre-push: no check needed, ${plan.skip}`)
    return 0
  }
  if (plan.note) {
    out(`pre-push: ${plan.note}`)
  }
  out(
    `pre-push: ${files.length} changed file(s); checks: ${[...new Set(plan.steps.map((step) => step.label))].join(', ')}`
  )
  if (dryRun) {
    return 0
  }

  const prepared = new Set()
  let announced = null
  for (const step of plan.steps) {
    if (verbose && step.label !== announced) {
      out(`pre-push: ${step.label}`)
      announced = step.label
    }
    if (step.need && !prepared.has(step.need)) {
      prepared.add(step.need)
      try {
        const done = await (prepare ?? defaultPrepare)(step.need, { root, profile, run: runStep })
        if (done?.message) {
          out(done.message)
        }
      } catch (error) {
        err(error.message)
        return 1
      }
    }
    for (const path of step.clears ?? []) {
      rmSync(join(root, path), { force: true })
    }
    const status = runStep(step, root)
    if (status !== 0) {
      err(`pre-push: "${step.label}" failed`)
      if (current) failureReport(current, maxLinesOf(profile)).forEach((line) => err(line))
      if (step.hint) {
        err(step.hint)
      }
      return status
    }
  }
  if (!verbose) out(`pre-push: passed (${plan.steps.length} step(s))`)
  return 0
}

// The project's module for a need (`gate.prepare`): `prepare({ root, run }) → { message? }`, which throws when the push must stop
async function defaultPrepare(need, { root, profile, run }) {
  const module = profile.gate?.prepare?.[need]
  if (!module) {
    throw new Error(`pre-push: a step needs "${need}", but the profile file has no gate.prepare.${need}`)
  }
  return (await import(join(root, module))).prepare({ root, run })
}

export const readStdin = () => (process.stdin.isTTY ? '' : readFileSync(0, 'utf8'))
