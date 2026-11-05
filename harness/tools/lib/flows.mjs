// The flows of a plan (task 5.2; the profile role `paths.flows`): files `flow-<n>-<slug>.md` beside their logs in one folder, each an ordered chain of steps
// that delivers one or more releases, run by an orchestrator with the procedure `run-flow`. This module reads what the index of the folder shows (the
// releases, the mode of the settings block, the size and the estimated usage of the steps, a status worked out from their State column) and writes that
// index, which `harness plan summary` calls. The deeper checks of a flow (the ids of its steps, its `Needs`, its log) are `harness flow check` (task 5.4).
// Pure functions on texts; the reading of the folder is `readFlows`, whose seams are `list` and `readText`.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { parseSteps } from './flow-steps.mjs'
import { inFramework } from './lock.mjs'
import { render } from './render.mjs'

export const FLOWS_START = '<!-- flows-index:start -->'
export const FLOWS_END = '<!-- flows-index:end -->'
export const FLOW_FILE = /^flow-(\d+)-[a-z0-9][a-z0-9-]*\.md$/
export const FLOW_MODES = Object.freeze(['brainstorm', 'seamless'])
/** The settings a flow takes when its block leaves one out (the flow template and the procedure `run-flow`). */
export const FLOW_DEFAULTS = Object.freeze({
  mode: 'brainstorm',
  askAt: 'D2',
  levels: {
    'cut.development': 'D1',
    'cut.final': 'D3',
    'cut.hotfix': 'D3',
    'reports.answer': 'D4',
    'reports.close': 'D4'
  },
  executor: 'session',
  reuse: 'auto',
  reuseLimits: { context: 40, steps: 3 },
  commits: 'per-step',
  usage: { subscription: 'local', stopAt: { fiveHour: 85, weekly: 90 }, safetyFactor: 1.2, maxWaitMinutes: 300 },
  repos: { home: '.' }
})
/** The state of a step, as the legend of the flow template says it; a flow's status is worked out from them. */
export const STEP_STATES = {
  '⬜': 'not started',
  '🟡': 'running',
  '⏸': 'waits for the owner',
  '⛔': 'blocked',
  '✅': 'done'
}

