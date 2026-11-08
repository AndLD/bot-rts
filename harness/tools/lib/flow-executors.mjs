// The executors of a flow (task 5.5; the runtime contract, role `executors`): how the orchestrator hands a step to a worker, and whether the next step goes
// to the previous step's worker (`reuse: auto`) or to a fresh one. The runtime adapter says how its runtime starts, continues, reports and measures a worker;
// this module picks the executor of a step, decides the reuse from the flow's log, the steps and the worker's context, and renders the adapter's means as
// the lines `harness flow dispatch` prints. Pure functions; the runtime adapters, the clock and the context reading are parameters.
import { repoRow } from './flow-repos.mjs'
import {
  EXECUTORS,
  EXECUTOR_ORDER,
  executorField,
  plannedExecutor,
  readExecutorField,
  stepById
} from './flow-steps.mjs'
import { ENTRY_HEADING, entryBody, entryField, logHeadings } from './flow-check.mjs'
import { releaseIds } from './flow-status.mjs'

/** The slot an adapter's means carry where the prompt goes; `renderMeans` replaces it with the command that prints the prompt. */
export const PROMPT_SLOT = '<prompt>'
/** The operations every executor offers (the runtime contract); a list of means each, empty when the runtime cannot do it. */
export const OPERATIONS = Object.freeze(['start', 'continue', 'report', 'context'])
/**
 * The operation an executor may leave out: `account()` reads the account the orchestrator runs on, which is the account of a worker it starts; without it,
 * the reuse rule does not compare accounts.
 */
export const OPTIONAL_OPERATIONS = Object.freeze(['account'])
/** What the workers of a flow may do (issue I-27): the flow's own `permissions` setting, else the project's default (the profile role `flows.permissions`), else nothing set. */
export const workerPermissions = (flow, profile) => flow.settings.permissions ?? profile?.flows?.permissions

/** The optional executor operation that says in one line what a worker will be allowed to do under the flow's `permissions` setting (a text, not means). */
export const PERMISSIONS_OPERATION = 'permissions'
/** The limits of `reuse: auto` when the flow's `reuseLimits` leaves one out: the worker's context in percent of its window, and the steps it has run. */
export const REUSE_LIMITS = Object.freeze({ context: 40, steps: 3 })
/** The limit of the orchestrator's own context when the flow's `orchestratorLimits` leaves it out: percent of its window, at which it hands the flow over (task 6.5). */
export const ORCHESTRATOR_LIMITS = Object.freeze({ context: 50 })

/**
 * The manual executor of the framework: what a runtime without automation offers, and what a project with no runtime adapter gets. The owner pastes the
 * prompt into a session of their own and pastes back the report.
 */
export const MANUAL_EXECUTOR = Object.freeze({
  means: 'the owner pastes the prompt into a session of their own and pastes back its full step report',
  wakeups: false,
  cacheMinutes: 0,
  start: () => [
    {
      via: 'the owner',
      owner: "Give the owner the prompt to paste into a new session in the step's repository, and wait for the report."
    }
  ],
  continue: () => [
    {
      via: 'the owner',
      owner: 'Give the owner the prompt to paste into the session that ran the previous step, and wait for the report.'
    }
  ],
  report: () => [{ via: 'the owner', owner: 'Ask the owner to paste the whole step report, not a summary.' }],
  context: () => [],
  account: () => []
})

/** `Sonnet 5.5 at high effort` as `{ model: 'Sonnet 5.5', effort: 'high' }`; a text without "at … effort" is all model. Null for no text. */
export function splitModel(text) {
  const value = (text ?? '').trim()
  if (!value) return null
  const found = value.match(/^(.*?)\s+at\s+([\w-]+)\s+effort$/i)
  return found ? { model: found[1].trim(), effort: found[2].toLowerCase() } : { model: value, effort: null }
}

const NONE = /^(?:—|-|–)?$/

/**
 * The model of a step as text: its Model cell, a complexity marker read through `plan.complexity.models` of the profile, or null when the cell is a dash
 * (the orchestrator's own choice). `marker` is the marker the cell names, if any.
 */
