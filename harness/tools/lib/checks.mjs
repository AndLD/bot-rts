// The checks of `harness check <name>` and `harness check all` (design §7.1), each as `({ root, profile }) → { problems, messages }`. `check all`
// runs them in the order below and then the project's own checks (`checks.project` of the profile file: commands), so the procedures and the
// definition of done cite one command.
import { spawnSync } from 'node:child_process'
import { checkChangelog } from './changelog.mjs'
import { checkCore } from './core-scan.mjs'
import { checkLayers } from './layers.mjs'
import { checkLinks } from './links.mjs'
import { checkPaths } from './paths.mjs'
import { planSummary } from './plan.mjs'
import { checkProductKnowledge } from './product-knowledge.mjs'
import { checkProfile } from './profile.mjs'
import { checkVendored } from './vendor.mjs'

const single = ({ problems, message }) => ({ problems, messages: [message] })

export const CHECKS = {
  vendored: ({ root }) => {
    const { problems, notes } = checkVendored({ root })
    const done = 'Checked the vendored framework, the managed files and the profile file against harness.lock.json.'
    return { problems, messages: [...notes, ...(problems.length ? [] : [done])] }
  },
  profile: ({ root }) => ({ problems: checkProfile(root), messages: ['Checked the profile file against the schema.'] }),
  layers: ({ root, profile }) =>
    profile.layers
      ? {
          problems: checkLayers({ root, profile }),
          messages: ['Checked that every file of the layer map is in exactly one layer.']
        }
      : { problems: [], messages: ['The profile file has no `layers` role, so there is no layer map to check.'] },
  links: ({ root }) => {
    const { problems, count } = checkLinks({ root })
    return { problems, messages: [`Checked links in ${count} Markdown files.`] }
  },
  paths: (context) => single(checkPaths(context)),
  core: (context) => single(checkCore(context)),
  plan: (context) => single(planSummary({ ...context, check: true })),
  changelog: (context) => single(checkChangelog(context)),
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