const SEPARATOR = /^\|\s*[-: |]+\|?\s*$/
const VERSION = /`([^`]+)`/g
const cellsOf = (line) =>
  line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim())

// The rows of the steps table (the first table whose first column is "#" under "## Steps"), each as an object keyed by the lowercased column names
function stepRows(text) {
  const lines = text.slice(Math.max(0, text.search(/^## Steps\b/m))).split('\n')
  const header = lines.findIndex((line) => line.startsWith('|') && cellsOf(line)[0] === '#')
  if (header < 0) return null
  const names = cellsOf(lines[header]).map((name) => name.toLowerCase())
  const rows = []
  for (const line of lines.slice(header + 1)) {
    if (!line.startsWith('|')) break
    if (SEPARATOR.test(line)) continue
    const cells = cellsOf(line)
    rows.push(Object.fromEntries(names.map((name, index) => [name, cells[index] ?? ''])))
  }
  return rows
}

// The settings block: the first fenced JSON block under "## Settings", over the defaults
function settingsOf(text, problems) {
  const section = text.slice(Math.max(0, text.search(/^## Settings\b/m)))
  const block = /^## Settings\b/m.test(text) ? section.match(/```json\n([\s\S]*?)\n```/) : null
  if (!block) {
    problems.push('has no settings block (a fenced JSON block under "## Settings")')
    return { ...FLOW_DEFAULTS }
  }
  try {
    const given = JSON.parse(block[1])
    // `usage` is merged one level deeper, so a flow that sets its subscription or one threshold keeps the defaults of the others
    const usage = given.usage && typeof given.usage === 'object' && !Array.isArray(given.usage) ? given.usage : {}
    const settings = {
      ...FLOW_DEFAULTS,
      ...given,
      usage: { ...FLOW_DEFAULTS.usage, ...usage, stopAt: { ...FLOW_DEFAULTS.usage.stopAt, ...usage.stopAt } },
      // `repos` too: the home repository is always there, the external ones are the flow's rows
      repos:
        given.repos && typeof given.repos === 'object' && !Array.isArray(given.repos)
          ? { ...FLOW_DEFAULTS.repos, ...given.repos }
          : given.repos === undefined
            ? FLOW_DEFAULTS.repos
            : given.repos
    }
    if (!FLOW_MODES.includes(settings.mode)) {
      problems.push(`the mode "${settings.mode}" is not one of ${FLOW_MODES.join(', ')}`)
    }
    return settings
  } catch (error) {
    problems.push(`the settings block is not valid JSON (${error.message})`)
    return { ...FLOW_DEFAULTS }
  }
}

/** The status of a flow from the states of its steps: one waiting or blocked step says so, all done is ✅, any other start is 🟡. */
export function flowStatus(states) {
  if (!states.length) return '⬜'
  for (const mark of ['⛔', '⏸']) if (states.includes(mark)) return mark
  if (states.every((state) => state === '✅')) return '✅'
  return states.every((state) => state === '⬜') ? '⬜' : '🟡'
}

/**
 * The flow in `text` (the file `file`): `{ number, title, file, text, releases, needs, settings, steps, size, usage, status, problems }`. The `steps` are
 * those of `flow-steps.mjs`; the size is the sum of the SP column; the usage the sum of the estimates in percent of the weekly window, `null` when no step has one, marked partial when some lack one.
 */
export function parseFlow(file, text) {
  const problems = []
  const name = file.match(FLOW_FILE)
  const title = text.match(/^# Flow (\d+) — (.+)$/m)
  if (!title) problems.push('has no title "# Flow <n> — <title>"')
  else if (name && Number(title[1]) !== Number(name[1]))
    problems.push(`the title says flow ${title[1]}, the file name flow ${name[1]}`)
  const field = (label) => text.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*([^·\\n]*)`))?.[1]?.trim() ?? null
  const releasesField = field('Releases')
  if (releasesField === null) problems.push('has no "**Releases:**" field')
  const releases = [...(releasesField ?? '').matchAll(VERSION)].map((match) => match[1])
  const needs = [...(field('Needs') ?? '').matchAll(/flow (\d+)/gi)].map((match) => Number(match[1]))
  const settings = settingsOf(text, problems)
  const rows = stepRows(text)
  if (!rows) problems.push('has no steps table (a table whose first column is "#" under "## Steps")')
  const steps = rows ?? []
  const numbers = (column) =>
    steps.map((row) => row[column]?.match(/^(\d+(?:\.\d+)?)/)?.[1]).map((n) => (n ? Number(n) : null))
  const sp = numbers('sp')
  const usage = steps
    .map((row) => row['est. usage']?.match(/^(\d+(?:\.\d+)?)\s*%/)?.[1])
    .map((n) => (n ? Number(n) : null))
  const known = usage.filter((n) => n !== null)
  const states = steps.map((row) => [...(row.state ?? '')][0] ?? '')
  const unknown = [...new Set(states.filter((state) => !(state in STEP_STATES)))]
  if (unknown.length) problems.push(`a step has a state that is not one of ${Object.keys(STEP_STATES).join(' ')}`)
  return {
    number: Number(name?.[1] ?? title?.[1] ?? 0),
    title: title?.[2]?.trim() ?? file,
    file,
    text,
    releases,
    needs,
    settings,
    steps: parseSteps(rows),
    size: sp.reduce((sum, n) => sum + (n ?? 0), 0),
    usage: known.length
      ? { percent: Math.round(known.reduce((sum, n) => sum + n, 0) * 10) / 10, partial: known.length < steps.length }
      : null,
    status: flowStatus(states),
    problems
  }
}

