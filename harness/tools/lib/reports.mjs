// The reports of users on the repository host (task 3.16), as the tools reason about them without the host: the effective switches (the profile file's
// `reports` under a local, ignored override), which reports are not yet triaged, the candidates a report is compared with in the plan's indexes, and what a
// triage verdict does. The host is only asked through its adapter (`reports` role), in `reports-command.mjs`.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { compareVersions } from './versions.mjs'

export const LOCAL_OVERRIDE_FILE = 'harness-profile.local.json'
export const INTAKE = Object.freeze(['off', 'notify', 'auto'])
export const UPSTREAM = Object.freeze(['off', 'ask', 'post'])
export const DEFAULT_LIMIT = 3

/**
 * The switches that apply now: the `reports` of the profile file, overridden by the same keys of the local file (which the owner changes on this machine
 * without a pull request), and forced `off` where the host adapter cannot list reports (`capable` false). A value that is not valid is ignored, and said.
 * @returns {{ intake: string, triageLimit: number, upstream: string, notes: string[] }}
 */
export function reportSettings({ profile, root, capable = true }) {
  const notes = []
  const settings = { intake: 'off', triageLimit: DEFAULT_LIMIT, upstream: 'off', ...profile.reports }
  const path = root ? join(root, LOCAL_OVERRIDE_FILE) : null
  if (path && existsSync(path)) {
    try {
      const local = JSON.parse(readFileSync(path, 'utf8')).reports ?? {}
      for (const [key, valid] of [
        ['intake', (value) => INTAKE.includes(value)],
        ['upstream', (value) => UPSTREAM.includes(value)],
        ['triageLimit', (value) => Number.isInteger(value) && value >= 1]
      ]) {
        if (local[key] === undefined) continue
        if (valid(local[key])) settings[key] = local[key]
        else notes.push(`${LOCAL_OVERRIDE_FILE}: reports.${key} "${local[key]}" is not valid and is ignored`)
      }
    } catch {
      notes.push(`${LOCAL_OVERRIDE_FILE}: not valid JSON, so it is ignored`)
    }
  }
  if (!capable && (settings.intake !== 'off' || settings.upstream !== 'off')) {
    notes.push('the host adapter has no `reports` role, so the intake and the upstream switches stay off')
    return { ...settings, intake: 'off', upstream: 'off', notes }
  }
  return { ...settings, notes }
}