export function stepModel(step, profile) {
  const cell = (step.model ?? '').trim()
  if (NONE.test(cell)) return { text: null, marker: null }
  const models = profile?.plan?.complexity?.models ?? {}
  return models[cell] ? { text: models[cell], marker: cell } : { text: cell, marker: null }
}

const sameModel = (a, b) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()

/**
 * The executors that the selected runtimes offer: the first runtime of `adapters.runtimes` whose adapter fills the role `executors`, with the manual executor
 * of the framework where it offers none. `runtimes` is the registry of loaded runtime adapters (`{ name: { manifest, modules } }`).
 * @returns {{ runtime: string | null, executors: Record<string, object> }}
 */
export function runtimeExecutors(profile, runtimes) {
  for (const name of profile?.adapters?.runtimes ?? []) {
    const adapter = runtimes?.[name]
    const entry = adapter?.manifest?.roles?.executors
    const make = entry && adapter.modules?.[entry.module]?.[entry.export]
    if (typeof make === 'function') {
      const offered = make(profile) ?? {}
      return { runtime: name, executors: { manual: MANUAL_EXECUTOR, ...offered } }
    }
  }
  return { runtime: null, executors: { manual: MANUAL_EXECUTOR } }
}

/** The executor after `kind` in the order of the executors that the runtime offers (`cli` after `session`, `manual` last), or null. */
export function nextInOrder(kind, executors) {
  const at = EXECUTOR_ORDER.indexOf(kind)
  if (at < 0) return null
  return EXECUTOR_ORDER.slice(at + 1).find((each) => executors[each]) ?? null
}

/**
 * The reason a step in another repository goes to the command line (task 2.7, decided by the owner on 2026-11-05): a session started there cannot be
 * counted on without the owner's message, and a flow in seamless mode would wait for one.
 */
export const EXTERNAL_REASON =
  "a step in another repository runs on the command line, since a session cannot be counted on to start there without the owner's message"

/**
 * The executor of a step: its own override, else the flow's setting, else `session`. One the runtime does not offer goes to the next in the order that it
 * offers (`session`, `cli`, `manual`), a subagent to the manual one; `reason` then says why, for the log line of the fallback.
 * @returns {{ kind: string, executor: object, source: string, planned: string, note: string | null, reason: string | null }}
 */
export function pickExecutor(flow, step, executors) {
  const named = plannedExecutor(flow, step)
  const source = step.executor ? "the step's own" : "the flow's setting"
  if (executors[named])
    return { kind: named, executor: executors[named], source, planned: named, note: null, reason: null }
  const kind = nextInOrder(named, executors) ?? 'manual'
  const reason = EXECUTORS.includes(named)
    ? `the runtime offers no ${named} executor`
    : `"${named}" is no executor (${EXECUTORS.join(', ')})`
  return {
    kind,
    executor: executors[kind],
    source,
    planned: named,
    note: `${reason}, so the step goes to the ${kind} one (a D0 decision to log)`,
    reason
  }
}
// A field that names something, or null for a dash or a placeholder of the template
const named = (value) => (value && !/^[<—–-]/.test(value) ? value : null)

/**
 * The entries of a log with what a "step started" entry says of its worker: `{ kind, step, at, executor, reusedFrom, fallbackOf, reason, worker, account,
 * model }`. The executor line reads `- **Executor:** session, reused from step 3 · **Worker:** <id> · **Account:** <account> · **Model:** <model> ·
 * **Estimate:** …`, or `cli, the fallback of session: <reason> · …` for a worker on the next executor of the order (the flow-log template); a log written
 * before the account was recorded has no `Account` field, and its account is null.
 */
export function workerEntries(logText) {
  const text = logText ?? ''
  return logHeadings(text).flatMap((heading) => {
    const found = heading.match(ENTRY_HEADING)
    if (!found) return []
    const what = found[3]
    const kind = what.startsWith('step') ? (what.includes(' started') ? 'started' : 'ended') : what.split(/[ :]/)[0]
    const entry = { kind, step: found[4] ?? found[5] ?? null, at: `${found[1]} ${found[2]}` }
    if (kind !== 'started') return [entry]
    const body = entryBody(text, heading)
    return [
      {
        ...entry,
        ...readExecutorField(entryField(body, 'Executor')),
        worker: named(entryField(body, 'Worker')),
        account: named(entryField(body, 'Account')),
        model: entryField(body, 'Model')
      }
    ]
  })
}

