// `harness flow estimate | gate | sample` (task 5.6): the usage of a flow. `estimate` sizes its steps by the runtime adapter's table of coefficients, `gate` says
// whether a step may start given the use the account reports, and `sample` appends a measurement to the flows' `usage.jsonl` (the one file this command line
// writes) and prints the line the flow's log carries. The seams are the runtime adapters (`runtimes`) and the clock (`now`).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { calibrationReport, MIN_SAMPLES } from './flow-calibrate.mjs'
import { stepModel, renderMeans } from './flow-executors.mjs'
import { readFlowsOf } from './flows.mjs'
import { stepById } from './flow-steps.mjs'
import { localProfile } from './flow-usage-check.mjs'
import {
  MAX_WAIT_MINUTES,
  SAFETY_FACTOR,
  SAMPLE_EVENTS,
  START_KINDS,
  USAGE_FILE,
  appendSample,
  estimateStep,
  estimateText,
  flowEstimate,
  gateHeadline,
  gateStep,
  makeSample,
  parseSamples,
  readingFromFlags,
  readingText,
  resolveSubscription,
  runtimeUsage,
  sampleProblems,
  stepDelta,
  timeOf
} from './flow-usage.mjs'

const fail = (message) => ({ lines: [message], code: 1 })

/** The usage that applies to `flow`: the runtime's table, the subscription and where it came from, and the thresholds. */
function situation({ flow, root, profile, runtimes, plan }) {
  const { runtime, usage } = runtimeUsage(profile, runtimes)
  const subscription = resolveSubscription({ flow, local: localProfile(root), plan, usage })
  const settings = flow.settings.usage ?? {}
  return {
    runtime,
    usage,
    subscription,
    stopAt: settings.stopAt ?? {},
    factor: settings.safetyFactor ?? SAFETY_FACTOR,
    maxWait: settings.maxWaitMinutes ?? MAX_WAIT_MINUTES
  }
}

const where = (here) =>
  here.subscription.id
    ? `subscription ${here.subscription.id} (${here.subscription.from}), ${here.usage.subscriptions?.[here.subscription.id]?.provisional ? 'provisional coefficients of' : 'coefficients of'} ${here.runtime ?? 'the framework'}`
    : 'no subscription known (set usage.subscription in harness-profile.local.json, or give --plan <plan or subscription id>, as the runtime reports it (Pro) or as the table names it (pro), in any case)'

function estimateLines({ flow, profile, here }) {
  const result = flowEstimate({ flow, profile, usage: here.usage, subscription: here.subscription.id })
  const lines = [`Flow ${flow.number} — ${flow.title}: ${where(here)}.`]
  for (const { step, estimate } of result.steps) {
    const model = stepModel(step, profile).text ?? '—'
    lines.push(
      `  step ${step.id} [${step.kind}] ${step.sp || '—'} SP, ${model}: ${estimateText(estimate)}${step.usage && step.usage !== '—' ? ` (the Est. usage column says ${step.usage})` : ''}`
    )
  }
  if (result.total) {
    const total =
      result.unit === 'usd'
        ? `$${result.total.usd.toFixed(2)}`
        : `5-hour ${result.total.fiveHour}%, weekly ${result.total.weekly}%`
    lines.push(
      `Sum of the steps: ${total}${result.partial ? ' (some steps not estimated)' : ''}. The 5-hour window resets, so the steps spread over several of them; the weekly sum is what the flow takes from the week${here.stopAt.weekly ? ` (the threshold is ${here.stopAt.weekly}%)` : ''}.`
    )
  } else lines.push('No step could be estimated, so the flow cannot be sized against the windows.')
  return lines
}

