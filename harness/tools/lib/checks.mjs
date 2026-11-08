// The checks of `harness check <name>` and `harness check all` (design §7.1), each as `({ root, profile }) → { problems, messages }`. `check all`
// runs them in the order below and then the project's own checks (`checks.project` of the profile file: commands), so the procedures and the
// definition of done cite one command.
import { spawnSync } from 'node:child_process'
import { failureReport, maxLinesOf, outputFolder, stdioToFile } from './output.mjs'
import { join } from 'node:path'
import { checkAdapters } from './adapters.mjs'
import { checkChangelog } from './changelog.mjs'
import { checkMarkers } from './conflict-markers.mjs'
import { checkCore } from './core-scan.mjs'
import { checkFlowsWithUsage } from './flow-usage-check.mjs'
import { ADAPTER_RUNTIMES } from './runtimes.mjs'
import { checkLayers } from './layers.mjs'
import { listLocalAdapters, localAdapterProblems, localLoadErrors, localSuiteProblems } from './local-adapters.mjs'
import { checkLinks } from './links.mjs'
import { checkNotesList } from './migration-notes.mjs'
import { checkOffPlan } from './off-plan.mjs'
import { checkPaths } from './paths.mjs'
import { planSummary } from './plan.mjs'
import { checkProbes } from './probe-areas.mjs'
import { checkProductKnowledge } from './product-knowledge.mjs'
import { checkProfile, loadProfile } from './profile.mjs'
import { checkScaffold } from './scaffold.mjs'
import { checkSecurity } from './security.mjs'
import { checkGenerated, checkVendored } from './vendor.mjs'
import { checkValues } from './values.mjs'

const single = ({ problems, message }) => ({ problems, messages: [message] })

