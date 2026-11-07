// The steps of a flow (task 5.4): the grammar of a row of the steps table, shared by the checks, the status and the prompts of `harness flow`. Pure functions.
// A step id is a number with an optional letter suffix (`6`, `6c`): a step inserted midway takes the suffix and no other step is renumbered (the plan method,
// section 10). The scope of a step names ids only: a version in backticks, a task or an issue by its id, or a backlog item (which a check refuses).
import { tokensOf } from './releases.mjs'

/** The kinds of step, as the flow template says them; `custom` is the only one with a prompt of its own. */
export const STEP_KINDS = Object.freeze(['tasks', 'cut', 'consumer-take', 'triage-fix', 'decision', 'custom'])
/** The executors a flow or a step may name (the flow template). */
export const EXECUTORS = Object.freeze(['session', 'cli', 'subagent', 'manual'])
/**
 * The order of the executors (the runtime contract, task 2.7): each is the fallback of the one before it, for one step at a time and logged with its reason;
 * a subagent stands outside the order, for a short step of analysis only.
 */
export const EXECUTOR_ORDER = Object.freeze(['session', 'cli', 'manual'])
/** The executor a step is planned for: its own override, else the flow's setting, else the default `session`. */
export const plannedExecutor = (flow, step) => step.executor ?? flow.settings?.executor ?? 'session'

/**
 * The value of the `Executor:` field of a "step started" entry (the flow-log template): `cli, reused from step 3, the fallback of session: <reason>`, each
 * part after the executor optional. Returns `{ executor, reusedFrom, fallbackOf, reason }`; `executor` is null when the value names none of `EXECUTORS`.
 */
export function readExecutorField(value) {
  const text = (value ?? '').trim()
  const fallback = text.match(/the fallback of (\w+):\s*(.*)$/)
  return {
    executor: EXECUTORS.find((kind) => new RegExp(`^${kind}\\b`).test(text)) ?? null,
    reusedFrom: text.match(/reused from step (\d+[a-z]?)/)?.[1] ?? null,
    fallbackOf: fallback?.[1] ?? null,
    reason: fallback?.[2]?.trim() || null
  }
}

/** The `Executor:` field of a worker that runs a step on `kind`, planned for `planned`: the fallback and its reason when the two differ. */
export const executorField = ({ kind, planned, reason, reusedFrom = null }) =>
  [
    kind,
    reusedFrom ? `reused from step ${reusedFrom}` : null,
    kind !== planned ? `the fallback of ${planned}: ${reason}` : null
  ]
    .filter(Boolean)
    .join(', ')
/** The decision levels (the procedure `run-flow`). */
export const LEVELS = Object.freeze(['D0', 'D1', 'D2', 'D3', 'D4'])
export const HOME_REPO = 'home'

export const STEP_ID = /^(\d+)([a-z]?)$/
const VERSION = /`(\d+\.\d+\.\d+(?:-[\w.]+)?)`/g
const EXECUTOR_OVERRIDE = /\(\s*executor:\s*([\w-]+)\s*\)/i
const NONE = /^(?:—|-|–)?$/

/** The ids a cell lists (`1, 2b`), none for a dash. */
const idsOf = (cell) => (NONE.test(cell.trim()) ? [] : [...cell.matchAll(/\b\d+[a-z]?\b/g)].map((match) => match[0]))

/**
 * A row of the steps table as a step: `{ id, number, suffix, kind, repo, scope, versions, ids, executor, needs, stopsFor, sp, usage, model, state }`.
 * `versions` are the versions in backticks in the scope, `ids` the tasks and issues and backlog items it names, `executor` the override
 * `(executor: manual)` in the scope cell or null, `state` the mark of the State column.
 */
export function parseStep(row) {
  const id = (row['#'] ?? '').trim()
  const match = id.match(STEP_ID)
  const scope = row.scope ?? ''
  const stopsFor = (row['stops for'] ?? '').trim()
  return {
    id,
    number: match ? Number(match[1]) : null,
    suffix: match?.[2] ?? '',
    kind: (row.kind ?? '').trim(),
    repo: (row.repo ?? '').trim() || HOME_REPO,
    scope,
    versions: [...scope.matchAll(VERSION)].map((found) => found[1]),
    ids: tokensOf(scope).filter((token) => typeof token === 'string'),
    phases: tokensOf(scope)
      .filter((token) => typeof token === 'object')
      .map((token) => token.phase),
    executor: scope.match(EXECUTOR_OVERRIDE)?.[1] ?? null,
    needs: idsOf(row.needs ?? ''),
    stopsFor: NONE.test(stopsFor) ? null : stopsFor,
    sp: Number(row.sp?.match(/^\d+(?:\.\d+)?/)?.[0] ?? 0),
    usage: row['est. usage']?.trim() ?? '',
    model: row.model?.trim() ?? '',
    state: [...(row.state ?? '')][0] ?? ''
  }
}

/** The steps of a flow from the rows of its table (`null` when the flow has no table). */
export const parseSteps = (rows) => (rows ?? []).map(parseStep)

/** The step `id` of `steps`, or undefined. */
export const stepById = (steps, id) => steps.find((step) => step.id === id)

/** True when the id is an inserted one (it has a letter suffix). */
export const isInserted = (step) => step.suffix !== ''