function gateLines({ flow, step, profile, here, flags, now }) {
  const estimate = estimateStep({ step, profile, usage: here.usage, subscription: here.subscription.id })
  const { reading, errors } = readingFromFlags(flags)
  if (errors.length) return { lines: errors, code: 2 }
  const gate = gateStep({
    estimate,
    reading,
    stopAt: here.stopAt,
    factor: here.factor,
    now,
    maxWaitMinutes: here.maxWait
  })
  const lines = [
    gateHeadline(gate),
    `Step ${step.id} of flow ${flow.number} [${step.kind}]: ${estimateText(estimate)} (${where(here)}); safety factor ${here.factor}, thresholds ${
      estimate.unit === 'usd'
        ? `cost $${here.stopAt.cost ?? '—'}`
        : `5-hour ${here.stopAt.fiveHour ?? '—'}%, weekly ${here.stopAt.weekly ?? '—'}%`
    }.`,
    `Usage read: ${readingText(reading)}.`,
    ...gate.reasons.map((reason) => `  - ${reason}`)
  ]
  if (gate.decision === 'ask' || !reading) {
    lines.push(
      'Read the use of the account by the means of the runtime, then run the gate again with `--five-hour <percent>@<reset time>` and `--weekly <percent>@<reset time>` (`--cost <usd>` on an API key):'
    )
    lines.push(...here.usage.read().map((means) => `  - ${renderMeans(means, '')}`))
  }
  return { lines, code: gate.decision === 'go' ? 0 : 1 }
}

function sampleLines({ flow, step, event, profile, here, flags, now, path }) {
  const { reading, errors } = readingFromFlags(flags)
  if (errors.length) return { lines: errors, code: 2 }
  if (!reading) return fail('A sample needs the reading: give --five-hour and --weekly (or --cost on an API key).')
  if (flags.start !== undefined && !START_KINDS.includes(flags.start)) return fail('--start is cold or warm.')
  const tokens = flags.tokens === undefined ? null : Number(flags.tokens)
  if (tokens !== null && !(Number.isFinite(tokens) && tokens >= 0)) return fail('--tokens is a number of tokens.')
  const sample = makeSample({
    at: new Date(now).toISOString(),
    flow: flow.number,
    event,
    step,
    reading,
    tokens,
    model: flags.model ?? (step ? stepModel(step, profile).text : null),
    start: flags.start ?? null,
    subscription: here.subscription.id
  })
  const bad = sampleProblems(sample)
  if (bad.length) return fail(`The sample is not valid: ${bad.join('; ')}.`)
  const before = existsSync(path) ? readFileSync(path, 'utf8') : ''
  writeFileSync(path, appendSample(before, sample))
  const lines = [`Appended a ${event} sample to ${USAGE_FILE}.`]
  const label = event.endsWith('start') ? 'Usage before' : 'Usage after'
  lines.push(`Log line: - **${label}:** ${readingText(reading)}`)
  if (event === 'step-end') {
    const delta = stepDelta(parseSamples(before).samples, sample)
    const estimate = estimateStep({ step, profile, usage: here.usage, subscription: here.subscription.id })
    if (!delta) lines.push('No step-start sample of this step came before it, so the step has no measured use.')
    else {
      const used = ['fiveHour', 'weekly']
        .filter((id) => delta[id] !== undefined)
        .map((id) => `${id === 'fiveHour' ? '5-hour' : 'weekly'} +${delta[id]}%`)
      lines.push(
        `Measured use of step ${step.id}: ${used.join(', ') || 'none'}${delta.cut.length ? `; the ${delta.cut.join(' and ')} window reset in between, so that part is cut and counts for nothing` : ''}; estimated ${estimateText(estimate)}. A step over twice its estimate is an escalation (the procedure run-flow, step 7).`
      )
    }
  }
  return { lines, code: 0 }
}

/**
 * Runs `harness flow estimate | gate | sample` for a flow already read.
 * @param {{ action: string, words: string[], flow: object, dir: string, flags: object, root: string, profile: object, runtimes?: object, now?: Date | string }} options
 *   `words` are those after the action and the flow number: `[step]` for `gate`, `[event, step?]` for `sample`.
 */
