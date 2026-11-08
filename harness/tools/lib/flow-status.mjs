// `harness flow status`, `next` (task 5.4): the state of each step of a flow recomputed from the repository, compared with the State column (which is only a
// cache) and with the newest entries of the flow's log, so that an orchestrator that stopped in the middle of a step resumes from the truth.
// `flowTruth` is a pure function on a flow and on `facts`; `gatherFacts` reads the facts of a repository through its seams (the Git command, the lock of a
// consuming repository), so a test replaces them.
import { execFileSync } from 'node:child_process'
import { ENTRY_HEADING, logHeadings } from './flow-check.mjs'
import { phaseSequence } from './next-task.mjs'
import { tokensOf } from './releases.mjs'
import { readLock } from './lock.mjs'
import { compareVersions } from './versions.mjs'
import { HOME_REPO } from './flow-steps.mjs'

const DONE = '✅'
const RUNNING = '🟡'
const NOT_STARTED = '⬜'
const WAITING = ['⏸', '⛔']
const PLAN_LINE = /^Plan:[ \t]*(.+)$/gm

/** Whether `text` names `version` as a whole token: not as part of a longer version (`1.0.0-dev.1`, `1.0.01`, `1.0.0.1`) or of a longer number before it. */
export function namesVersion(text, version) {
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![\\d.])${escaped}(?!\\d|\\.\\d|-\\w)`).test(text)
}

/** The ids of the `Plan:` lines of the bodies of the squash commits on `ref`, or null when Git cannot say. */
export function mergedPlanIds(git, ref) {
  try {
    const bodies = git(['log', ref, '--format=%B'])
    return new Set(
      [...bodies.matchAll(PLAN_LINE)].flatMap((line) => line[1].match(/\b(?:\d+\.\d+[a-z]?|[IB]-\d+)\b/g) ?? [])
    )
  } catch {
    return null
  }
}

/** The tags of the repository, or null when Git cannot say. */
export function tagsOf(git) {
  try {
    return new Set(git(['tag', '--list']).split('\n').filter(Boolean))
  } catch {
    return null
  }
}

/**
 * The facts a status needs from a repository. `git` runs a Git command and returns its output; `lockOf(repo)` returns the lock of a repository: the parsed
 * lock, `null` when the repository has none, `undefined` when it cannot be read from here (an external repository, which task 5.8 reaches through the host).
 * @param {{ root: string, profile: object, plan: ReturnType<import('./flow-check.mjs').planFacts>, git?: Function, lockOf?: Function, pullRequestsOf?: Function }} options
 *   `pullRequestsOf(repo, text)` returns the pull requests of an external repository that mention `text` (`{ pullRequests, error? }`), `undefined` when they cannot be asked.
 */
export function gatherFacts({ root, profile, plan, git, lockOf, pullRequestsOf }) {
  const run =
    git ?? ((args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
  const integration = profile.branches.integration
  const merged = mergedPlanIds(run, `origin/${integration}`) ?? mergedPlanIds(run, integration)
  const statuses = new Map(plan.phases.flatMap((phase) => phase.tasks.map((task) => [task.id, task.status])))
  const titles = new Map(plan.phases.flatMap((phase) => phase.tasks.map((task) => [task.id, task.title])))
  for (const issue of plan.queue?.open ?? []) statuses.set(issue.id, issue.status ?? NOT_STARTED)
  for (const issue of plan.queue?.archived ?? []) statuses.set(issue.id, DONE)
  for (const issue of [...(plan.queue?.open ?? []), ...(plan.queue?.archived ?? [])])
    titles.set(issue.id, issue.title ?? '')
  return {
    statuses,
    titles,
    merged,
    tags: tagsOf(run),
    lockOf: lockOf ?? ((repo) => (repo === HOME_REPO ? readLock(root) : undefined)),
    pullRequestsOf,
    releaseRows: plan.releaseRows,
    phases: plan.phases
  }
}

/** The ids that a release row names, in order; a "Phase N" token is the tasks of that phase in its own order. */
export function releaseIds(version, facts) {
  const row = facts.releaseRows.find((each) => each.release.replace(/`/g, '') === version)
  return (row ? tokensOf(row.tasks) : []).flatMap((token) =>
    typeof token === 'string'
      ? [token]
      : phaseSequence(facts.phases.find((phase) => phase.number === token.phase) ?? { tasks: [], order: null })
  )
}

