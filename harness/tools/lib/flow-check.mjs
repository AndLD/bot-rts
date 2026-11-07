// `harness flow check` (task 5.4; part of `harness check all`): the parts of a flow file and of its log, the ids of its steps, what its steps and its flows
// need, and that the flows index agrees with the files. Pure functions on the flows `readFlows` read and on facts of the plan the caller gathers: the
// names of the releases, the ids of the tasks and issues. `checkFlows` reads them from a project.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { repoSettingsProblems, stepRepoProblems } from './flow-repos.mjs'
import {
  EXECUTORS,
  LEVELS,
  STEP_ID,
  STEP_KINDS,
  isInserted,
  plannedExecutor,
  readExecutorField,
  stepById
} from './flow-steps.mjs'
import { readFlowsOf, withFlowsTable } from './flows.mjs'
import { readReleases } from './releases.mjs'
import { planPhases, readBacklogOf, readQueueOf } from './plan.mjs'

export const LOG_TITLE = /^# Flow (\d+) — (.+) — log$/m
// An entry of the log: `### 2026-11-04 10:30 — running`, `… — step 3 started`, `… — step 3 ended: done`, `… — decision D2: …`, `… — stop: …`
export const ENTRY_HEADING =
  /^### (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) — (running|step (\d+[a-z]?) started|step (\d+[a-z]?) ended: (done|partial|blocked)|decision (D[0-4]): .+|stop: .+)\s*$/
const SETTING_VALUES = {
  executor: EXECUTORS,
  reuse: ['auto', 'never'],
  commits: ['per-step', 'per-cut'],
  commands: ['any', 'plain']
}

