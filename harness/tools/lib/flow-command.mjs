// `harness flow …` (tasks 5.4 to 5.6): `check`, `status <n>`, `next <n>`, `prompt <n> <step>`, `dispatch <n> <step>`, and the usage commands `estimate`, `gate` and `sample`, the one way the procedure `run-flow` reads
// the state of a flow, the prompt of a step and how to hand it to a worker. Reading is free; only `sample` (task 5.6) writes a file, the flows' `usage.jsonl`. The seams are the Git command (`git`),
// the lock of a consuming repository (`lockOf`), the template of the prompts (`template`), the runtime adapters (`runtimes`) and the clock (`now`), so a test
// replaces them.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { planFacts } from './flow-check.mjs'
import { checkFlowsWithUsage } from './flow-usage-check.mjs'
import { dispatchStep, orchestratorContext, runtimeExecutors } from './flow-executors.mjs'
import { readPromptTemplate, renderPrompt } from './flow-prompt.mjs'
import { flowTruth, gatherFacts, logEntries } from './flow-status.mjs'
import { HOME_REPO, stepById } from './flow-steps.mjs'
import { readFlowsOf } from './flows.mjs'
import { auditCommand } from './flow-audit.mjs'
import { reportCheckCommand } from './step-report.mjs'
import { calibrateCommand, dispatchUsageLines, usageCommand } from './flow-usage-command.mjs'
import { repoRows, localRepoPaths } from './flow-repos.mjs'
import { hostModule } from './host.mjs'
import { inFramework, LOCK_FILE, readLock } from './lock.mjs'

const USAGE =
  'usage: harness flow check | status <n> [--orchestrator <percent>] | next <n> | prompt <n> <step> | dispatch <n> <step> [--context <percent>] [--orchestrator <percent>] [--account <id>] [--at <YYYY-MM-DD HH:MM>] | audit <n> [--orchestrator <id>[,<id>]] [--top <n>] [--json] | report-check <file> | calibrate [--min <n>] [--subscription <id>] | estimate <n> [--plan <name>] | gate <n> <step> [--five-hour <pct>[@<reset>]] [--weekly <pct>[@<reset>]] [--cost <usd>] [--plan <name>] | sample <n> <flow-start|step-start|step-end|flow-end> [<step>] [--plan <name>] [the reading flags] [--tokens <n>] [--model <name>] [--start cold|warm]'

const pad = (number) => String(number).padStart(2, '0')
/** The time now as the log writes it, `YYYY-MM-DD HH:MM`, local. */
export const logTime = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`

const fail = (message) => ({ lines: [message], code: 1 })

// The host's reading of another repository (the role `remote-state`): `{ readFile({ slug, path }), pullRequests({ slug, text }) }`, or null when the host offers none
function hostRemote(profile) {
  try {
    const module = hostModule(profile, 'remote-state')
    return {
      readFile: (request) => module.remoteFile(request),
      pullRequests: (request) => module.remotePullRequests(request)
    }
  } catch {
    return null
  }
}

// The facts about the external repositories of a flow, read through the host: the lock of each (`lockOf`) and the pull requests that mention a version
function remoteFacts({ root, profile, flow, remote }) {
  const external = repoRows(flow.settings).filter((row) => !row.home && row.remote)
  const api = external.length ? (remote ?? hostRemote(profile)) : null
  const remoteOf = (alias) => external.find((row) => row.alias === alias)
  return {
    lockOf: (alias) => {
      if (alias === HOME_REPO) return readLock(root)
      const row = remoteOf(alias)
      if (!row || !api) return undefined
      const file = api.readFile({ slug: row.remote, path: LOCK_FILE })
      if (file.error) return undefined
      if (!file.found) return null
      try {
        return JSON.parse(file.text)
      } catch {
        return undefined
      }
    },
    pullRequestsOf: (alias, text) => {
      const row = remoteOf(alias)
      return row && api ? api.pullRequests({ slug: row.remote, text }) : undefined
    }
  }
}

const logTextOf = (root, dir, flow) => {
  const path = join(root, dir, flow.file.replace(/\.md$/, '.log.md'))
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
}

// The flows that `flow` needs and that are not finished, by the repository's truth
function unfinishedNeeds(flow, read, facts, root) {
  return flow.needs.filter((number) => {
    const needed = read.flows.find((each) => each.number === number)
    return !needed || !flowTruth(needed, facts, logEntries(logTextOf(root, read.dir, needed))).finished
  })
}

const stepLine = (each) => {
  const shown = each.computed === null ? `${each.marked || '?'} (the repository cannot say)` : each.computed
  return `  step ${each.id} [${each.kind}] marked ${each.marked || 'empty'}, repository ${shown}: ${each.evidence}`
}

function statusLines(flow, truth, blocked) {
  const lines = [
    `Flow ${flow.number} — ${flow.title}: mode ${flow.settings.mode}, ${flow.releases.map((release) => `\`${release}\``).join(', ') || 'no release'}.`
  ]
  if (truth.claim)
    lines.push(
      `Claimed: a "running" entry of ${truth.claim} has no "stop" entry after it; another orchestrator may be running it (the procedure run-flow, step 1).`
    )
  lines.push('Steps, recomputed from the repository:', ...truth.steps.map(stepLine))
  if (truth.mismatches.length)
    lines.push('Mismatches with the State column and the log:', ...truth.mismatches.map((line) => `  - ${line}`))
  else lines.push('The State column and the log agree with the repository.')
  if (blocked.length)
    lines.push(`Waits for flow ${blocked.join(', flow ')}, which ${blocked.length > 1 ? 'are' : 'is'} not finished.`)
  else if (truth.finished) lines.push('The flow is finished: every step is done.')
  else if (truth.next)
    lines.push(
      `Next step: ${truth.next.id} [${truth.next.kind}] ${truth.next.step.scope} (state ${truth.next.state}). \`harness flow prompt ${flow.number} ${truth.next.id}\` prints its prompt.`
    )
  else lines.push('No step can run: every step left waits on one that is not done (or is held at ⏸ or ⛔).')
  return lines
}