/** The ids that a step builds: those of its releases in the order of the releases file, then the ids and phases it names; no duplicates. */
export function stepIds(step, facts) {
  const phaseIds = step.phases.flatMap((number) =>
    phaseSequence(facts.phases.find((phase) => phase.number === number) ?? { tasks: [], order: null })
  )
  return [...new Set([...step.versions.flatMap((version) => releaseIds(version, facts)), ...phaseIds, ...step.ids])]
}

// An id as the status shows it: its mark in the plan, and whether a merged pull request carries it
function idState(id, facts) {
  const mark = facts.statuses.get(id)
  const merged = facts.merged === null ? null : facts.merged.has(id)
  return { id, mark: mark ?? null, merged, done: mark === DONE && merged !== false }
}

const describeId = ({ id, mark, merged }) =>
  mark === null
    ? `${id} unknown`
    : `${id} ${mark}${mark === DONE && merged === false ? ' (no merged pull request)' : ''}`

// The state of a step that builds ids: done when every id is done and merged, running when any has started, else not started
function idsTruth(ids, facts) {
  if (!ids.length) return { state: null, evidence: 'its scope names no id, so nothing can be recomputed' }
  const states = ids.map((id) => idState(id, facts))
  const evidence = states.map(describeId).join(', ')
  if (states.every((each) => each.done)) return { state: DONE, evidence }
  const started = states.some((each) => each.done || each.mark === RUNNING || each.merged === true)
  return { state: started ? RUNNING : NOT_STARTED, evidence }
}

function cutTruth(step, facts) {
  const version = step.versions[0]
  if (!version) return { state: null, evidence: 'its scope names no version' }
  if (facts.tags === null) return { state: null, evidence: 'the tags cannot be read' }
  const tag = [`v${version}`, version].find((name) => facts.tags.has(name))
  return tag
    ? { state: DONE, evidence: `the tag ${tag} exists` }
    : { state: NOT_STARTED, evidence: `no tag v${version} or ${version}` }
}

function takeTruth(step, facts) {
  const version = step.versions[0]
  if (!version) return { state: null, evidence: 'its scope names no version' }
  const lock = facts.lockOf(step.repo)
  if (lock === undefined)
    return { state: null, evidence: `the lock of the repository "${step.repo}" cannot be read from here` }
  if (lock === null) return { state: NOT_STARTED, evidence: `the repository "${step.repo}" has no lock` }
  if (lock.version === version) return { state: DONE, evidence: `the lock of "${step.repo}" names ${version}` }
  const base = `the lock of "${step.repo}" names ${lock.version}, not ${version}`
  // A later take supersedes this one: the lock names a later version, so this take is done when its pull request is merged or closed (or cannot be asked about)
  const later = compareVersions(lock.version, version) > 0
  const superseded = `the lock of "${step.repo}" names ${lock.version}, a later version than ${version}`
  // An external repository is read through the host, so its pull requests that mention the version say whether the step has begun
  const found = step.repo === HOME_REPO ? undefined : facts.pullRequestsOf?.(step.repo, version)
  if (!found) return later ? { state: DONE, evidence: superseded } : { state: NOT_STARTED, evidence: base }
  if (found.error && later) return { state: DONE, evidence: superseded }
  if (found.error)
    return { state: NOT_STARTED, evidence: `${base}; its pull requests could not be read (${found.error})` }
  // A search matches the body too, and a plan document may mention a version: only a pull request whose title names it is the one that takes it
  const named = found.pullRequests.filter((pr) => namesVersion(pr.title ?? '', version))
  const open = named.filter((pr) => pr.state === 'open')
  if (open.length)
    return {
      state: RUNNING,
      evidence: `${base}; ${open.map((pr) => `pull request #${pr.number} (${pr.title}) is open`).join(', ')}`
    }
  const merged = named.filter((pr) => pr.state === 'merged')
  if (later && merged.length)
    return { state: DONE, evidence: `${superseded}; pull request #${merged[0].number} (${merged[0].title}) is merged` }
  // A closed draft is the way a development take ends when a later take supersedes it
  const closed = named.filter((pr) => pr.state === 'closed')
  if (later && closed.length)
    return { state: DONE, evidence: `${superseded}; pull request #${closed[0].number} (${closed[0].title}) is closed` }
  return {
    state: NOT_STARTED,
    evidence: merged.length
      ? `${base}; pull request #${merged[0].number} (${merged[0].title}) is merged, but the lock on the default branch does not name ${version} yet`
      : `${base}; no pull request names ${version} in its title`
  }
}

