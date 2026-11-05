// The executors of a flow (task 5.5; the runtime contract, role `executors`): how the orchestrator hands a step to a worker, and whether the next step goes
// to the previous step's worker (`reuse: auto`) or to a fresh one. The runtime adapter says how its runtime starts, continues, reports and measures a worker;
// this module picks the executor of a step, decides the reuse from the flow's log, the steps and the worker's context, and renders the adapter's means as
// the lines `harness flow dispatch` prints. Pure functions; the runtime adapters, the clock and the context reading are parameters.
import { repoRow } from './flow-repos.mjs'
import { EXECUTORS, stepById } from './flow-steps.mjs'
import { ENTRY_HEADING, logHeadings } from './flow-check.mjs'
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
/** The optional executor operation that says in one line what a worker will be allowed to do under the flow's `permissions` setting (a text, not means). */
export const PERMISSIONS_OPERATION = 'permissions'
/** The limits of `reuse: auto` when the flow's `reuseLimits` leaves one out: the worker's context in percent of its window, and the steps it has run. */
export const REUSE_LIMITS = Object.freeze({ context: 40, steps: 3 })

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

/**
 * The executor of a step: its own override, else the flow's setting; `manual` with a note when the runtime does not offer the one named.
 * @returns {{ kind: string, executor: object, source: string, note: string | null }}
 */
export function pickExecutor(flow, step, executors) {
  const named = step.executor ?? flow.settings.executor ?? 'session'
  const source = step.executor ? "the step's own" : "the flow's setting"
  if (executors[named]) return { kind: named, executor: executors[named], source, note: null }
  return {
    kind: 'manual',
    executor: executors.manual,
    source,
    note: EXECUTORS.includes(named)
      ? `the runtime offers no ${named} executor, so the step goes to the manual one (a D0 decision to log)`
      : `"${named}" is no executor (${EXECUTORS.join(', ')}); the step goes to the manual one`
  }
}

// The bullet lines of a log entry, from its heading to the next heading
function entryBody(logText, heading) {
  const lines = logText.split('\n')
  const start = lines.indexOf(heading)
  if (start < 0) return ''
  const end = lines.findIndex((line, index) => index > start && line.startsWith('### '))
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n')
}

const field = (body, name) => body.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*([^·\\n]+)`))?.[1]?.trim() ?? null
// A field that names something, or null for a dash or a placeholder of the template
const named = (value) => (value && !/^[<—–-]/.test(value) ? value : null)

/**
 * The entries of a log with what a "step started" entry says of its worker: `{ kind, step, at, executor, reusedFrom, worker, account, model }`.
 * The executor line reads `- **Executor:** session, reused from step 3 · **Worker:** <id> · **Account:** <account> · **Model:** <model> · **Estimate:** …`
 * (the flow-log template); a log written before the account was recorded has no `Account` field, and its account is null.
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
    const executor = field(body, 'Executor')
    return [
      {
        ...entry,
        executor: executor?.match(/^(session|subagent|manual)\b/)?.[1] ?? null,
        reusedFrom: executor?.match(/reused from step (\d+[a-z]?)/)?.[1] ?? null,
        worker: named(field(body, 'Worker')),
        account: named(field(body, 'Account')),
        model: field(body, 'Model')
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
  repoPaths = {}
}) {
  const { runtime, executors } = runtimeExecutors(profile, runtimes)
  const row = repoRow(flow.settings, step.repo)
  // An external repository's worker starts in that repository's folder on this machine; without the folder only the owner can start it there
  const missingPath = row && !row.home && repoPaths[step.repo] === undefined
  const picked = missingPath
    ? {
        kind: 'manual',
        executor: executors.manual,
        source: 'the missing folder',
        note: `the folder of the repository "${step.repo}" on this machine is not set (\`repos.${step.repo}\` in harness-profile.local.json), so no worker can be started there, and the step goes to the manual one (a D0 decision to log)`
      }
    : pickExecutor(flow, step, executors)
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
  const permissions = flow.settings.permissions
  const startFresh = (text) => {
    const split = splitModel(text)
    return picked.executor.start({
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
  const logLine = (executorText, workerText, modelText) =>
    `- **Executor:** ${executorText} · **Worker:** ${workerText} · **Account:** ${account ?? '—'} · **Model:** ${modelText ?? '—'} · **Estimate:** ${step.sp || '—'} SP, ${step.usage || '—'}`
  const lines = [
    `Step ${step.id} of flow ${flow.number} [${step.kind}]: the ${picked.kind} executor (${picked.source}) of ${runtime ? `the runtime ${runtime}` : 'the framework (no runtime adapter offers executors)'}: ${picked.executor.means}.`,
    ...(picked.note ? [`Note: ${picked.note}.`] : []),
    `Model: ${model ?? "the orchestrator's choice (the Model column is a dash)"}.`,
    decision.reuse
      ? `Worker: continue ${worker.id}, the worker of step ${worker.step} (warm: ${decision.reasons.join('; ')}).`
      : `Worker: a fresh one${worker ? ` (not ${worker.id}: ${decision.reasons.join('; ')})` : ` (${decision.reasons.join('; ')})`}.`,
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
          `  - then log: ${logLine(picked.kind, '<the id the start returns>', fallbackModel)}`
        ]
      : []),
    'Fetch its full step report when it ends (a notice may be cut short):',
    ...render(picked.executor.report({ worker: id })),
    "Read its context after the step, for the next step's reuse (`--context <percent>`):",
    ...(reading.length ? render(reading) : ['  - not readable: the next step starts a fresh worker']),
    `Log "step ${step.id} started" with: ${logLine(`${picked.kind}${decision.reuse ? `, reused from step ${worker.step}` : ''}`, id, model)}`
  ]
  return { lines, plan: { kind: picked.kind, reuse: decision.reuse, worker: decision.reuse ? worker.id : null, model } }
}