const NUMBER = /(?:issues\/|#)(\d+)\b/g

/** The numbers of the reports that the plan records: in the `Reported:` lines of the issues (open and archived), and in the text of the given tasks. */
export function recordedReports({ queue, taskTexts = [] }) {
  const numbers = new Set()
  const texts = [
    ...(queue ? [...queue.open, ...queue.archived].map((issue) => issue.reported ?? '') : []),
    ...taskTexts
  ]
  for (const text of texts) {
    for (const match of text.matchAll(NUMBER)) numbers.add(Number(match[1]))
  }
  return numbers
}

/** The reports that no issue and no task records yet, oldest first. */
export const untriaged = (reports, recorded) =>
  reports.filter((report) => !recorded.has(report.number)).sort((a, b) => a.number - b.number)

/** The reports to triage in this session, and how many wait for the next one. */
export function selectForTriage(reports, limit = DEFAULT_LIMIT) {
  return { now: reports.slice(0, limit), waiting: Math.max(0, reports.length - limit) }
}

/** The lines the session start prints for the intake; empty when it is off. */
export function intakeLines({ settings, reports, recorded, error }) {
  if (settings.intake === 'off') {
    return []
  }
  if (error) {
    return [`Reports: could not be read from the host (${error}).`]
  }
  const waiting = untriaged(reports, recorded)
  const list = (items) => items.map((report) => `#${report.number} ${report.title}`).join('; ')
  const lines = [
    `Reports: ${reports.length} open, ${waiting.length} not triaged yet${waiting.length ? ` (${list(waiting)})` : ''}.`
  ]
  if (settings.intake === 'auto' && waiting.length) {
    const { now, waiting: later } = selectForTriage(waiting, settings.triageLimit)
    lines.push(
      `Triage ${now.length === 1 ? 'it' : `the first ${now.length}`} before other work, by the procedure triage-reports (at most ${settings.triageLimit} a session${later ? `; ${later} wait` : ''}).`
    )
  } else if (settings.intake === 'notify' && waiting.length) {
    lines.push('Do not process them: the owner starts the triage (the procedure triage-reports).')
  }
  return lines
}

const STOP = new Set([
  'the',
  'and',
  'for',
  'that',
  'this',
  'with',
  'from',
  'when',
  'not',
  'are',
  'was',
  'has',
  'have',
  'its',
  'into',
  'than',
  'then',
  'but',
  'does',
  'did',
  'can',
  'will',
  'harness',
  'framework',
  'fails',
  'fail',
  'error'
])
const words = (text) =>
  new Set(
    (text.toLowerCase().match(/[a-z][a-z0-9.-]{2,}/g) ?? [])
      .map((word) => word.replace(/[.-]+$/, ''))
      .filter((word) => !STOP.has(word))
  )

/**
 * The things in the plan that a report may be about, best first: the open and archived issues (by title and area, the indexes) and the open tasks of the
 * phases (by title). Files are opened only for these candidates, afterwards.
 * @param {{ title: string, body?: string }} report
 * @returns {{ id: string, title: string, area?: string, where: 'open' | 'archive' | 'task', score: number }[]}
 */
export function candidates({ report, queue, tasks = [] }) {
  const mine = words(`${report.title} ${(report.body ?? '').slice(0, 400)}`)
  const rank = (title, area) => {
    const theirs = words(`${title} ${area ?? ''}`)
    const shared = [...theirs].filter((word) => mine.has(word)).length
    const areaHit = area && [...words(area)].some((word) => mine.has(word)) ? 1 : 0
    return shared + areaHit
  }
  const found = [
    ...(queue?.open ?? []).map((issue) => ({
      id: issue.id,
      title: issue.title,
      area: issue.area,
      where: 'open',
      score: rank(issue.title, issue.area)
    })),
    ...(queue?.archived ?? []).map((issue) => ({
      id: issue.id,
      title: issue.title,
      area: issue.area,
      where: 'archive',
      score: rank(issue.title, issue.area),
      fixedIn: issue.fixedIn
    })),
    ...tasks.map((task) => ({ id: task.id, title: task.title, where: 'task', score: rank(task.title) }))
  ]
  return found
    .filter(({ score }) => score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

/** The version a report says it was found in (`Version: 0.1.1`), or null. */
export const reporterVersion = (report) =>
  /\bversion\b\D{0,16}(\d+\.\d+\.\d+(?:-[\w.]+)?)/i.exec(`${report.title}\n${report.body ?? ''}`)?.[1] ?? null

export const RELATIONS = Object.freeze(['same', 'close', 'different', 'not-a-defect'])

/**
 * What the verdict on a report does. `relation` is the judgment of the agent: the report is `same` problem as the `candidate`, `close` to it but different,
 * `different` from every candidate (a new defect), or `not-a-defect`. Answers and closings on the host need the owner's approval; the plan's own files do not.
 * @returns {{ steps: string[], approval: boolean }}
 */
export function triagePlan({ relation, candidate, version = null }) {
  if (!RELATIONS.includes(relation)) {
    throw new Error(`the relation is one of ${RELATIONS.join(', ')}, not "${relation}"`)
  }
  if (relation === 'not-a-defect') {
    return {
      steps: [
        'answer the report with the reason (for an ordinary word: `terms.productGeneric` and the vocabulary of the framework)',
        'close it'
      ],
      approval: true
    }
  }
  if (relation === 'different' || !candidate) {
    return {
      steps: [
        'add a new issue to the queue, with the report in its `Reported:`',
        'answer the report with the issue and close it with the pull request that fixes it'
      ],
      approval: true
    }
  }
  if (relation === 'close') {
    return {
      steps: [
        `add a new issue to the queue that names the related ${candidate.id}, with the report in its \`Reported:\``,
        'answer the report with the new issue'
      ],
      approval: true
    }
  }
  if (candidate.where === 'archive') {
    const fixed = candidate.fixedIn
    if (fixed && version && compareVersions(version, fixed) >= 0) {
      return {
        steps: [
          `a regression: ${candidate.id} was fixed in ${fixed} and the reporter's version ${version} has the fix`,
          `add a new issue that links ${candidate.id}, with the report in its \`Reported:\``,
          'answer the report with the new issue'
        ],
        approval: true
      }
    }
    return {
      steps: [
        `add the report to the \`Reported:\` of ${candidate.id}`,
        fixed
          ? `answer the report: fixed in ${fixed}`
          : `answer the report: fixed already by ${candidate.id}, say in which version`
      ],
      approval: true
    }
  }
  return {
    steps: [
      `add the report to the \`Reported:\` of ${candidate.id}`,
      `answer the report as a duplicate of ${candidate.id}`
    ],
    approval: true
  }
}