/**
 * The previous worker, from the log: the newest "step started" entry of another step than `stepId` that names a worker, with the steps that worker has run
 * (the started entries of the same worker), the time of its last turn (the end of its newest step, else its start), and whether a stop or a decision for the
 * owner came after it (the flow waited for the owner or for a usage reset, so the prompt cache cannot be counted on). Null when there is none.
 */
export function previousWorker(logText, stepId) {
  const entries = workerEntries(logText)
  // A step the orchestrator ran itself (a cut at its own level) names no worker and does not end the previous worker's line
  const index = entries.findLastIndex((entry) => entry.kind === 'started' && entry.step !== stepId && entry.worker)
  if (index < 0) return null
  const last = entries[index]
  const ran = entries
    .filter((entry) => entry.kind === 'started' && entry.worker === last.worker)
    .map((entry) => entry.step)
  const after = entries.slice(index + 1)
  const ended = after.find((entry) => entry.kind === 'ended' && entry.step === last.step)
  return {
    id: last.worker,
    kind: last.executor,
    step: last.step,
    account: last.account,
    model: last.model,
    steps: [...new Set(ran)],
    lastAt: ended?.at ?? last.at,
    paused: after.some((entry) => entry.kind === 'stop')
  }
}

// Minutes between two times of the log (`YYYY-MM-DD HH:MM`), read alike
const minutesBetween = (from, to) =>
  (Date.parse(`${to.replace(' ', 'T')}:00Z`) - Date.parse(`${from.replace(' ', 'T')}:00Z`)) / 60000

