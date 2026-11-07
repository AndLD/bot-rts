// The usage of a flow (task 5.6; the runtime contract, role `usage`): what a step is expected to cost in percent of the account's windows (or in money, on an API
// key), whether the next step may start now given the use the account reports, and the samples a flow appends to `usage.jsonl` so the estimate can be measured
// (task 5.7 calibrates it from them). Pure functions on texts and numbers; the runtime adapter's table, the clock and the file are parameters.
import { stepModel } from './flow-executors.mjs'

export const USAGE_FILE = 'usage.jsonl'
/** What the gate multiplies an estimate by when the flow's `usage.safetyFactor` is left out: an estimate is a guess, and a step that runs over its estimate must still fit. */
export const SAFETY_FACTOR = 1.2
/** The longest a gate waits for a window to reset when the flow's `usage.maxWaitMinutes` is left out: the 5-hour window, so it waits for that one and stops for the weekly one. */
export const MAX_WAIT_MINUTES = 300
/** The windows of an account on a subscription, as the settings name them (`usage.stopAt`). */
export const WINDOWS = Object.freeze([
  { id: 'fiveHour', label: '5-hour' },
  { id: 'weekly', label: 'weekly' }
])
export const SAMPLE_EVENTS = Object.freeze(['flow-start', 'step-start', 'step-end', 'flow-end'])
export const START_KINDS = Object.freeze(['cold', 'warm'])

/**
 * The usage the framework stands in with for a runtime that fills no `usage` role (and for a project with no runtime adapter): it cannot read the account and
 * has no coefficients, so the owner is asked for the use and the gate checks the current use only.
 */
export const MANUAL_USAGE = Object.freeze({
  means: 'the owner reads the use of the account (the usage page of their agent) and tells it',
  read: () => [
    {
      via: 'the owner',
      owner:
        'Ask the owner for the use of the account: the percent of each window with its reset time (or the money spent on an API key).'
    }
  ],
  plans: {},
  subscriptions: {},
  defaultModel: null
})

/**
 * The usage the selected runtimes offer: the first runtime of `adapters.runtimes` whose adapter fills the role `usage`, else the manual one of the framework.
 * @returns {{ runtime: string | null, usage: object }}
 */
export function runtimeUsage(profile, runtimes) {
  for (const name of profile?.adapters?.runtimes ?? []) {
    const adapter = runtimes?.[name]
    const entry = adapter?.manifest?.roles?.usage
    const make = entry && adapter.modules?.[entry.module]?.[entry.export]
    if (typeof make === 'function') return { runtime: name, usage: { ...MANUAL_USAGE, ...(make(profile) ?? {}) } }
  }
  return { runtime: null, usage: MANUAL_USAGE }
}

/** The problems of what the role `usage` returns; the conformance check and the tests of the presets share it. */
export function usageProblems(usage) {
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return ['usageFor returns no object']
  const problems = []
  if (typeof usage.means !== 'string' || !usage.means.trim()) problems.push('usage has no `means` text')
  if (typeof usage.read !== 'function') problems.push('usage has no `read()` operation')
  else if (!Array.isArray(usage.read()) || !usage.read().length)
    problems.push('usage `read()` returns no means (a runtime that cannot read the use returns the owner as the means)')
  for (const [id, subscription] of Object.entries(usage.subscriptions ?? {})) {
    const where = `subscription "${id}"`
    if (!['percent', 'usd'].includes(subscription.unit)) problems.push(`${where}: unit must be "percent" or "usd"`)
    const models = subscription.perSp ?? {}
    if (!Object.keys(models).length) problems.push(`${where}: perSp names no model`)
    for (const [model, row] of Object.entries(models)) {
      for (const [kind, cell] of Object.entries(row)) {
        const fields = subscription.unit === 'usd' ? ['usd'] : WINDOWS.map((window) => window.id)
        if (!fields.every((field) => cell?.[field] > 0))
          problems.push(`${where}, ${model}, ${kind}: needs a positive ${fields.join(' and ')}`)
      }
      if (!row.default) problems.push(`${where}, ${model}: has no default row`)
    }
  }
  if (usage.defaultModel && !Object.values(usage.subscriptions ?? {}).every((s) => s.perSp?.[usage.defaultModel]))
    problems.push(`defaultModel "${usage.defaultModel}" is missing from a subscription`)
  return problems
}