/** The part of a log text under "## Entries", outside fenced blocks, split into its `###` headings: `[{ heading, line }]`. */
export function logHeadings(logText) {
  const from = logText.search(/^## Entries\b/m)
  if (from < 0) return []
  let fenced = false
  const found = []
  for (const line of logText.slice(from).split('\n')) {
    if (/^```/.test(line)) fenced = !fenced
    else if (!fenced && line.startsWith('### ')) found.push(line)
  }
  return found
}

/** The bullet lines of a log entry, from its heading to the next heading ('' when the heading is not in the log). */
export function entryBody(logText, heading) {
  const lines = logText.split('\n')
  const start = lines.indexOf(heading)
  if (start < 0) return ''
  const end = lines.findIndex((line, index) => index > start && line.startsWith('### '))
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n')
}

/** The value of the field `**<name>:**` of an entry's body, up to the next `·` or the end of its line; null when it has none. */
export const entryField = (body, name) =>
  body.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*([^·\\n]+)`))?.[1]?.trim() ?? null

// A "step started" entry whose worker ran on another executor than the step is planned for (the order of the executors: a fallback for one step at a
// time) must say whose fallback it is and why, so that a switch to the command line shows in the log (task 2.7)
function fallbackProblem(expected, flow, heading, body, stepId) {
  const step = stepById(flow.steps, stepId)
  const said = readExecutorField(entryField(body, 'Executor'))
  if (!step || !said.executor) return null
  const planned = plannedExecutor(flow, step)
  if (said.executor === planned || (said.fallbackOf && said.reason)) return null
  return `${expected}: the entry "${heading.slice(4, 60)}" names the executor ${said.executor}, but step ${stepId} is planned for ${planned}; write "**Executor:** ${said.executor}, the fallback of ${planned}: <the reason>" (\`harness flow dispatch\` prints the line)`
}

function settingsProblems(settings) {
  const problems = []
  if (!LEVELS.slice(1).includes(settings.askAt))
    problems.push(`the setting askAt "${settings.askAt}" is not one of D1 to D4`)
  for (const [kind, level] of Object.entries(settings.levels ?? {})) {
    if (!LEVELS.includes(level)) problems.push(`the level of "${kind}" is "${level}", not one of ${LEVELS.join(', ')}`)
  }
  for (const [name, allowed] of Object.entries(SETTING_VALUES)) {
    if (!allowed.includes(settings[name]))
      problems.push(`the setting ${name} "${settings[name]}" is not one of ${allowed.join(', ')}`)
  }
  const limits = settings.reuseLimits
  if (limits !== undefined && (typeof limits !== 'object' || limits === null || Array.isArray(limits)))
    problems.push('the setting reuseLimits is not an object')
  else {
    if (limits?.context !== undefined && !(limits.context > 0 && limits.context <= 100))
      problems.push('the reuse limit context must be a percent from 1 to 100')
    if (limits?.steps !== undefined && !(Number.isInteger(limits.steps) && limits.steps >= 1))
      problems.push('the reuse limit steps must be a whole number from 1')
    if (limits?.cacheMinutes !== undefined && !(Number.isFinite(limits.cacheMinutes) && limits.cacheMinutes >= 0))
      problems.push('the reuse limit cacheMinutes must be a number of minutes')
  }
  const permissions = settings.permissions
  if (permissions !== undefined) {
    if (typeof permissions !== 'object' || permissions === null || Array.isArray(permissions))
      problems.push('the setting permissions is not an object ({ "mode", "allow" })')
    else {
      if (permissions.mode !== undefined && !(typeof permissions.mode === 'string' && permissions.mode.trim()))
        problems.push('the permissions mode must be a name of the runtime')
      if (
        permissions.allow !== undefined &&
        !(
          Array.isArray(permissions.allow) && permissions.allow.every((tool) => typeof tool === 'string' && tool.trim())
        )
      )
        problems.push('the permissions allow must be a list of tools by name')
    }
  }
  const usage = settings.usage ?? {}
  if (usage.subscription !== undefined && !(typeof usage.subscription === 'string' && usage.subscription.trim()))
    problems.push('the usage subscription must be a name, or "local"')
  if (usage.safetyFactor !== undefined && !(Number.isFinite(usage.safetyFactor) && usage.safetyFactor >= 1))
    problems.push('the usage safetyFactor must be a number from 1')
  if (usage.maxWaitMinutes !== undefined && !(Number.isFinite(usage.maxWaitMinutes) && usage.maxWaitMinutes >= 0))
    problems.push('the usage maxWaitMinutes must be a number of minutes')
  const stop = usage.stopAt ?? {}
  if (stop.cost !== undefined && !(Number.isFinite(stop.cost) && stop.cost > 0))
    problems.push('the usage threshold cost must be an amount of money above 0')
  for (const window of ['fiveHour', 'weekly']) {
    if (!(stop[window] > 0 && stop[window] <= 100))
      problems.push(`the usage threshold ${window} must be a percent from 1 to 100`)
  }
  problems.push(...repoSettingsProblems(settings))
  return problems
}

function idProblems(step, { knownIds }) {
  const problems = []
  for (const id of step.ids) {
    if (/^B-\d+$/.test(id)) {
      problems.push(
        `step ${step.id} names the backlog item ${id}, which is not approved work: the owner promotes it into a task first`
      )
    } else if (!knownIds.has(id)) {
      problems.push(`step ${step.id} names ${id}, which is no task of the plan and no issue of the queue`)
    }
  }
  return problems
}

// What the scope of one step must hold, by its kind
function scopeProblems(step, flow, { releaseNames, knownIds, phaseNumbers }) {
  const at = `step ${step.id} (${step.kind})`
  const problems = []
  const declared = (version) =>
    !releaseNames.includes(version)
      ? `${at} names the release ${version}, which is not a row of the releases file`
      : !flow.releases.includes(version)
        ? `${at} names the release ${version}, which this flow does not declare in its "Releases"`
        : null
  const versions = step.versions.map(declared).filter(Boolean)
  if (step.kind === 'tasks' || step.kind === 'triage-fix') {
    problems.push(...versions, ...idProblems(step, { knownIds }))
    for (const phase of step.phases) {
      if (!phaseNumbers.has(phase)) problems.push(`${at} names Phase ${phase}, which the plan does not have`)
    }
    if (step.kind === 'tasks' && !step.versions.length && !step.ids.length && !step.phases.length) {
      problems.push(`${at} names nothing to build: its scope holds a release in backticks, or task and issue ids`)
    }
  } else if (step.kind === 'cut' || step.kind === 'consumer-take') {
    if (step.versions.length !== 1)
      problems.push(`${at} names ${step.versions.length} versions; its scope is exactly one version in backticks`)
    else problems.push(...versions)
  }
  if (step.executor && !EXECUTORS.includes(step.executor)) {
    problems.push(`${at} overrides the executor with "${step.executor}", not one of ${EXECUTORS.join(', ')}`)
  }
  return problems
}

function stepsProblems(flow, facts) {
  const problems = []
  const seen = new Set()
  let lastNumber = 0
  let lastSuffix = ''
  flow.steps.forEach((step, index) => {
    if (!STEP_ID.test(step.id)) {
      problems.push(`step "${step.id}" has an id that is not a number with an optional letter (6, 6c)`)
      return
    }
    if (seen.has(step.id)) problems.push(`step ${step.id} appears twice; step ids are unique`)
    seen.add(step.id)
    if (step.number < lastNumber) {
      problems.push(
        `step ${step.id} comes after step ${lastNumber}${lastSuffix}; the ids follow the order of the table`
      )
    }
    if (isInserted(step)) {
      const base = flow.steps.slice(0, index).filter((other) => other.number === step.number)
      if (!base.length)
        problems.push(`step ${step.id} is an inserted step, but no step ${step.number} stands before it`)
      else if (step.number === lastNumber && step.suffix <= lastSuffix && lastSuffix !== '') {
        problems.push(`step ${step.id} is inserted after step ${lastNumber}${lastSuffix}; the suffixes rise (6b, 6c)`)
      }
    }
    lastNumber = step.number
    lastSuffix = step.suffix
    if (!STEP_KINDS.includes(step.kind)) {
      problems.push(`step ${step.id} has the kind "${step.kind}", not one of ${STEP_KINDS.join(', ')}`)
    }
    problems.push(...stepRepoProblems(step, flow.settings))
    for (const need of step.needs) {
      const earlier = flow.steps.slice(0, index).some((other) => other.id === need)
      if (!earlier) {
        problems.push(
          `step ${step.id} needs step ${need}, which ${flow.steps.some((other) => other.id === need) ? 'comes after it' : 'does not exist'}; a step needs steps before it`
        )
      }
    }
    problems.push(...scopeProblems(step, flow, facts))
    if (step.kind === 'custom' && !new RegExp(`^## Step ${step.id}\\b`, 'm').test(flow.text)) {
      problems.push(
        `step ${step.id} is a custom step, but the flow has no section "## Step ${step.id}" with its prompt`
      )
    }
    if (step.kind !== 'custom' && new RegExp(`^## Step ${step.id}\\b`, 'm').test(flow.text)) {
      problems.push(
        `step ${step.id} is not a custom step, but the flow holds a section "## Step ${step.id}"; only a custom step carries its own prompt`
      )
    }
  })
  return problems
}

// The parts of the log: it exists beside the flow, has its title, an "Entries" section whose headings are well formed and name steps of the flow
function logProblems(flow, logText) {
  const expected = flow.file.replace(/\.md$/, '.log.md')
  const link = flow.text.match(/\*\*Log:\*\*\s*\[[^\]]*\]\(([^)]+)\)/)?.[1]
  const problems = []
  if (link === undefined) problems.push(`has no "**Log:**" link to ${expected}`)
  else if (link.replace(/^\.\//, '') !== expected)
    problems.push(`its "**Log:**" link points to ${link}, not to ${expected}`)
  if (logText === null) return [...problems, `has no log ${expected} beside it`]
  const title = logText.match(LOG_TITLE)
  if (!title) problems.push(`${expected} has no title "# Flow <n> — <title> — log"`)
  else if (Number(title[1]) !== flow.number)
    problems.push(`${expected} is titled for flow ${title[1]}, not flow ${flow.number}`)
  if (!/^## Entries\b/m.test(logText)) problems.push(`${expected} has no "## Entries" section`)
  const ids = new Set(flow.steps.map((step) => step.id))
  for (const heading of logHeadings(logText)) {
    const entry = heading.match(ENTRY_HEADING)
    if (!entry) {
      problems.push(
        `${expected}: the entry "${heading.slice(4, 60)}" does not read "### YYYY-MM-DD HH:MM — running | step <#> started | step <#> ended: <status> | decision <D0-D4>: <question> | stop: <why>"`
      )
    } else if ((entry[4] ?? entry[5]) && !ids.has(entry[4] ?? entry[5])) {
      problems.push(
        `${expected}: the entry "${heading.slice(4, 60)}" names step ${entry[4] ?? entry[5]}, which the flow does not have`
      )
    } else if (entry[4]) {
      const problem = fallbackProblem(expected, flow, heading, entryBody(logText, heading), entry[4])
      if (problem) problems.push(problem)
    }
  }
  return problems
}

// The needs of the flows: each names a flow that exists, not itself, and the chain never returns to a flow
function flowNeedsProblems(flow, flows) {
  const byNumber = new Map(flows.map((each) => [each.number, each]))
  const problems = []
  for (const need of flow.needs) {
    if (need === flow.number) problems.push(`needs itself`)
    else if (!byNumber.has(need)) problems.push(`needs flow ${need}, which does not exist`)
  }
  const reach = (number, path) =>
    (byNumber.get(number)?.needs ?? []).some(
      (next) => next === flow.number || (!path.has(next) && reach(next, new Set([...path, next])))
    )
  if (!problems.length && reach(flow.number, new Set([flow.number]))) {
    problems.push('needs a flow that needs it back; the needs of flows point backwards, never in a circle')
  }
  return problems
}

/**
 * The problems of the flows of a plan (task 5.4), each as `<folder>/<file>: …`. `facts` holds what the plan says: `releaseNames` (the rows of the releases
 * file), `knownIds` (the ids of its tasks and of the issues of the queue) and `phaseNumbers`; `logs` maps a flow file to the text of its log, null when missing.
 * The parts the summary already holds (a release in two flows, a stale index) are `flowsProblems` of `flows.mjs`; the index is compared here too.
 */
export function flowProblems({ dir, readme, flows }, facts, logs) {
  const problems = []
  for (const flow of flows) {
    const own = [
      ...flowNeedsProblems(flow, flows),
      ...settingsProblems(flow.settings),
      ...stepsProblems(flow, facts),
      ...logProblems(flow, logs[flow.file] ?? null)
    ]
    problems.push(...own.map((problem) => `${dir}/${flow.file}: ${problem}`))
  }
  const expected = withFlowsTable(readme, flows)
  if (expected === null) {
    problems.push(
      `${dir}/README.md: the flows table must sit between <!-- flows-index:start --> and <!-- flows-index:end -->`
    )
  } else if (expected !== readme) {
    problems.push(`${dir}/README.md: the flows table disagrees with the flow files; run \`harness plan summary\``)
  }
  return problems
}

/** The facts of a project's plan that the checks and the status need: the names of its releases, its task and issue ids, its phase numbers. */
export function planFacts({ root, profile }) {
  const releasesPath = profile.paths.releases
  const releaseRows =
    releasesPath && existsSync(join(root, releasesPath))
      ? readReleases(readFileSync(join(root, releasesPath), 'utf8')).rows
      : []
  const phases = planPhases({ root, profile })
  const queue = readQueueOf(root, profile)
  return {
    releaseRows,
    releaseNames: releaseRows.map((row) => row.release.replace(/`/g, '')),
    knownIds: new Set([
      ...phases.flatMap((phase) => phase.tasks.map((task) => task.id)),
      ...[...(queue?.open ?? []), ...(queue?.archived ?? [])].flatMap((issue) => [issue.id])
    ]),
    phaseNumbers: new Set(phases.map((phase) => phase.number)),
    phases,
    queue,
    backlog: readBacklogOf(root, profile)
  }
}

/** The check `flows` of `harness check`: `{ problems, message }`; a project without flows has nothing to check. */
export function checkFlows({ root, profile }) {
  const read = readFlowsOf(root, profile)
  if (!read) return { problems: [], message: 'The profile file names no flows folder, so there are no flows to check.' }
  const logs = Object.fromEntries(
    read.flows.map((flow) => {
      const path = join(root, read.dir, flow.file.replace(/\.md$/, '.log.md'))
      return [flow.file, existsSync(path) ? readFileSync(path, 'utf8') : null]
    })
  )
  return {
    problems: flowProblems(read, planFacts({ root, profile }), logs),
    message: `Checked ${read.flows.length} flow(s): their parts, their steps, what they need and their logs.`
  }
}