/** The flows of the folder `dir`, by number; `null` when the folder has no index (`README.md`). */
export function readFlows({ dir, list, readText }) {
  const names = list(dir)
  if (!names.includes('README.md')) return null
  const flows = names
    .filter((name) => FLOW_FILE.test(name))
    .map((name) => parseFlow(name, readText(`${dir}/${name}`)))
    .sort((a, b) => a.number - b.number)
  return { dir, readme: readText(`${dir}/README.md`), flows }
}

/** The table of the flows index: one row per flow, linked to its file. */
export function flowsTable(flows) {
  if (!flows.length) return 'No flow yet.'
  const usage = (flow) =>
    flow.usage ? `${flow.usage.percent}%${flow.usage.partial ? ' (some steps not estimated)' : ''}` : '—'
  return [
    '| Flow | Releases | Mode | Size | Est. usage | Status |',
    '| ---- | -------- | ---- | ---- | ---------- | ------ |',
    ...flows.map(
      (flow) =>
        `| [${flow.number} — ${flow.title}](./${flow.file}) | ${flow.releases.map((release) => `\`${release}\``).join(', ') || '—'} | ${flow.settings.mode} | ${flow.size} SP | ${usage(flow)} | ${flow.status} |`
    )
  ].join('\n')
}

/** `text` with the flows table between its markers; `null` when the markers are missing. */
export function withFlowsTable(text, flows) {
  const from = text.indexOf(FLOWS_START)
  const to = text.indexOf(FLOWS_END)
  return from < 0 || to < from
    ? null
    : `${text.slice(0, from + FLOWS_START.length)}\n${flowsTable(flows)}\n${text.slice(to)}`
}

/**
 * The problems of the flows of a plan: those of each file, a release that two flows declare, and a release that the releases file does not hold
 * (`releaseNames`, `null` when the plan has no releases file).
 */
export function flowsProblems({ dir, flows }, releaseNames) {
  const problems = flows.flatMap((flow) => flow.problems.map((problem) => `${dir}/${flow.file}: ${problem}`))
  const owner = new Map()
  for (const flow of flows) {
    for (const release of flow.releases) {
      if (owner.has(release)) {
        problems.push(
          `${dir}/${flow.file}: the release ${release} is declared by flow ${owner.get(release)} too; a release belongs to at most one flow`
        )
      } else owner.set(release, flow.number)
      if (releaseNames && !releaseNames.includes(release)) {
        problems.push(`${dir}/${flow.file}: the release ${release} is not a row of the releases file`)
      }
    }
  }
  return problems
}

/** The sentence of the plan index's releases block that links the flows index. */
export function flowsLink(planIndex, dir) {
  const link = relative(dirname(planIndex), `${dir}/README.md`).split('\\').join('/')
  return `The flows that run them: [flows](${link.startsWith('.') ? link : `./${link}`}).`
}

/**
 * The flows folder of a project that sets `paths.flows` and has no index yet: the index from the scaffold template. `harness plan summary` calls it, so
 * setting the role and running the summary is all a project does.
 * @returns {string[]} what was created, for the output of the command
 */
export function ensureFlows({ root, profile }) {
  const dir = profile.paths?.flows
  if (!dir || existsSync(join(root, dir, 'README.md'))) return []
  const path = `${dir}/README.md`
  const template = readFileSync(join(root, inFramework(profile, 'core/templates/scaffold'), 'flows-index.md'), 'utf8')
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), render(template, profile, { document: path }))
  return [`Set up the flows: created ${path}.`]
}

/** The flows of a project from its folder, or `null` when the profile names none or the folder has no index. */
export function readFlowsOf(root, profile) {
  const dir = profile.paths?.flows
  if (!dir || !existsSync(join(root, dir))) return null
  return readFlows({
    dir,
    list: (path) => readdirSync(join(root, path)),
    readText: (path) => readFileSync(join(root, path), 'utf8')
  })
}