// Whether two steps are related: the next needs the previous, they name the same release, or their ids lie in one release of the releases file
function related(previous, next, facts) {
  if (next.needs.includes(previous.id)) return 'the step needs the previous one'
  const shared = next.versions.find((version) => previous.versions.includes(version))
  if (shared) return `both are steps of \`${shared}\``
  for (const row of facts?.releaseRows ?? []) {
    const version = row.release.replace(/`/g, '')
    const ids = new Set(releaseIds(version, facts))
    const holds = (step) => step.ids.some((id) => ids.has(id)) || step.versions.includes(version)
    if (holds(previous) && holds(next)) return `both build \`${version}\``
  }
  return null
}

// The rank of a complexity marker in the scale of the profile (C1 below C2), or null
const rankOf = (marker, profile) => {
  const scale = Object.keys(profile?.plan?.complexity?.scale ?? {})
  const rank = scale.indexOf(marker ?? '')
  return rank < 0 ? null : rank
}

/**
 * Whether `step` goes to the previous step's worker (`reuse: auto`). Every condition must hold: the setting is `auto`; there is a previous worker of the same
 * executor, which can continue a worker and read its context; the same repository, model and effort; related steps (the same release, or the next needs the
 * previous); the worker's context below `reuseLimits.context` percent of its window; no stop for the owner or a usage reset since its last turn, and no longer
 * pause than the executor's prompt cache lives; fewer steps run than `reuseLimits.steps`; and the same account, when both the worker's (from the log) and the
 * orchestrator's are known: another account cannot find the worker, and its prompt cache is another. A smaller step (a lower complexity marker) after a related
 * bigger one, or a step whose Model is a dash, keeps the worker's model: `keptModel` says so, a D0 decision to log.
 * @param {{ flow: object, step: object, executor: object, kind: string, worker: object | null, context: number | null, account?: string | null, now: string, profile: object, facts?: object }} input
 *   `context` is the worker's context in percent of its window, as the executor's `context` means read it (null: not read); `account` the account the
 *   orchestrator runs on, as the executor's `account` means read it (null: not read); `now` is `YYYY-MM-DD HH:MM`.
 * @returns {{ reuse: boolean, reasons: string[], keptModel: string | null }} the reasons why not, or why it is warm.
 */
export function decideReuse({ flow, step, executor, kind, worker, context, account = null, now, profile, facts }) {
  const settings = flow.settings
  const limits = { ...REUSE_LIMITS, ...(settings.reuseLimits ?? {}) }
  const cacheMinutes = limits.cacheMinutes ?? executor.cacheMinutes ?? 0
  const no = (...reasons) => ({ reuse: false, reasons, keptModel: null })
  if (settings.reuse !== 'auto') return no(`the flow's setting reuse is "${settings.reuse}"`)
  if (!worker) return no('no previous worker is named in the log')
  if (worker.kind !== kind)
    return no(`the previous worker is a ${worker.kind ?? 'unknown'} one, this step goes to a ${kind} one`)
  if (!(executor.continue?.({ worker: worker.id, prompt: PROMPT_SLOT }) ?? []).length)
    return no(`the ${kind} executor cannot continue a worker`)
  if (!(executor.context?.({ worker: worker.id }) ?? []).length)
    return no(`the ${kind} executor cannot read a worker's context`)

  const previous = stepById(flow.steps, worker.step)
  const failed = []
  const warm = []
  if (!previous) failed.push(`the log names step ${worker.step}, which the flow does not have`)
  else {
    if (previous.repo !== step.repo) failed.push(`another repository (${previous.repo}, then ${step.repo})`)
    else warm.push('the same repository')
    if (worker.account && account) {
      if (worker.account !== account) failed.push(`another account (${worker.account}, then ${account})`)
      else warm.push('the same account')
    }
    const why = related(previous, step, facts)
    if (why) warm.push(why)
    else failed.push('the steps are not related (no shared release, and the step does not need the previous one)')
  }
  let keptModel = null
  const wanted = stepModel(step, profile)
  const had = previous ? stepModel(previous, profile) : { text: worker.model, marker: null }
  const running = worker.model ?? had.text
  if (sameModel(wanted.text, running)) warm.push('the same model and effort')
  else if (wanted.text === null && running) {
    keptModel = running
    warm.push(`the step leaves the model to the orchestrator, so it keeps the worker's, ${running}`)
  } else {
    const smaller = rankOf(wanted.marker, profile)
    const bigger = rankOf(had.marker, profile)
    if (smaller !== null && bigger !== null && smaller < bigger && sameModel(had.text, running)) {
      keptModel = running
      warm.push(`a smaller step keeps the bigger step's model, ${running}`)
    } else
      failed.push(
        `another model or effort (${running ?? 'unknown'}, then ${wanted.text ?? "the orchestrator's choice"})`
      )
  }
  if (context === null || context === undefined || Number.isNaN(Number(context)))
    failed.push("the worker's context was not read")
  else if (Number(context) >= limits.context)
    failed.push(`the worker's context is ${context}% of its window, not below ${limits.context}%`)
  else warm.push(`its context is ${context}% of its window`)
  if (worker.paused) failed.push('the flow stopped for the owner or a usage reset since its last turn')
  const idle = minutesBetween(worker.lastAt, now)
  if (!(idle <= cacheMinutes))
    failed.push(
      `its last turn was ${Number.isFinite(idle) ? `${idle} minutes` : 'an unknown time'} ago, past the ${cacheMinutes} minutes its prompt cache lives`
    )
  else warm.push(`its last turn was ${idle} minutes ago, inside the ${cacheMinutes} minutes of its prompt cache`)
  if (worker.steps.length >= limits.steps)
    failed.push(`it has run ${worker.steps.length} steps, the limit is ${limits.steps}`)
  else warm.push(`it has run ${worker.steps.length} of ${limits.steps} steps`)
  return failed.length ? no(...failed) : { reuse: true, reasons: warm, keptModel }
}

/**
 * The orchestrator's own context against its limit (`orchestratorLimits.context` of the flow, task 6.5), as the lines `harness flow status` and `dispatch` print.
 * `state` is `below`, `at` (at or above the limit: hand the flow over), `unread` (the runtime can read it, nobody did) or `unreadable` (the runtime has no means).
 * @param {{ flow: object, context: number | null, executor: object }} input `context` is the orchestrator's context in percent of its window, or null
 * @returns {{ state: string, limit: number, lines: string[] }}
 */
export function orchestratorContext({ flow, context, executor }) {
  const limit = { ...ORCHESTRATOR_LIMITS, ...(flow.settings.orchestratorLimits ?? {}) }.context
  const means = executor?.context?.({ worker: '<your own session id>' }) ?? []
  if (context === null || context === undefined || Number.isNaN(Number(context))) {
    if (!means.length)
      return {
        state: 'unreadable',
        limit,
        lines: [
          `Orchestrator context: the runtime cannot read it; hand the flow over by your own judgment, as near ${limit}% of your window as you can tell (the procedure run-flow, step 9).`
        ]
      }
    return {
      state: 'unread',
      limit,
      lines: [
        `Orchestrator context: not read (limit ${limit}% of its window). Read your own and run this again with \`--orchestrator <percent>\`:`,
        ...means.map((each) => `  - ${renderMeans(each, '')}`)
      ]
    }
  }
  if (Number(context) < limit)
    return {
      state: 'below',
      limit,
      lines: [`Orchestrator context: ${context}% of its window, below its limit of ${limit}%.`]
    }
  return {
    state: 'at',
    limit,
    lines: [
      `Orchestrator context: ${context}% of its window, at or above its limit of ${limit}%: write a handoff entry in the log (the log template) and continue in a new orchestrator session (the executor order; the new session reads the flow file, the tail of the log and the current report, nothing older) before you start another step.`
    ]
  }
}

/**
 * Whether the next step can start inside the prompt cache of the previous worker (task 6.5): one line, from that worker's last turn in the log, the cache
 * the executor's prompt cache lives (or the flow's `reuseLimits.cacheMinutes`) and the time now; empty when the log names no previous worker.
 * @returns {string[]}
 */
export function cachePacing({ flow, executor, worker, now }) {
  if (!worker?.lastAt) return []
  const cacheMinutes = flow.settings.reuseLimits?.cacheMinutes ?? executor.cacheMinutes ?? 0
  const idle = minutesBetween(worker.lastAt, now)
  if (!Number.isFinite(idle)) return []
  if (idle <= cacheMinutes)
    return [
      `Cache: the previous worker's last turn was ${idle} minutes ago, so its prompt cache lives ${Math.max(0, cacheMinutes - idle)} more minutes: a continue started inside them is warm; a wait past them makes the start cold (log it with \`--start cold\`).`
    ]
  return [
    `Cache: the previous worker's last turn was ${idle} minutes ago, past the ${cacheMinutes} minutes its prompt cache lives: this start is cold whatever worker runs it; log it with \`--start cold\`.`
  ]
}

const shellWord = (word) => (/^[\w@%+=:,./-]+$/.test(word) ? word : `'${word.replace(/'/g, `'\\''`)}'`)

/**
 * One means of an executor as a line for the orchestrator. The prompt slot becomes the command that prints the prompt (`promptCommand`): in a shell
 * command a substitution, in a tool's input a pointer to its text.
 */
export function renderMeans(means, promptCommand) {
  const reads = means.reads ? ` — ${means.reads}` : ''
  if (means.owner) return `${means.via}: ${means.owner}`
  if (means.from) return `${means.via}: ${means.from}`
  if (means.command) {
    const words = means.command.map((word) => (word === PROMPT_SLOT ? `"$(${promptCommand})"` : shellWord(word)))
    return `${means.via}: run \`${words.join(' ')}\`${reads}`
  }
  const input = JSON.stringify(means.input ?? {}, (key, value) =>
    value === PROMPT_SLOT ? `<the text that \`${promptCommand}\` prints>` : value
  )
  return `${means.via}: call ${means.tool} ${input}${reads}`
}

