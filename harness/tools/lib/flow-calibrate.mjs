// `harness flow calibrate` (task 5.7): the measurements of `usage.jsonl` turned into proposed coefficients for the runtime adapter's table (task 5.6), and a verdict
// on whether a warm start pays off. Pure functions on the samples and on the table; nothing is written, a proposal is accepted by a pull request that changes the table.
import { coefficientFor, deltaBetween, modelFamily, timeOf, WINDOWS } from './flow-usage.mjs'

/** The fewest measured steps behind a coefficient, when `--min` is not given. */
export const MIN_SAMPLES = 3
/** A warm start pays off when its use per SP is at most this share of a cold start's (the median over the groups that have both). */
export const WARM_PAYS_AT = 0.9
/** The fewest measured steps of each of the cold and the warm side in a group that is compared. */
export const MIN_PER_SIDE = 2

const round = (value, places = 2) => Math.round(value * 10 ** places) / 10 ** places

/** The median of a list of numbers; null for none. */
export function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = sorted.length >> 1
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/**
 * The steps that were measured: each "step-end" sample paired with the "step-start" sample of the same flow and step that is still open (a step that ended
 * partial and was continued ends again, and pairs with its own restart). `delta` is what the step used per window, with the windows a reset cut; `tokens`
 * is what the runtime reported for the step at its end; `start` is `cold`, `warm` or null.
 * @returns {{ steps: object[], unpaired: number }}
 */
export function measuredSteps(samples) {
  const open = new Map()
  const steps = []
  let unpaired = 0
  for (const sample of samples) {
    const key = `${sample.flow}/${sample.step}`
    if (sample.event === 'step-start') {
      if (open.has(key)) unpaired += 1
      open.set(key, sample)
    } else if (sample.event === 'step-end') {
      const start = open.get(key)
      if (!start) {
        unpaired += 1
        continue
      }
      open.delete(key)
      steps.push({
        flow: sample.flow,
        step: sample.step,
        kind: start.kind,
        sp: start.sp,
        model: modelFamily(start.model ?? sample.model),
        subscription: start.subscription ?? sample.subscription ?? null,
        start: start.start ?? null,
        tokens: Number.isFinite(sample.tokens) ? sample.tokens : null,
        delta: deltaBetween(start, sample)
      })
    }
  }
  return { steps: steps.filter((step) => step.sp > 0), unpaired: unpaired + open.size }
}

/** The windows (and the money) a step counts for in a subscription's unit. */
const fieldsOf = (unit) => (unit === 'usd' ? ['usd'] : WINDOWS.map((window) => window.id))

/**
 * Tokens per percent of a window, per subscription and window: all the tokens of the steps that have both tokens and an uncut use, over all their percents.
 * One whole percent is coarse, and the larger the subscription the coarser, so the figure is taken over all of them together.
 */
export function tokensPerPercent(steps) {
  const sums = new Map()
  for (const step of steps) {
    if (step.tokens === null || !step.subscription) continue
    for (const window of WINDOWS) {
      const percent = step.delta[window.id]
      if (!(percent > 0)) continue
      const key = `${step.subscription}/${window.id}`
      const sum = sums.get(key) ?? { tokens: 0, percent: 0, steps: 0 }
      sums.set(key, { tokens: sum.tokens + step.tokens, percent: sum.percent + percent, steps: sum.steps + 1 })
    }
  }
  return new Map([...sums].map(([key, sum]) => [key, { perPercent: sum.tokens / sum.percent, steps: sum.steps }]))
}

// The per-SP figure of a step in a field: from its tokens through the conversion when it has both, else from its uncut use; null when neither
function perSp(step, field, tokenRates) {
  if (step.tokens !== null && field !== 'usd') {
    const rate = tokenRates.get(`${step.subscription}/${field}`)
    if (rate) return { value: step.tokens / step.sp / rate.perPercent, basis: 'tokens' }
  }
  const used = step.delta[field]
  return used === undefined ? null : { value: used / step.sp, basis: 'percent' }
}

const groupKey = (step) => `${step.subscription}\u0000${step.model}\u0000${step.kind}`

function groups(steps) {
  const map = new Map()
  for (const step of steps) {
    if (!step.subscription || !step.model || !step.kind) continue
    map.set(groupKey(step), [...(map.get(groupKey(step)) ?? []), step])
  }
  return map
}

/**
 * The proposed coefficients: for each subscription, model family and step kind with at least `min` measured steps, the median per SP of each window (the
 * median of tokens per SP converted to percent where tokens exist, else of the uncut percent per SP), beside the table's current figure. A group with fewer
 * steps is listed with no proposal. `usage` is the runtime adapter's usage (its subscriptions).
 */
