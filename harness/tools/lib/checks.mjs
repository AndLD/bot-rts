// The checks of `harness check <name>` and `harness check all` (design §7.1), each as `({ root, profile }) → { problems, messages }`. `check all`
// runs them in the order below and then the project's own checks (`checks.project` of the profile file: commands), so the procedures and the
// definition of done cite one command.
import { spawnSync } from 'node:child_process'
import { checkAdapters } from './adapters.mjs'
import { checkChangelog } from './changelog.mjs'
import { checkCore } from './core-scan.mjs'
import { checkLayers } from './layers.mjs'
import { checkLinks } from './links.mjs'
import { checkPaths } from './paths.mjs'
import { planSummary } from './plan.mjs'
import { checkProbes } from './probe-areas.mjs'
import { checkProductKnowledge } from './product-knowledge.mjs'
import { checkProfile, loadProfile } from './profile.mjs'
import { checkScaffold } from './scaffold.mjs'
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
  adapters: () => {
    const { adapters, problems } = checkAdapters()
    return { problems, messages: [`Checked the manifests of ${adapters.length} adapters against their contracts.`] }
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
  paths: (context) => single(checkPaths(context)),
  core: (context) => single(checkCore(context)),
  plan: (context) => single(planSummary({ ...context, check: true })),
  changelog: (context) => single(checkChangelog(context)),
  probes: (context) => single(checkProbes(context)),
  'product-knowledge': (context) => checkProductKnowledge(context)
}

/** Runs one check by name; a check that throws reports the error as its problem. */
export function runCheck(name, context) {
  try {
    return CHECKS[name](context)
  } catch (error) {
    return { problems: [`${error.message}`], messages: [] }
  }
}

/** The project's own checks: each command of `checks.project`, run in a shell from the project root with its output shown. */
export function runProjectChecks({ root, profile }, { stdio = 'inherit' } = {}) {
  const problems = []
  for (const command of profile.checks?.project ?? []) {
    const result = spawnSync(command, { cwd: root, shell: true, stdio })
    if (result.status !== 0) {
      problems.push(`the project check \`${command}\` failed`)
    }
  }
  return problems
}

/** Prints what a check found (`harness check <name>`); returns its exit code. */
export function report(name, { problems, messages }, { out, err }) {
  messages.forEach((line) => out(line))
  problems.forEach((line) => err(`harness check ${name}: ${line}`))
  return problems.length ? 1 : 0
}

/** `harness check all`: every check in order, then the project's own; the exit code is 1 when any of them found a problem. */
export function checkAll({ root, out, err, stdio }) {
  const profile = loadProfile(root)
  let failed = false
  for (const name of Object.keys(CHECKS)) {
    failed = report(name, runCheck(name, { root, profile }), { out, err }) !== 0 || failed
  }
  const projectProblems = runProjectChecks({ root, profile }, stdio ? { stdio } : undefined)
  projectProblems.forEach((line) => err(`harness check all: ${line}`))
  return failed || projectProblems.length ? 1 : 0
}