/** `Sonnet 5.5` or `claude-opus-5-5` as the family a table names: `sonnet`, `opus`. Null for no text. */
export function modelFamily(text) {
  const words = (text ?? '')
    .trim()
    .toLowerCase()
    .replace(/^claude[\s-]+/, '')
  return words ? words.split(/[\s-]+/)[0] : null
}

const sameWords = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** The subscription id that a plan names, as the account reports it (`Pro`, `Max 5x`) or as the table calls it (`pro`), without regard to case. */
function planSubscription(plan, usage) {
  const named = Object.keys(usage?.plans ?? {}).find((name) => sameWords(name, plan))
  if (named) return usage.plans[named]
  return Object.keys(usage?.subscriptions ?? {}).find((id) => sameWords(id, plan)) ?? null
}

/**
 * The subscription that applies: the flow's `usage.subscription` unless it is `local`, else `usage.subscription` of the ignored local profile file, else the
 * plan the account reports (`plan`, as the runtime names it, mapped by the adapter's `plans`). Null when none says; `from` says where it came from.
 */
export function resolveSubscription({ flow, local, plan, usage }) {
  const set = flow?.settings?.usage?.subscription
  if (set && set !== 'local') return { id: set, from: "the flow's setting" }
  if (local?.usage?.subscription) return { id: local.usage.subscription, from: 'the local profile file' }
  const mapped = plan ? planSubscription(String(plan), usage) : null
  return mapped ? { id: mapped, from: `the plan the account reports (${plan})` } : { id: null, from: null }
}

/**
 * The coefficient of a model and a step kind in a subscription: the calibrated row of the kind when the table has one, else the model's default row times the
 * subscription's factor for the kind. Null when the table does not know the model.
 */
export function coefficientFor(subscription, model, kind) {
  const row = subscription?.perSp?.[model] ?? subscription?.perSp?.default
  if (!row) return null
  if (row[kind]) return { ...row[kind], source: 'calibrated' }
  const factor = subscription.kinds?.[kind] ?? 1
  const scaled = Object.fromEntries(
    Object.entries(row.default).map(([field, value]) => [field, Math.round(value * factor * 10000) / 10000])
  )
  return { ...scaled, source: 'default' }
}

const round = (value) => Math.round(value * 10) / 10

/**
 * The estimate of a step: its SP times the coefficient of its model and kind, in percent of each window (`unit: 'percent'`) or in money (`unit: 'usd'`).
 * `known` is false, with `why`, when there is no subscription or no coefficient; the gate then checks the current use only.
 * @returns {{ known: boolean, unit?: string, fiveHour?: number, weekly?: number, usd?: number, model?: string, why?: string, source?: string }}
 */
export function estimateStep({ step, profile, usage, subscription }) {
  if (!subscription)
    return { known: false, why: 'no subscription is known (set usage.subscription in harness-profile.local.json)' }
  const table = usage.subscriptions?.[subscription]
  if (!table) return { known: false, why: `the runtime's table has no subscription "${subscription}"` }
  const model = modelFamily(stepModel(step, profile).text) ?? usage.defaultModel
  const coefficient = model ? coefficientFor(table, model, step.kind) : null
  if (!coefficient)
    return { known: false, why: `the table of "${subscription}" has no coefficient for the model "${model ?? '—'}"` }
  if (!(step.sp > 0)) return { known: false, why: 'the step has no SP' }
  const base = { known: true, unit: table.unit, model, source: coefficient.source }
  return table.unit === 'usd'
    ? { ...base, usd: Math.round(step.sp * coefficient.usd * 100) / 100 }
    : { ...base, fiveHour: round(step.sp * coefficient.fiveHour), weekly: round(step.sp * coefficient.weekly) }
}

/** The estimate as a line: `5-hour 24%, weekly 3.2%` or `$4.50`. */
export function estimateText(estimate) {
  if (!estimate.known) return `not estimated (${estimate.why})`
  return estimate.unit === 'usd'
    ? `$${estimate.usd.toFixed(2)}`
    : WINDOWS.map((window) => `${window.label} ${estimate[window.id]}%`).join(', ')
}