export function proposals({ steps, usage, min = MIN_SAMPLES, subscription = null }) {
  const rates = tokensPerPercent(steps)
  const rows = []
  for (const members of groups(steps).values()) {
    const [{ subscription: id, model, kind }] = members
    if (subscription && id !== subscription) continue
    const table = usage.subscriptions?.[id]
    const fields = fieldsOf(table?.unit ?? 'percent')
    const proposed = {}
    const used = {}
    for (const field of fields) {
      const figures = members.map((step) => perSp(step, field, rates)).filter(Boolean)
      if (!figures.length) continue
      used[field] = {
        n: figures.length,
        basis: figures.every((figure) => figure.basis === 'tokens') ? 'tokens' : 'percent'
      }
      proposed[field] = round(median(figures.map((figure) => figure.value)))
    }
    const n = Math.min(...Object.values(used).map((each) => each.n), Infinity)
    const current = table ? coefficientFor(table, model, kind) : null
    rows.push({
      subscription: id,
      model,
      kind,
      steps: members.length,
      n: Number.isFinite(n) ? n : 0,
      used,
      proposed: Object.keys(proposed).length ? proposed : null,
      current: current ? Object.fromEntries(fields.map((field) => [field, current[field]])) : null,
      enough: Number.isFinite(n) && n >= min,
      unknownTable: !table
    })
  }
  return rows.sort((a, b) =>
    `${a.subscription}${a.model}${a.kind}`.localeCompare(`${b.subscription}${b.model}${b.kind}`)
  )
}

// The measures a cold and warm comparison can use, best first: tokens per SP, the uncut 5-hour percent per SP, money per SP
const MEASURES = [
  { name: 'tokens/SP', of: (step) => (step.tokens === null ? null : step.tokens / step.sp) },
  { name: '5-hour %/SP', of: (step) => (step.delta.fiveHour === undefined ? null : step.delta.fiveHour / step.sp) },
  { name: '$/SP', of: (step) => (step.delta.usd === undefined ? null : step.delta.usd / step.sp) }
]

/**
 * Whether a warm start pays off: in each group of subscription, model and step kind with at least `perSide` cold and `perSide` warm steps, the median use per SP
 * of the warm steps against that of the cold ones (by the first measure that both sides have: tokens, else the 5-hour percent, else money); the verdict is on
 * the median of those ratios. Steps that do not say how their worker started, and steps the measure cannot read (a cut window), are left out.
 * @returns {{ groups: object[], ratio: number | null, verdict: 'pays' | 'does-not-pay' | 'unknown' }}
 */
export function warmComparison({ steps, perSide = MIN_PER_SIDE }) {
  const compared = []
  for (const members of groups(steps).values()) {
    for (const measure of MEASURES) {
      const side = (start) =>
        members
          .filter((step) => step.start === start)
          .map(measure.of)
          .filter((value) => value !== null)
      const cold = side('cold')
      const warm = side('warm')
      if (cold.length < perSide || warm.length < perSide || !(median(cold) > 0)) continue
      compared.push({
        subscription: members[0].subscription,
        model: members[0].model,
        kind: members[0].kind,
        measure: measure.name,
        cold: { n: cold.length, median: round(median(cold)) },
        warm: { n: warm.length, median: round(median(warm)) },
        ratio: round(median(warm) / median(cold))
      })
      break
    }
  }
  const ratio = median(compared.map((group) => group.ratio))
  return {
    groups: compared,
    ratio: ratio === null ? null : round(ratio),
    verdict: ratio === null ? 'unknown' : ratio <= WARM_PAYS_AT ? 'pays' : 'does-not-pay'
  }
}

/**
 * What the whole flows used against what their steps used: per flow with both a "flow-start" and a "flow-end" sample, the use of each uncut window, the sum
 * of its measured steps, and the rest (the orchestrator itself, and whatever else the account did).
 */
export function flowTotals(samples, steps) {
  const totals = []
  for (const end of samples.filter((sample) => sample.event === 'flow-end')) {
    const start = samples.findLast(
      (sample) => sample.event === 'flow-start' && sample.flow === end.flow && timeOf(sample.at) <= timeOf(end.at)
    )
    if (!start) continue
    const delta = deltaBetween(start, end)
    const mine = steps.filter((step) => step.flow === end.flow)
    for (const window of WINDOWS) {
      if (delta[window.id] === undefined) continue
      const stepsSum = round(mine.reduce((sum, step) => sum + (step.delta[window.id] ?? 0), 0))
      totals.push({
        flow: end.flow,
        window: window.id,
        used: delta[window.id],
        steps: stepsSum,
        rest: round(delta[window.id] - stepsSum)
      })
    }
  }
  return totals
}

const WINDOW_LABELS = { fiveHour: '5-hour', weekly: 'weekly', usd: '$' }
const figures = (row, side) =>
  Object.entries(row[side] ?? {})
    .map(([field, value]) => `${WINDOW_LABELS[field]} ${value}${field === 'usd' ? '' : '%'}`)
    .join(', ')

