// The local gate driver (design §3.4 and §7.3), `harness gate`, run by the pre-push hook: it reads the refs of the push from standard input, takes the
// files they change and runs only the checks those files need. The driver is the same for every stack: it routes each changed file to the stack
// that owns it (`plan` of the stack adapter's `local-gate-plan` role), adds the documentation checks for a push that changes documentation, and the
// project's own steps (`gate.steps` of the profile file). The full run is CI's.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { documentationPaths, isDocumentation } from './changes.mjs'
import { claims } from './layers.mjs'
import { owns, selectedStacks, stackModule, STACKS } from './stacks.mjs'

// The name of a change that cannot be listed: not documentation, in no package, so every stack runs its full plan
export const UNREADABLE = 'unknown.ts'
const HARNESS = join(import.meta.dirname, '..', 'harness.mjs')

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

/** Runs a step with the process; `harness` is the framework's own command line. */
function defaultRun(step, root) {
  const [command, args] =
    step.command === 'harness' ? [process.execPath, [HARNESS, ...step.args]] : [step.command, step.args]
  return spawnSync(command, args, { cwd: join(root, step.cwd ?? '.'), stdio: 'inherit' }).status ?? 1
}

/**
 * `harness gate [--dry-run]`: plans the push on standard input and runs the plan; returns the exit code.
 * @param {{ root: string, profile: object, stdin: string, dryRun?: boolean, out: Function, err: Function, run?: Function, prepare?: Function, stacks?: object }} options
 *   `run(step, root) → exit code` and `prepare(need, root, run)` are the seams of the tests
 */
export async function runGate({
  root,
  profile,
  stdin,
  dryRun = false,
  out,
  err,
  run = defaultRun,
  prepare,
  stacks = STACKS
}) {
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
    if (step.label !== announced) {
      out(`pre-push: ${step.label}`)
      announced = step.label
    }
    if (step.need && !prepared.has(step.need)) {
      prepared.add(step.need)
      try {
        const done = await (prepare ?? defaultPrepare)(step.need, { root, profile, run })
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
    const status = run(step, root)
    if (status !== 0) {
      err(`pre-push: "${step.label}" failed`)
      if (step.hint) {
        err(step.hint)
      }
      return status
    }
  }
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