/**
 * The executor of a step with its repository: in the home repository `pickExecutor`. In an external one the worker starts in that repository's folder on
 * this machine, so without the folder only the owner can start it (the manual executor); with it, a step planned for a session goes to the command line
 * (`cli`) when the runtime offers it, logged as the fallback of the session with `EXTERNAL_REASON`, and a step's own override is kept.
 */
export function pickStepExecutor({ flow, step, executors, repoPaths = {} }) {
  const row = repoRow(flow.settings, step.repo)
  if (!row || row.home) return pickExecutor(flow, step, executors)
  const planned = plannedExecutor(flow, step)
  if (repoPaths[step.repo] === undefined) {
    const reason = `the folder of the repository "${step.repo}" on this machine is not set (\`repos.${step.repo}\` in harness-profile.local.json)`
    return {
      kind: 'manual',
      executor: executors.manual,
      source: 'the missing folder',
      planned,
      reason,
      note: `${reason}, so no worker can be started there, and the step goes to the manual one (a D0 decision to log)`
    }
  }
  if (!step.executor && planned === 'session' && executors.cli) {
    return {
      kind: 'cli',
      executor: executors.cli,
      source: 'the order of the executors for another repository',
      planned,
      reason: EXTERNAL_REASON,
      note: `${EXTERNAL_REASON} (the owner's decision of 2026-11-05); the log names it the fallback of session with this reason`
    }
  }
  return pickExecutor(flow, step, executors)
}