/**
 * The report `harness flow calibrate` prints.
 * @param {{ samples: object[], problems?: string[], usage: object, runtime: string | null, file: string, min?: number, subscription?: string | null }} input
 */
export function calibrationReport({
  samples,
  problems = [],
  usage,
  runtime,
  file,
  min = MIN_SAMPLES,
  subscription = null
}) {
  const measured = measuredSteps(samples)
  const steps = subscription ? measured.steps.filter((step) => step.subscription === subscription) : measured.steps
  const unpaired = measured.unpaired
  const cut = steps.filter((step) => step.delta.cut.length).length
  const lines = [
    `Calibration from ${file}: ${samples.length} sample(s), ${steps.length} measured step(s)${unpaired ? `, ${unpaired} sample(s) without their pair` : ''}${cut ? `, ${cut} with a window that a reset cut` : ''}.`,
    ...problems.map((problem) => `  ! ${file}: ${problem}`)
  ]
  if (!steps.length) {
    lines.push(
      'There is nothing to calibrate yet: a flow appends a step-start and a step-end sample to it with `harness flow sample` (the procedure run-flow, step 3).'
    )
    return { lines, proposals: [] }
  }
  const rows = proposals({ steps, usage, min, subscription })
  lines.push(
    `Medians per SP, in percent of a window (money on an API key), against the table of ${runtime ?? 'the framework'} (at least ${min} steps for a proposal):`
  )
  for (const row of rows) {
    const basis = Object.values(row.used)
      .map((each) => each.basis)
      .includes('tokens')
      ? 'from tokens'
      : 'from percents'
    const head = `  ${row.subscription} · ${row.model} · ${row.kind}: `
    if (row.unknownTable)
      lines.push(`${head}the table has no subscription "${row.subscription}", n=${row.steps}, no proposal`)
    else if (!row.proposed)
      lines.push(`${head}every window of its ${row.steps} step(s) was cut by a reset, no proposal`)
    else
      lines.push(
        `${head}${figures(row, 'proposed')} (table: ${row.current ? figures(row, 'current') : 'none'}), n=${row.n}, ${basis}${row.enough ? '' : ` — fewer than ${min}, no proposal`}`
      )
  }
  const accepted = rows.filter((row) => row.enough && row.proposed && !row.unknownTable)
  lines.push(
    accepted.length
      ? `Proposed changes to the table of ${runtime ?? 'the runtime adapter'} (its \`usage.mjs\`; nothing is written, the owner accepts them by a pull request that carries this comparison):`
      : 'No coefficient has enough measured steps to propose.'
  )
  for (const row of accepted)
    lines.push(
      `  ${row.subscription}.perSp.${row.model}.${row.kind} = ${JSON.stringify(row.proposed).replace(/"/g, '').replace(/,/g, ', ').replace(/:/g, ': ')}`
    )

  const warm = warmComparison({ steps })
  lines.push('Cold and warm starts:')
  for (const group of warm.groups)
    lines.push(
      `  ${group.subscription} · ${group.model} · ${group.kind}: cold ${group.cold.median} ${group.measure} (n=${group.cold.n}), warm ${group.warm.median} (n=${group.warm.n}), warm is ${group.ratio} of cold`
    )
  lines.push(
    {
      pays: `  Warm starts pay off (median ${warm.ratio} of a cold start, at most ${WARM_PAYS_AT}): keep \`reuse: auto\`.`,
      'does-not-pay': `  Warm starts do not pay off (median ${warm.ratio} of a cold start, more than ${WARM_PAYS_AT}): set \`reuse\` to \`never\` in the settings of the flows, as the default of the flow template.`,
      unknown: `  Not enough data: no group has ${MIN_PER_SIDE} cold and ${MIN_PER_SIDE} warm steps measured. Keep the default, \`reuse: auto\`; pass \`--start cold|warm\` to \`harness flow sample\`.`
    }[warm.verdict]
  )
  const totals = flowTotals(samples, steps)
  if (totals.length) {
    lines.push('Whole flows against their steps:')
    for (const total of totals)
      lines.push(
        `  flow ${total.flow}, ${WINDOW_LABELS[total.window]} window: ${total.used}% used, ${total.steps}% by the steps, ${total.rest}% the orchestrator and the rest of the account`
      )
  }
  lines.push(
    "Limits of the data: a window is the account's, so the owner's parallel work, or another flow, pollutes a sample; whole percents are coarse, the more so on a larger subscription (tokens, where the runtime gives them, are converted and are the better figure); a step that a reset cut counts for nothing in that window; the median of a few steps is a rough one."
  )
  return { lines, proposals: accepted }
}