// Time as milliseconds: an ISO time, or the log's `YYYY-MM-DD HH:MM` (local time)
export function timeOf(value) {
  if (value instanceof Date) return value.getTime()
  const parsed = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(String(value))
    ? Date.parse(String(value).replace(' ', 'T'))
    : Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * A window reading from a flag value `26@2026-11-05T12:30:00Z` (percent used, then when it resets); `26` alone has no reset time.
 * @returns {{ percent: number, resetsAt: string | null } | { error: string }}
 */
export function parseWindow(value) {
  const found = String(value ?? '').match(/^(\d+(?:\.\d+)?)%?(?:@(.+))?$/)
  if (!found) return { error: `"${value}" is not <percent>[@<reset time>]` }
  const percent = Number(found[1])
  if (percent > 100) return { error: `"${value}": a window is at most 100%` }
  if (found[2] && timeOf(found[2]) === null) return { error: `"${found[2]}" is not a time (ISO, or YYYY-MM-DD HH:MM)` }
  return { percent, resetsAt: found[2] ?? null }
}

/**
 * The reading of the account from the flags of a command: `--five-hour`, `--weekly` (each `<percent>[@<reset>]`) and `--cost` (money spent, on an API key).
 * @returns {{ reading: object | null, errors: string[] }} null when no flag is given
 */
export function readingFromFlags(flags) {
  const errors = []
  const reading = {}
  for (const [flag, key] of [
    ['five-hour', 'fiveHour'],
    ['weekly', 'weekly']
  ]) {
    if (flags[flag] === undefined) continue
    const window = parseWindow(flags[flag])
    if (window.error) errors.push(`--${flag}: ${window.error}`)
    else reading[key] = window
  }
  if (flags.cost !== undefined) {
    if (Number.isFinite(Number(flags.cost)) && Number(flags.cost) >= 0) reading.cost = Number(flags.cost)
    else errors.push(`--cost: "${flags.cost}" is not an amount`)
  }
  return { reading: Object.keys(reading).length ? reading : null, errors }
}

/** The reading as the log's "Usage before" and "Usage after" lines carry it. */
export function readingText(reading) {
  if (!reading) return 'not read'
  const parts = WINDOWS.filter((window) => reading[window.id]).map(
    (window) =>
      `${window.label} ${reading[window.id].percent}%${reading[window.id].resetsAt ? ` (resets ${reading[window.id].resetsAt})` : ''}`
  )
  if (reading.cost !== undefined) parts.push(`spent $${reading.cost.toFixed(2)}`)
  return parts.join(' · ') || 'not read'
}

const minutes = (ms) => Math.max(0, Math.ceil(ms / 60000))

/**
 * Whether a step may start now. For each window: the use the account reports (a window whose reset time has passed since the reading counts as empty) plus the
 * estimate times the safety factor must stay within the threshold `stopAt`. A step that cannot fit an empty window is `stop`: split it. A window over its
 * threshold with a reset within `maxWaitMinutes` is `wait` until the latest such reset; one with a later reset, or none, is `stop`. Without a reading it is
 * `ask`: the owner is asked for the use.
 * @param {{ estimate: object, reading: object | null, stopAt: object, factor?: number, now: Date | string, maxWaitMinutes?: number }} input
 * @returns {{ decision: 'go' | 'wait' | 'stop' | 'ask', until: string | null, reasons: string[], windows: object[] }}
 */
export function gateStep({
  estimate,
  reading,
  stopAt,
  factor = SAFETY_FACTOR,
  now,
  maxWaitMinutes = MAX_WAIT_MINUTES
}) {
  const at = timeOf(now)
  const reasons = []
  if (!reading) return { decision: 'ask', until: null, reasons: ['the use of the account was not read'], windows: [] }
  const windows =
    estimate.unit === 'usd'
      ? [
          {
            id: 'cost',
            label: 'cost',
            unit: '$',
            limit: stopAt.cost,
            used: reading.cost,
            resetsAt: null,
            need: estimate.usd
          }
        ]
      : WINDOWS.map((window) => ({
          ...window,
          unit: '%',
          limit: stopAt[window.id],
          used: reading[window.id]?.percent,
          resetsAt: reading[window.id]?.resetsAt ?? null,
          need: estimate.known ? estimate[window.id] : 0
        }))
  if (!estimate.known) reasons.push(`no estimate (${estimate.why}): only the current use is checked`)
  let stop = false
  let until = null
  const missing = []
  for (const window of windows) {
    if (window.used === undefined || window.limit === undefined) {
      missing.push(window.label)
      continue
    }
    const reset = window.resetsAt ? timeOf(window.resetsAt) : null
    const passed = reset !== null && reset <= at
    const used = passed ? 0 : window.used
    const need = round((window.need ?? 0) * factor)
    Object.assign(window, { effectiveUsed: used, needed: need, passed })
    if (passed)
      reasons.push(`the ${window.label} window reset at ${window.resetsAt}, after the reading: counted as empty`)
    if (need > window.limit) {
      stop = true
      reasons.push(
        `the step needs ${need}${window.unit} of the ${window.label} window (its estimate ${window.need}${window.unit} times ${factor}), more than the threshold ${window.limit}${window.unit} of an empty window: split it`
      )
    } else if (used + need > window.limit) {
      const wait = reset === null ? null : minutes(reset - at)
      if (wait === null) {
        stop = true
        reasons.push(
          `the ${window.label} window is at ${used}${window.unit}, with ${need}${window.unit} to come it passes ${window.limit}${window.unit}, and it has no reset time`
        )
      } else if (wait > maxWaitMinutes) {
        stop = true
        reasons.push(
          `the ${window.label} window is at ${used}${window.unit}, with ${need}${window.unit} to come it passes ${window.limit}${window.unit}; it resets at ${window.resetsAt}, ${wait} minutes away, beyond the ${maxWaitMinutes} minutes to wait`
        )
      } else {
        until = until === null || reset > timeOf(until) ? window.resetsAt : until
        reasons.push(
          `the ${window.label} window is at ${used}${window.unit}, with ${need}${window.unit} to come it passes ${window.limit}${window.unit}; it resets at ${window.resetsAt}, in ${wait} minutes`
        )
      }
    } else {
      reasons.push(
        `the ${window.label} window: ${used}${window.unit} + ${need}${window.unit} stays within ${window.limit}${window.unit}`
      )
    }
  }
  if (missing.length) {
    reasons.push(`not read or not set: ${missing.join(', ')}`)
    if (!stop && until === null) return { decision: 'ask', until: null, reasons, windows }
  }
  if (stop) return { decision: 'stop', until: null, reasons, windows }
  return until ? { decision: 'wait', until, reasons, windows } : { decision: 'go', until: null, reasons, windows }
}

/** The headline of a gate decision. */
export function gateHeadline(gate) {
  return {
    go: 'Gate: GO — the step fits.',
    wait: `Gate: WAIT until ${gate.until} — log a "stop: usage" entry, and start the step after the reset.`,
    stop: 'Gate: STOP — do not start the step; tell the owner (a "stop: usage" entry with the digest).',
    ask: 'Gate: ASK — the use of the account is not known; ask the owner for it.'
  }[gate.decision]
}

/**
 * The problems of a flow's steps against the windows: a step whose estimate times the safety factor passes the threshold of an empty window can never pass the
 * gate, so it is split when planned. None when the estimate is unknown.
 */
export function fitProblems({ flow, profile, usage, subscription }) {
  const stopAt = flow.settings.usage?.stopAt ?? {}
  const factor = flow.settings.usage?.safetyFactor ?? SAFETY_FACTOR
  const problems = []
  for (const step of flow.steps) {
    const estimate = estimateStep({ step, profile, usage, subscription })
    if (!estimate.known) continue
    const windows =
      estimate.unit === 'usd'
        ? [{ label: 'cost', unit: '$', limit: stopAt.cost, need: estimate.usd }]
        : WINDOWS.map((window) => ({
            label: window.label,
            unit: '%',
            limit: stopAt[window.id],
            need: estimate[window.id]
          }))
    for (const window of windows) {
      if (window.limit !== undefined && window.need * factor > window.limit)
        problems.push(
          `step ${step.id}: its estimate of ${window.need}${window.unit} of the ${window.label} window (times ${factor}) does not fit within the threshold ${window.limit}${window.unit} even when the window is empty; split the step`
        )
    }
  }
  return problems
}

/** The flow's estimate: each step's, and the total in each window. */
export function flowEstimate({ flow, profile, usage, subscription }) {
  const steps = flow.steps.map((step) => ({ step, estimate: estimateStep({ step, profile, usage, subscription }) }))
  const known = steps.filter((each) => each.estimate.known)
  const total = (field) => round(known.reduce((sum, each) => sum + each.estimate[field], 0))
  const unit = known[0]?.estimate.unit ?? null
  return {
    steps,
    unit,
    partial: known.length < steps.length,
    total:
      unit === 'usd' ? { usd: total('usd') } : unit ? { fiveHour: total('fiveHour'), weekly: total('weekly') } : null
  }
}

/**
 * A sample of the use for `usage.jsonl`: `{ v, at, flow, event, step?, kind?, sp?, model?, start?, subscription?, tokens?, fiveHour?, weekly?, cost? }`.
 * Windows are `{ percent, resetsAt }`; `tokens` is what the runtime reports for the step when it does (null otherwise), `start` whether its worker started cold or warm.
 */
export function makeSample({
  at,
  flow,
  event,
  step = null,
  reading = null,
  tokens = null,
  model = null,
  start = null,
  subscription = null
}) {
  const sample = { v: 1, at, flow, event }
  if (step) Object.assign(sample, { step: step.id, kind: step.kind, sp: step.sp })
  if (model) sample.model = model
  if (start) sample.start = start
  if (subscription) sample.subscription = subscription
  if (tokens !== null && tokens !== undefined) sample.tokens = tokens
  for (const window of WINDOWS) if (reading?.[window.id]) sample[window.id] = reading[window.id]
  if (reading?.cost !== undefined) sample.cost = reading.cost
  return sample
}

/** The problems of one parsed sample (empty when it is valid). */
export function sampleProblems(sample) {
  if (!sample || typeof sample !== 'object' || Array.isArray(sample)) return ['is not a JSON object']
  const problems = []
  if (sample.v !== 1) problems.push('v must be 1')
  if (timeOf(sample.at) === null) problems.push('at is not a time')
  if (!Number.isInteger(sample.flow) || sample.flow < 1) problems.push('flow must be a flow number')
  if (!SAMPLE_EVENTS.includes(sample.event)) problems.push(`event must be one of ${SAMPLE_EVENTS.join(', ')}`)
  if (sample.event.startsWith?.('step') && !sample.step) problems.push('a step event names its step')
  if (sample.start !== undefined && !START_KINDS.includes(sample.start)) problems.push('start must be cold or warm')
  for (const window of WINDOWS) {
    const value = sample[window.id]
    if (value !== undefined && !(value && value.percent >= 0 && value.percent <= 100))
      problems.push(`${window.id} must be { percent, resetsAt }`)
  }
  return problems
}

/** The samples in a text of `usage.jsonl` (one JSON object per line), and the problems of the lines that are not valid. */
export function parseSamples(fileText) {
  const samples = []
  const problems = []
  ;(fileText ?? '').split('\n').forEach((line, index) => {
    if (!line.trim()) return
    let parsed
    try {
      parsed = JSON.parse(line)
    } catch {
      problems.push(`line ${index + 1}: is not JSON`)
      return
    }
    const bad = sampleProblems(parsed)
    if (bad.length) problems.push(`line ${index + 1}: ${bad.join('; ')}`)
    else samples.push(parsed)
  })
  return { samples, problems }
}

/** `fileText` with `sample` appended as a line. */
export const appendSample = (fileText, sample) =>
  `${fileText && !fileText.endsWith('\n') ? `${fileText}\n` : (fileText ?? '')}${JSON.stringify(sample)}\n`

/**
 * What was used between two samples, per window (and in money): the end's reading less the start's. A window that reset in between (its reset time passed, or
 * its end is lower than its start) has no difference: it is cut.
 * @returns {{ fiveHour?: number, weekly?: number, usd?: number, cut: string[] }}
 */
export function deltaBetween(start, end) {
  const delta = { cut: [] }
  for (const window of WINDOWS) {
    if (!start[window.id] || !end[window.id]) continue
    const reset = start[window.id].resetsAt ? timeOf(start[window.id].resetsAt) : null
    if (end[window.id].percent < start[window.id].percent || (reset !== null && reset <= timeOf(end.at)))
      delta.cut.push(window.id)
    else delta[window.id] = Math.round((end[window.id].percent - start[window.id].percent) * 100) / 100
  }
  if (start.cost !== undefined && end.cost !== undefined && end.cost >= start.cost)
    delta.usd = Math.round((end.cost - start.cost) * 100) / 100
  return delta
}

/**
 * What a step used: the difference between its "step-end" sample and the newest "step-start" sample of the same flow and step before it, per window.
 * @returns {{ fiveHour?: number, weekly?: number, usd?: number, cut: string[] } | null} null when there is no start sample
 */
export function stepDelta(samples, end) {
  const start = samples.findLast(
    (sample) =>
      sample.event === 'step-start' &&
      sample.flow === end.flow &&
      sample.step === end.step &&
      timeOf(sample.at) <= timeOf(end.at)
  )
  return start ? deltaBetween(start, end) : null
}
