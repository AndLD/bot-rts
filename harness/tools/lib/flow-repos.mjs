// The repositories of a flow (task 5.8). A flow belongs to its home repository; its `repos` setting may name external ones, each a row
// `{ "remote": "owner/name", "role": "consumer", "kinds": ["consumer-take"] }` under an alias that the Repo column of a step uses. In an external repository the
// orchestrator only starts a worker (the executor of task 5.5, in that repository's folder): it edits nothing there, the worker runs under that repository's own
// entry file and approvals, and the authority of a flow to cut releases and answer reports covers the home repository only. The folders on this machine are in
// the ignored `harness-profile.local.json`, `repos.<alias>`, since they differ per machine. Pure functions, but for the reading of the local file.
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { HOME_REPO } from './flow-steps.mjs'
import { LOCAL_OVERRIDE_FILE } from './reports.mjs'

/** What a worker may do in an external repository: take a version, or a custom step the flow writes out. Never a release cut, a task of the home plan or a report. */
export const EXTERNAL_KINDS = Object.freeze(['consumer-take', 'custom'])
/** The kinds an external repository allows when its row leaves `kinds` out. */
export const DEFAULT_EXTERNAL_KINDS = Object.freeze(['consumer-take'])
const REMOTE = /^[\w.-]+\/[\w.-]+$/

/**
 * The repositories of a flow's settings as rows: the home repository first, then each external one as `{ alias, remote, role, kinds }`.
 * A row that is not an object is kept with `invalid` naming why, so the check can say it.
 */
export function repoRows(settings) {
  const rows = [{ alias: HOME_REPO, home: true, remote: null, role: 'home', kinds: null }]
  for (const [alias, value] of Object.entries(settings?.repos ?? {})) {
    if (alias === HOME_REPO) continue
    const row = value && typeof value === 'object' && !Array.isArray(value) ? value : null
    rows.push({
      alias,
      home: false,
      remote: row?.remote ?? null,
      role: row?.role ?? null,
      kinds: row?.kinds ?? DEFAULT_EXTERNAL_KINDS,
      invalid: row ? null : 'is not a row { "remote", "role", "kinds" }; a path belongs in harness-profile.local.json'
    })
  }
  return rows
}

/** The row of `alias`, or undefined. */
export const repoRow = (settings, alias) => repoRows(settings).find((row) => row.alias === alias)

/** True when the step runs in an external repository. */
export const isExternal = (step) => step.repo !== HOME_REPO

/** The problems of the `repos` setting of a flow. */
export function repoSettingsProblems(settings) {
  const problems = []
  const repos = settings?.repos
  if (repos !== undefined && (typeof repos !== 'object' || repos === null || Array.isArray(repos)))
    return ['the setting repos is not an object of repositories by alias']
  if (repos?.[HOME_REPO] !== undefined && repos[HOME_REPO] !== '.')
    problems.push(
      `the home repository is "." (the repository the flow lives in); a repository elsewhere is an external one`
    )
  for (const row of repoRows(settings).filter((each) => !each.home)) {
    const at = `the repository "${row.alias}"`
    if (row.invalid) {
      problems.push(`${at} ${row.invalid}`)
      continue
    }
    if (!REMOTE.test(row.remote ?? '')) problems.push(`${at} has no remote "owner/name"`)
    if (typeof row.role !== 'string' || !row.role.trim()) problems.push(`${at} has no role (consumer)`)
    if (!Array.isArray(row.kinds) || !row.kinds.length) problems.push(`${at} allows no step kind`)
    else
      for (const kind of row.kinds) {
        if (!EXTERNAL_KINDS.includes(kind))
          problems.push(
            `${at} allows the kind "${kind}"; only ${EXTERNAL_KINDS.join(' and ')} run in an external repository (a release cut and the answers to reports are the home repository's, and a task is named by the plan that holds it)`
          )
      }
  }
  return problems
}

/** The problems of one step against the repositories of its flow: its repo is a row, its kind is allowed there, and its scope names no id of another plan. */
export function stepRepoProblems(step, settings) {
  const row = repoRow(settings, step.repo)
  const at = `step ${step.id}`
  if (!row) {
    const known = repoRows(settings).map((each) => each.alias)
    return [
      `${at} names the repository "${step.repo}", which the flow's "repos" setting does not hold (${known.join(', ')})`
    ]
  }
  if (row.home || row.invalid) return []
  const problems = []
  if (!EXTERNAL_KINDS.includes(step.kind))
    problems.push(
      `${at} is a ${step.kind} step in the repository "${row.alias}"; only ${EXTERNAL_KINDS.join(' and ')} run in an external repository (a release cut and the answers to reports are the home repository's)`
    )
  else if (Array.isArray(row.kinds) && !row.kinds.includes(step.kind))
    problems.push(
      `${at} is a ${step.kind} step in the repository "${row.alias}", which allows ${row.kinds.join(', ') || 'no kind'} there`
    )
  if (step.ids.length || step.phases.length)
    problems.push(
      `${at} runs in the repository "${row.alias}" and names ${[...step.ids, ...step.phases.map((n) => `Phase ${n}`)].join(', ')}; the plan of that repository is its own: name the work by what it does ("take \`1.0.0\`"), never by task ids`
    )
  return problems
}

/**
 * The folders of the repositories on this machine: the home repository is the project root, an external one is `repos.<alias>` of the ignored local profile
 * file (relative to the project root, or absolute). An alias without a folder is absent.
 * @returns {Record<string, string>}
 */
export function localRepoPaths(root, settings) {
  const paths = { [HOME_REPO]: '.' }
  const file = join(root, LOCAL_OVERRIDE_FILE)
  let local = {}
  try {
    local = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
  } catch {
    local = {}
  }
  for (const row of repoRows(settings).filter((each) => !each.home)) {
    const path = local?.repos?.[row.alias]
    if (typeof path === 'string' && path.trim()) paths[row.alias] = isAbsolute(path) ? path : resolve(root, path)
  }
  return paths
}

/** The words of a step's prompt about its repository: none for the home repository, else the alias and where it is. */
export function repoWords(step, settings, paths) {
  const row = repoRow(settings, step.repo)
  if (!row || row.home) return { repo: undefined, repoPath: undefined, remote: undefined, external: false }
  const where = paths[row.alias]
  return {
    repo: row.alias,
    remote: row.remote ?? undefined,
    repoPath: [row.remote, where ? `at ${where}` : null].filter(Boolean).join(', ') || undefined,
    external: true
  }
}