export function usageCommand({ action, words, flow, dir, flags, root, profile, runtimes, now }) {
  const here = situation({ flow, root, profile, runtimes, plan: typeof flags.plan === 'string' ? flags.plan : null })
  if (action === 'estimate') return { lines: estimateLines({ flow, profile, here }), code: 0 }
  const at = flags.at ?? now ?? new Date()
  if (timeOf(at) === null) return fail('--at is not a time (ISO, or YYYY-MM-DD HH:MM).')
  const [first, second] = words
  if (action === 'gate') {
    const step = stepById(flow.steps, first)
    if (!step)
      return fail(
        `Flow ${flow.number} has no step ${first}; its steps are ${flow.steps.map((each) => each.id).join(', ')}.`
      )
    return gateLines({ flow, step, profile, here, flags, now: at })
  }
  if (!SAMPLE_EVENTS.includes(first)) return fail(`A sample event is one of ${SAMPLE_EVENTS.join(', ')}.`)
  const needsStep = first.startsWith('step')
  if (needsStep !== (second !== undefined))
    return fail(needsStep ? `${first} names its step.` : `${first} names no step.`)
  const step = needsStep ? stepById(flow.steps, second) : null
  if (needsStep && !step)
    return fail(
      `Flow ${flow.number} has no step ${second}; its steps are ${flow.steps.map((each) => each.id).join(', ')}.`
    )
  return sampleLines({
    flow,
    step,
    event: first,
    profile,
    here,
    flags,
    now: timeOf(at),
    path: join(root, dir, USAGE_FILE)
  })
}

/**
 * The lines `harness flow dispatch` adds for the usage of a step: its estimate, how to read the account, the gate to pass before the worker starts, and the two
 * samples around the step (`warm` is whether the worker continues the previous one).
 */
export function dispatchUsageLines({ flow, step, profile, root, runtimes, harness, warm }) {
  const here = situation({ flow, root, profile, runtimes, plan: null })
  const estimate = estimateStep({ step, profile, usage: here.usage, subscription: here.subscription.id })
  const reading = '--five-hour <percent>@<reset time> --weekly <percent>@<reset time>'
  return [
    `Usage: the step is estimated at ${estimateText(estimate)} (${where(here)}). Before it starts, read the usage of the account:`,
    ...here.usage.read().map((means) => `  - ${renderMeans(means, '')}`),
    `Then \`${harness} flow gate ${flow.number} ${step.id} ${reading}\`: start the step only on GO; on WAIT or STOP log a "stop: usage" entry (the procedure run-flow, step 3).`,
    `Measure it: \`${harness} flow sample ${flow.number} step-start ${step.id} ${reading} --start ${warm ? 'warm' : 'cold'}\` when the worker starts, and \`... step-end ${step.id} ...\` (with \`--tokens <n>\` when the runtime reports them) when it ends; each prints the line for the log.`
  ]
}

/** `harness flow calibrate`: the proposals of new coefficients from `usage.jsonl`; it never writes them. */
export function calibrateCommand({ flags, root, profile, runtimes }) {
  const read = readFlowsOf(root, profile)
  if (!read)
    return fail('The profile file names no flows folder, or the folder has no index; there is no usage to calibrate.')
  const min = flags.min === undefined ? MIN_SAMPLES : Number(flags.min)
  if (!(Number.isInteger(min) && min >= 1)) return fail('--min is a whole number of steps from 1.')
  const file = `${read.dir}/${USAGE_FILE}`
  const path = join(root, file)
  const { samples, problems } = parseSamples(existsSync(path) ? readFileSync(path, 'utf8') : '')
  const { runtime, usage } = runtimeUsage(profile, runtimes)
  const { lines } = calibrationReport({
    samples,
    problems,
    usage,
    runtime,
    file,
    min,
    subscription: typeof flags.subscription === 'string' ? flags.subscription : null
  })
  return { lines, code: 0 }
}