/** The state of one step from the repository: `{ state, evidence }`, with `state` null where the repository cannot say (a decision, a custom step). */
export function stepTruth(step, facts) {
  if (step.kind === 'tasks' || step.kind === 'triage-fix') return idsTruth(stepIds(step, facts), facts)
  if (step.kind === 'cut') return cutTruth(step, facts)
  if (step.kind === 'consumer-take') return takeTruth(step, facts)
  return { state: null, evidence: `a ${step.kind} step leaves nothing in the repository to recompute from` }
}

/** The entries of a log as `{ heading, kind, step, status, at }`, oldest first; kind is running, started, ended, decision or stop. */
export function logEntries(logText) {
  return logHeadings(logText ?? '').flatMap((heading) => {
    const found = heading.match(ENTRY_HEADING)
    if (!found) return []
    const what = found[3]
    const kind = what.startsWith('step') ? (what.includes(' started') ? 'started' : 'ended') : what.split(/[ :]/)[0]
    return [
      { heading, kind, step: found[4] ?? found[5] ?? null, status: found[6] ?? null, at: `${found[1]} ${found[2]}` }
    ]
  })
}

// What the newest entries of the log say: the step left open (started, never ended, no stop after it), the claim (a running entry no stop follows)
function logTruth(entries) {
  const last = (kind) => entries.findLastIndex((entry) => entry.kind === kind)
  const stop = last('stop')
  const running = last('running')
  const claimed = running > stop
  const started = entries.findLastIndex((entry) => entry.kind === 'started')
  const open =
    started >= 0 &&
    started > stop &&
    !entries.slice(started + 1).some((entry) => entry.kind === 'ended' && entry.step === entries[started].step)
  return {
    claimed,
    claimedAt: claimed ? entries[running].at : null,
    open: open ? entries[started] : null,
    ended: Object.fromEntries(
      entries.filter((entry) => entry.kind === 'ended').map((entry) => [entry.step, entry.status])
    )
  }
}

// The state of the step to go by: the repository where it can say, else the mark of the column
function effectiveOf(marked, computed) {
  if (computed === null) return marked
  if (computed === DONE || computed === RUNNING) return computed
  return WAITING.includes(marked) ? marked : computed
}

// How the mark and the repository disagree, or null. A step the owner or a blocker holds (⏸, ⛔) is not a mismatch while the repository shows it undone.
function mismatchOf(marked, computed) {
  if (computed === null || marked === computed) return null
  if (WAITING.includes(marked) && computed !== DONE) return null
  return `marked ${marked || 'empty'}, the repository shows ${computed}`
}

/**
 * The truth of a flow: `{ steps, mismatches, claim, open, next, finished }`. Each step is `{ id, kind, marked, computed, evidence, state, mismatch }`; `next` is
 * the first step that is not done and whose `Needs` are, or null; `finished` when every step is done. `entries` are those of `logEntries`.
 */
export function flowTruth(flow, facts, entries = []) {
  const log = logTruth(entries)
  const steps = flow.steps.map((step) => {
    const { state: computed, evidence } = stepTruth(step, facts)
    return {
      id: step.id,
      kind: step.kind,
      step,
      marked: step.state,
      computed,
      evidence,
      state: effectiveOf(step.state, computed),
      mismatch: mismatchOf(step.state, computed)
    }
  })
  const done = new Set(steps.filter((each) => each.state === DONE).map((each) => each.id))
  const mismatches = steps
    .filter((each) => each.mismatch)
    .map((each) => `step ${each.id}: ${each.mismatch} (${each.evidence})`)
  for (const each of steps) {
    if (log.ended[each.id] === 'done' && each.computed !== null && each.computed !== DONE) {
      mismatches.push(
        `step ${each.id}: the log says it ended done, the repository shows ${each.computed} (${each.evidence})`
      )
    }
  }
  if (log.open) {
    const state = steps.find((each) => each.id === log.open.step)
    mismatches.push(
      `step ${log.open.step}: the log has "step ${log.open.step} started" (${log.open.at}) and no end or stop after it; an orchestrator stopped in the middle of it, and the repository shows ${state?.computed ?? state?.marked ?? 'nothing'}`
    )
  }
  const next = steps.find((each) => each.state !== DONE && each.step.needs.every((need) => done.has(need))) ?? null
  return {
    steps,
    mismatches,
    claim: log.claimed ? log.claimedAt : null,
    open: log.open,
    next,
    finished: steps.length > 0 && steps.every((each) => each.state === DONE)
  }
}
