// The usage part of the check `flows` (task 5.6): every step must fit one window of the subscription that applies, and the flows' `usage.jsonl` must hold
// valid samples. It adds to `checkFlows` (the parts, the steps and the logs) and needs the runtime adapters, so it lives beside it.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkFlows } from './flow-check.mjs'
import { USAGE_FILE, fitProblems, parseSamples, resolveSubscription, runtimeUsage } from './flow-usage.mjs'
import { readFlowsOf } from './flows.mjs'
import { LOCAL_OVERRIDE_FILE } from './reports.mjs'

/** The ignored local profile file of the machine, `{}` when it is missing or not valid. */
export function localProfile(root) {
  const path = join(root, LOCAL_OVERRIDE_FILE)
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}
  } catch {
    return {}
  }
}

/**
 * The problems of the usage of a project's flows: a step whose estimate does not fit one window (checked only where a subscription is known, from the flow's
 * setting or the local profile file, since the table of coefficients is per subscription), and a line of `usage.jsonl` that is not a valid sample.
 */
export function flowUsageProblems({ root, profile, runtimes }) {
  const read = readFlowsOf(root, profile)
  if (!read) return []
  const { usage } = runtimeUsage(profile, runtimes)
  const local = localProfile(root)
  const problems = read.flows.flatMap((flow) => {
    const { id } = resolveSubscription({ flow, local, usage })
    return id
      ? fitProblems({ flow, profile, usage, subscription: id }).map((problem) => `${read.dir}/${flow.file}: ${problem}`)
      : []
  })
  const path = join(root, read.dir, USAGE_FILE)
  if (existsSync(path))
    problems.push(
      ...parseSamples(readFileSync(path, 'utf8')).problems.map((problem) => `${read.dir}/${USAGE_FILE}: ${problem}`)
    )
  return problems
}

/** The check `flows` with the usage part: `{ problems, message }`. */
export function checkFlowsWithUsage({ root, profile, runtimes }) {
  const { problems, message } = checkFlows({ root, profile })
  return { problems: [...problems, ...flowUsageProblems({ root, profile, runtimes })], message }
}
