// The usage of Claude Code (the runtime contract, role `usage`): how an orchestrator of a flow reads the account's windows, and the table of coefficients that
// turns a step's SP, model and kind into a share of each window (percent), or into money on an API key. The desktop app reports the 5-hour and the weekly
// window in whole percent with their reset times; the command line reports no usage, so the owner reads it from the usage page.
//
// The numbers are PROVISIONAL: a first estimate by the plan's own scale (1 SP is about one focused agent session), not measured. `harness flow calibrate`
// (task 5.7) reads what flows used (`usage.jsonl`) and proposes the real ones; a pull request changes this table with the comparison it prints.

const APP = 'the Claude desktop app'
const CLI = 'the command line'

// The factor of a step kind against the default row of a model: a cut or a decision is a short session, a task is the bulk
const KINDS = Object.freeze({
  tasks: 1,
  cut: 0.4,
  'consumer-take': 0.5,
  'triage-fix': 1,
  decision: 0.2,
  custom: 1
})

// Percent of the 5-hour window and of the weekly one per SP, for the default row of a model, on a subscription. Models differ in cost: Opus uses the window
// about 1.7 times as fast as Sonnet, Haiku about a third, Fable 2.5 times. A larger subscription has the same limits scaled up (5x, 20x).
const row = (fiveHour, weekly) => ({ default: { fiveHour, weekly } })
const scaled = (base, divisor) =>
  Object.fromEntries(
    Object.entries(base).map(([model, { default: cell }]) => [
      model,
      row(Math.round((cell.fiveHour / divisor) * 100) / 100, Math.round((cell.weekly / divisor) * 1000) / 1000)
    ])
  )
// The rows of Sonnet on Pro that carry a kind of their own are CALIBRATED: the medians per SP that `harness flow calibrate` read from the measured steps of
// flows 1 and 2 (2026-11-05 to 2026-11-07): 4 `consumer-take` steps, 6 `cut` steps and 6 `tasks` steps. The account's window also counts the orchestrator and
// the owner's parallel work, so a measured step is an upper bound. A kind with fewer than 3 steps (custom, triage-fix, decision) keeps the default row times its factor.
const PRO = {
  haiku: row(4, 0.5),
  sonnet: {
    default: { fiveHour: 12, weekly: 1.6 },
    tasks: { fiveHour: 1.8, weekly: 0.25 },
    'consumer-take': { fiveHour: 2.61, weekly: 0.23 },
    cut: { fiveHour: 3.42, weekly: 0.69 }
  },
  opus: row(20, 2.7),
  fable: row(30, 4)
}

const SUBSCRIPTIONS = {
  pro: { label: 'Claude Pro', unit: 'percent', provisional: true, kinds: KINDS, perSp: PRO },
  max5x: { label: 'Claude Max 5x', unit: 'percent', provisional: true, kinds: KINDS, perSp: scaled(PRO, 5) },
  max20x: { label: 'Claude Max 20x', unit: 'percent', provisional: true, kinds: KINDS, perSp: scaled(PRO, 20) },
  // An API key has no windows, only a cost: the flow's `usage.stopAt.cost` is the money it may spend
  api: {
    label: 'the API',
    unit: 'usd',
    provisional: true,
    kinds: KINDS,
    perSp: {
      haiku: { default: { usd: 0.6 } },
      sonnet: { default: { usd: 2 } },
      opus: { default: { usd: 5 } },
      fable: { default: { usd: 8 } }
    }
  }
}

/** The usage of Claude Code for a project (`profile` is unused: the means and the table are the runtime's own). */
export const usageFor = () => ({
  means:
    'the Claude desktop app reports the 5-hour and the weekly window in whole percent with their reset times; the command line reports none, so the owner reads them',
  read: () => [
    {
      via: APP,
      tool: 'get_usage',
      input: {},
      reads:
        '`plan.windows`: the "5-hour limit" and the "Weekly · all models" entries, each with `percentUsed` and `resetsAt`; `plan.plan` names the subscription (Pro, Max 5x, Max 20x). Status "not_applicable" is an API key (use the cost), "unavailable" is a reading that failed (ask the owner)'
    },
    {
      via: CLI,
      owner:
        'Ask the owner for the percent used and the reset time of the 5-hour and the weekly window (the usage page), or the money spent on an API key.'
    }
  ],
  plans: { Pro: 'pro', 'Max 5x': 'max5x', 'Max 20x': 'max20x' },
  subscriptions: structuredClone(SUBSCRIPTIONS),
  defaultModel: 'sonnet'
})