/**
 * The dispatch of a step: which executor, a fresh or the previous worker and why, the means to start or continue it (and, when it continues one, the fresh
 * start to fall back on if the continue fails), fetch its full report and read its context, and the line its "step started" log entry carries.
 * @returns {{ lines: string[], plan: { kind: string, reuse: boolean, worker: string | null, model: string | null } }}
 */
export function dispatchStep({
  flow,
  step,
  profile,
  runtimes,
  logText,
  context = null,
  account = null,
  now,
  facts,
  harness,
  repoPaths = {},
  orchestrator = null
}) {
  const { runtime, executors } = runtimeExecutors(profile, runtimes)
  const picked = pickStepExecutor({ flow, step, executors, repoPaths })
  const worker = previousWorker(logText, step.id)
  const decision = decideReuse({
    flow,
    step,
    executor: picked.executor,
    kind: picked.kind,
    worker,
    context,
    account,
    now,
    profile,
    facts
  })
  const model = decision.keptModel ?? stepModel(step, profile).text
  const parts = splitModel(model)
  const fallbackModel = stepModel(step, profile).text
  const promptCommand = `${harness} flow prompt ${flow.number} ${step.id}`
  const repo = repoPaths[step.repo] ?? '.'
  const name = `flow-${flow.number}-step-${step.id}`
  const permissions = workerPermissions(flow, profile)
  const startFresh = (text, executor = picked.executor) => {
    const split = splitModel(text)
    return executor.start({
      prompt: PROMPT_SLOT,
      model: split?.model ?? null,
      effort: split?.effort ?? null,
      cwd: repo,
      name,
      permissions
    })
  }
  const start = decision.reuse
    ? picked.executor.continue({
        worker: worker.id,
        prompt: PROMPT_SLOT,
        model: parts?.model ?? null,
        effort: parts?.effort ?? null,
        cwd: repo,
        permissions
      })
    : startFresh(model)
  const permissionsLine = picked.executor.permissions?.({ permissions })
  const id = decision.reuse ? worker.id : '<the id the start returns>'
  const reading = picked.executor.context({ worker: id })
  const accountMeans = picked.executor.account?.() ?? []
  const render = (list) => list.map((means) => `  - ${renderMeans(means, promptCommand)}`)
  // The permission mode the worker starts in is the flow's setting (task 2.11), logged beside the model when the flow sets one
  const modeField = permissions?.mode ? ` · **Permissions:** ${permissions.mode}` : ''
  const logLine = (executorText, workerText, modelText, accountText = account ?? '—') =>
    `- **Executor:** ${executorText} · **Worker:** ${workerText} · **Account:** ${accountText} · **Model:** ${modelText ?? '—'}${modeField} · **Estimate:** ${step.sp || '—'} SP, ${step.usage || '—'}`
  const field = (reusedFrom = null) =>
    executorField({ kind: picked.kind, planned: picked.planned, reason: picked.reason, reusedFrom })
  // The next executor of the order, for this step only, when the start of this one is refused or fails
  const next = nextInOrder(picked.kind, executors)
  const failed = `<why the ${picked.kind} start failed>`
  const nextPermissions = next && executors[next].permissions?.({ permissions })
  // A worker of the next executor may run on another account than the orchestrator's (a command line signs in by its own folder), so its line reads its own
  const nextAccount = (next && executors[next].account?.()) ?? []
  const fallback = next
    ? [
        `If the ${picked.kind} start is refused or fails, do not retry it and do not wait: the fallback for this step only is the ${next} executor (the order of the executors; the next step is dispatched again and goes back to ${picked.planned}). Log a decision D0 "step ${step.id}: ${failed}, so the ${next} executor runs it", and start it:`,
        ...render(startFresh(fallbackModel, executors[next])),
        ...(nextPermissions ? [`  - its permissions: ${nextPermissions}`] : []),
        `  - fetch its report: ${executors[next]
          .report({ worker: '<its id>' })
          .map((means) => renderMeans(means, promptCommand))
          .join('; ')}`,
        ...(nextAccount.length
          ? [
              `  - read the account it runs on: ${nextAccount.map((means) => renderMeans(means, promptCommand)).join('; ')}`
            ]
          : []),
        `  - then log: ${logLine(
          executorField({ kind: next, planned: picked.planned, reason: failed }),
          '<the id the start returns>',
          fallbackModel,
          nextAccount.length ? '<the account it runs on>' : (account ?? '—')
        )}`
      ]
    : []
  const lines = [
    `Step ${step.id} of flow ${flow.number} [${step.kind}]: the ${picked.kind} executor (${picked.source}) of ${runtime ? `the runtime ${runtime}` : 'the framework (no runtime adapter offers executors)'}: ${picked.executor.means}.`,
    ...(picked.note ? [`Note: ${picked.note}.`] : []),
    `Model: ${model ?? "the orchestrator's choice (the Model column is a dash)"}.`,
    decision.reuse
      ? `Worker: continue ${worker.id}, the worker of step ${worker.step} (warm: ${decision.reasons.join('; ')}).`
      : `Worker: a fresh one${worker ? ` (not ${worker.id}: ${decision.reasons.join('; ')})` : ` (${decision.reasons.join('; ')})`}.`,
    ...cachePacing({ flow, executor: picked.executor, worker, now }),
    ...orchestratorContext({ flow, context: orchestrator, executor: executors.session ?? picked.executor }).lines,
    ...(decision.keptModel
      ? [
          `Decision D0 to log: step ${step.id} keeps the model of step ${worker.step}, ${decision.keptModel}, to stay warm.`
        ]
      : []),
    ...(account
      ? [`Account: ${account}.`]
      : accountMeans.length
        ? [
            "Account: not read, so the reuse rule did not compare accounts. Read the orchestrator's account and dispatch again with `--account <id>`:",
            ...render(accountMeans)
          ]
        : []),
    ...(permissionsLine ? [`Permissions: ${permissionsLine}.`] : []),
    `${decision.reuse ? 'Continue' : 'Start'} it:`,
    ...render(start),
    ...(decision.reuse
      ? [
          `If the continue fails for any reason (the runtime cannot find ${worker.id}, as from another account, or the call errs), do not retry it: start a fresh worker instead, log the step with the line below for a fresh worker, and log a decision D0 "step ${step.id}: ${worker.id} could not be continued, a fresh worker runs it":`,
          ...render(startFresh(fallbackModel)),
          `  - then log: ${logLine(field(), '<the id the start returns>', fallbackModel)}`
        ]
      : []),
    ...fallback,
    'Fetch its full step report when it ends (a notice may be cut short):',
    ...render(picked.executor.report({ worker: id })),
    "Read its context after the step, for the next step's reuse (`--context <percent>`):",
    ...(reading.length ? render(reading) : ['  - not readable: the next step starts a fresh worker']),
    `Log "step ${step.id} started" with: ${logLine(field(decision.reuse ? worker.step : null), id, model)}`
  ]
  return {
    lines,
    plan: {
      kind: picked.kind,
      planned: picked.planned,
      fallback: next,
      reuse: decision.reuse,
      worker: decision.reuse ? worker.id : null,
      model
    }
  }
}