// The groups of a dispatch that the orchestrator needs only when it follows the whole procedure, not to start the worker (`--brief`): reading the report and the
// context after the step, the usage reading and its measures, and the explanations that follow the means of starting
const BRIEF_DROPS = [
  /^Fetch its full step report/,
  /^Read its context/,
  /^Usage:/,
  /^Then `/,
  /^Measure it:/,
  /^  - (its permissions|fetch its report|read the account)/
]

/** The dispatch without the groups of `BRIEF_DROPS` (a group is a line and the indented lines under it): the step, its worker and model, how to start it, and the line to log. */
export function briefDispatch(lines) {
  const kept = []
  let dropping = false
  for (const line of lines) {
    const indented = /^\s/.test(line)
    if (!indented || BRIEF_DROPS.some((pattern) => pattern.test(line)))
      dropping = BRIEF_DROPS.some((pattern) => pattern.test(line))
    if (!dropping) kept.push(line)
  }
  return kept
}

/**
 * Runs one `harness flow` command.
 * @param {{ words: string[], flags?: object, root: string, profile: object, git?: Function, lockOf?: Function, template?: string, runtimes?: object, now?: string, remote?: object }} options
 *   `remote` is the host's reading of an external repository (`{ readFile({ slug, path }), pullRequests({ slug, text }) }`); the host adapter's by default.
 *   `flags.context` is the previous worker's context in percent of its window (dispatch), `flags.account` the account the orchestrator runs on (dispatch),
 *   `flags.at` or `now` the time it runs.
 * @returns {{ lines: string[], code: number }}
 */
export function flowCommand({ words, flags = {}, root, profile, git, lockOf, template, runtimes, now, remote }) {
  const [action, number, step] = words
  if (action === 'check' && words.length === 1) {
    const { problems, message } = checkFlowsWithUsage({ root, profile, runtimes })
    return { lines: [message, ...problems], code: problems.length ? 1 : 0 }
  }
  if (action === 'report-check') return reportCheckCommand({ words: words.slice(1) })
  if (action === 'calibrate' && words.length === 1) return calibrateCommand({ flags, root, profile, runtimes })
  if (action === 'audit' && words.length === 2 && /^\d+$/.test(number ?? ''))
    return auditCommand({ number, flags, root, profile, runtimes })
  const lengths = { status: [2], next: [2], estimate: [2], prompt: [3], dispatch: [3], gate: [3], sample: [3, 4] }
  if (!lengths[action]?.includes(words.length) || !/^\d+$/.test(number ?? '')) {
    return { lines: [USAGE], code: 2 }
  }
  const read = readFlowsOf(root, profile)
  if (!read)
    return fail('The profile file names no flows folder, or the folder has no index; there is no flow to read.')
  const flow = read.flows.find((each) => each.number === Number(number))
  if (!flow)
    return fail(
      `There is no flow ${number}; the flows are ${read.flows.map((each) => each.number).join(', ') || 'none'}.`
    )
  if (flow.problems.length)
    return fail(`${read.dir}/${flow.file}: ${flow.problems.join('; ')}; run \`harness flow check\`.`)
  const remoteSeen = remoteFacts({ root, profile, flow, remote })
  const facts = gatherFacts({
    root,
    profile,
    plan: planFacts({ root, profile }),
    git,
    lockOf: lockOf ?? remoteSeen.lockOf,
    pullRequestsOf: remoteSeen.pullRequestsOf
  })
  const repoPaths = localRepoPaths(root, flow.settings)
  const truth = flowTruth(flow, facts, logEntries(logTextOf(root, read.dir, flow)))
  const blocked = unfinishedNeeds(flow, read, facts, root)

  if (['estimate', 'gate', 'sample'].includes(action))
    return usageCommand({ action, words: words.slice(2), flow, dir: read.dir, flags, root, profile, runtimes, now })
  const orchestrator = flags.orchestrator === undefined ? null : Number(String(flags.orchestrator).replace(/%$/, ''))
  if (orchestrator !== null && !(orchestrator >= 0 && orchestrator <= 100))
    return fail('--orchestrator is a percent from 0 to 100.')
  if (action === 'status') {
    const { executors } = runtimeExecutors(profile, runtimes)
    const own = orchestratorContext({ flow, context: orchestrator, executor: executors.session })
    return { lines: [...statusLines(flow, truth, blocked), ...own.lines], code: 0 }
  }
  if (action === 'dispatch') {
    const target = stepById(flow.steps, step)
    if (!target)
      return fail(
        `Flow ${flow.number} has no step ${step}; its steps are ${flow.steps.map((each) => each.id).join(', ')}.`
      )
    const context = flags.context === undefined ? null : Number(String(flags.context).replace(/%$/, ''))
    if (context !== null && !(context >= 0 && context <= 100)) return fail('--context is a percent from 0 to 100.')
    const { lines, plan } = dispatchStep({
      flow,
      step: target,
      profile,
      runtimes,
      logText: logTextOf(root, read.dir, flow),
      context,
      account: typeof flags.account === 'string' && flags.account.trim() ? flags.account.trim() : null,
      now: flags.at ?? now ?? logTime(),
      facts,
      harness: `node ${inFramework(profile, 'tools/harness.mjs')}`,
      repoPaths,
      orchestrator
    })
    const harness = `node ${inFramework(profile, 'tools/harness.mjs')}`
    const usage = dispatchUsageLines({ flow, step: target, profile, root, runtimes, harness, warm: plan.reuse })
    const all = [...lines, ...usage]
    return { lines: flags.brief ? briefDispatch(all) : all, code: 0 }
  }
  if (action === 'next') {
    if (blocked.length)
      return {
        lines: [`Flow ${flow.number} waits for flow ${blocked.join(', flow ')}, which is not finished.`],
        code: 0
      }
    if (truth.finished) return { lines: [`Flow ${flow.number} is finished: every step is done.`], code: 0 }
    if (!truth.next) return { lines: statusLines(flow, truth, blocked).slice(-1), code: 1 }
  }
  const target = action === 'next' ? truth.next.id : step
  const { prompt, problems } = renderPrompt({
    flow,
    step: target,
    facts,
    repoPaths,
    template: template ?? readPromptTemplate(root, profile),
    values: {
      entryFile: profile.project?.entryFile,
      integration: profile.branches?.integration,
      production: profile.branches?.production
    }
  })
  if (problems.length) return { lines: problems, code: 1 }
  return {
    lines:
      action === 'next'
        ? [`Next step of flow ${flow.number}: ${target} [${truth.next.kind}], state ${truth.next.state}.`, '', prompt]
        : [prompt],
    code: 0
  }
}