export const CHECKS = {
  vendored: ({ root }) => {
    const { problems, notes } = checkVendored({ root })
    const done = 'Checked the vendored framework, the managed files and the profile file against harness.lock.json.'
    return { problems, messages: [...notes, ...(problems.length ? [] : [done])] }
  },
  generated: ({ root }) => ({
    problems: checkGenerated({ root }),
    messages: ['Checked that the managed files and blocks are what the tools generate now.']
  }),
  profile: ({ root }) => ({ problems: checkProfile(root), messages: ['Checked the profile file against the schema.'] }),
  scaffold: (context) => single(checkScaffold(context)),
  adapters: ({ root, profile }) => {
    const { adapters, problems } = checkAdapters()
    const local = listLocalAdapters(root)
    return {
      problems: [...problems, ...localAdapterProblems(root, profile), ...localLoadErrors()],
      messages: [
        `Checked the manifests of ${adapters.length + local.length} adapters against their contracts${local.length ? ` (${local.length} of the project's own repository)` : ''}.`
      ]
    }
  },
  'local-adapters': ({ root }) => {
    const { problems, count } = localSuiteProblems(root)
    return {
      problems,
      messages: [
        count
          ? `Ran the conformance suite on ${count} adapters of the project's own repository.`
          : 'The project has no adapters of its own repository (`harness-adapters/`), so there is no conformance suite to run.'
      ]
    }
  },
  values: (context) => single(checkValues(context)),
  layers: ({ root, profile }) =>
    profile.layers
      ? {
          problems: checkLayers({ root, profile }),
          messages: ['Checked that every file of the layer map is in exactly one layer.']
        }
      : { problems: [], messages: ['The profile file has no `layers` role, so there is no layer map to check.'] },
  links: ({ root, profile }) => {
    const { problems, count } = checkLinks({ root, indexedFolders: profile.checks?.indexedFolders })
    return { problems, messages: [`Checked links in ${count} Markdown files.`] }
  },
  markers: (context) => single(checkMarkers(context)),
  paths: (context) => single(checkPaths(context)),
  core: (context) => single(checkCore(context)),
  plan: (context) => single(planSummary({ ...context, check: true })),
  flows: (context) => single(checkFlowsWithUsage({ runtimes: ADAPTER_RUNTIMES, ...context })),
  changelog: (context) => single(checkChangelog(context)),
  notes: (context) => single(checkNotesList(context)),
  'off-plan': (context) => single(checkOffPlan(context)),
  probes: (context) => single(checkProbes(context)),
  'product-knowledge': (context) => checkProductKnowledge(context),
  security: (context) => checkSecurity(context)
}

/** Runs one check by name; a check that throws reports the error as its problem. */
export function runCheck(name, context) {
  try {
    return CHECKS[name](context)
  } catch (error) {
    return { problems: [`${error.message}`], messages: [] }
  }
}

/**
 * The project's own checks: each command of `checks.project`, run in a shell from the project root. With `stdio` (or `verbose`) its output is shown as it runs;
 * otherwise it goes to a file, and a check that fails reports the file and its failing lines through `err`, at most `output.maxLines`.
 */
export function runProjectChecks({ root, profile }, { stdio, verbose = false, err = () => {} } = {}) {
  const problems = []
  const quiet = !stdio && !verbose
  const folder = quiet ? outputFolder('check') : null
  let counter = 0
  for (const command of profile.checks?.project ?? []) {
    const file = quiet ? join(folder, `${(counter += 1)}.log`) : null
    const target = file ? stdioToFile(file) : null
    let status
    try {
      status = spawnSync(command, { cwd: root, shell: true, stdio: target?.stdio ?? stdio ?? 'inherit' }).status
    } finally {
      target?.close()
    }
    if (status !== 0) {
      problems.push(`the project check \`${command}\` failed`)
      if (file) failureReport(file, maxLinesOf(profile)).forEach((line) => err(line))
    }
  }
  return problems
}

/**
 * Prints what a check found (`harness check <name>`); returns its exit code. A check that passes prints its first message (one line), or all of them with
 * `verbose`; a check that finds problems prints them, and its messages only with `verbose`. The `notes` of a result are lines of its messages that a
 * method relies on in every result (the gaps of `check security`): they are printed when the messages are not.
 */
export function report(name, { problems, messages, notes = [] }, { out, err, verbose = false }) {
  if (verbose) messages.forEach((line) => out(line))
  else {
    const first = problems.length ? [] : messages.slice(0, 1)
    first.forEach((line) => out(line))
    notes.filter((line) => !first.includes(line)).forEach((line) => out(line))
  }
  problems.forEach((line) => err(`harness check ${name}: ${line}`))
  return problems.length ? 1 : 0
}

/**
 * `harness check all`: every check in order, then the project's own; the exit code is 1 when any of them found a problem. It prints the problems and one line
 * (`N checks passed`), or what every check says with `verbose`.
 */
export function checkAll({ root, out, err, stdio, verbose = false }) {
  const profile = loadProfile(root)
  let failed = false
  const names = Object.keys(CHECKS).filter((name) => name !== 'security' || profile.checks?.security)
  const passed = []
  for (const name of names) {
    const result = runCheck(name, { root, profile })
    if (verbose) failed = report(name, result, { out, err, verbose }) !== 0 || failed
    else {
      result.problems.forEach((line) => err(`harness check ${name}: ${line}`))
      if (result.problems.length) failed = true
      else passed.push(name)
    }
  }
  const projectProblems = runProjectChecks({ root, profile }, { stdio, verbose, err })
  projectProblems.forEach((line) => err(`harness check all: ${line}`))
  if (!verbose && !failed && !projectProblems.length) out(`harness check all: ${passed.length} checks passed`)
  else if (!verbose)
    out(
      `harness check all: ${names.length - passed.length} of ${names.length} checks failed${projectProblems.length ? `, ${projectProblems.length} project check(s) failed` : ''}`
    )
  return failed || projectProblems.length ? 1 : 0
}
