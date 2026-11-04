// The GitHub host adapter's reports (design §4.3, role "reports", task 3.16): the reports of users are GitHub issues, read and written with the `gh` command
// line. Every function takes `slug` (owner/name) and the `cli(args, input) → { status, stdout, stderr }` seam that tests replace; a failure throws with what gh said.
import { runGh } from './protect.mjs'

const FIELDS = 'number,title,url,state,body,createdAt,labels'

function ask(cli, args, input) {
  const answer = cli(args, input)
  if (answer.status !== 0) {
    throw new Error(`gh ${args.slice(0, 2).join(' ')} failed: ${(answer.stderr || answer.stdout).trim()}`)
  }
  return answer.stdout
}

const shape = (report) => ({
  number: report.number,
  title: report.title,
  url: report.url,
  state: String(report.state).toLowerCase(),
  body: report.body ?? '',
  createdAt: report.createdAt,
  labels: (report.labels ?? []).map((label) => label.name ?? label)
})

/** The open reports of the repository, oldest first. */
export function listReports({ slug, cli = (args, input) => runGh(args, input) }) {
  const reports = JSON.parse(
    ask(cli, ['issue', 'list', '--repo', slug, '--state', 'open', '--limit', '200', '--json', FIELDS])
  )
  return reports.map(shape).sort((a, b) => a.number - b.number)
}

/** The reports (open and closed) that match `text`. */
export function searchReports({ slug, text, cli = (args, input) => runGh(args, input) }) {
  const reports = JSON.parse(
    ask(cli, ['issue', 'list', '--repo', slug, '--state', 'all', '--search', text, '--limit', '30', '--json', FIELDS])
  )
  return reports.map(shape)
}

/** One report by its number. */
export function showReport({ slug, number, cli = (args, input) => runGh(args, input) }) {
  return shape(JSON.parse(ask(cli, ['issue', 'view', String(number), '--repo', slug, '--json', FIELDS])))
}

/** Creates a report; returns its address. */
export function createReport({ slug, title, body, cli = (args, input) => runGh(args, input) }) {
  return ask(cli, ['issue', 'create', '--repo', slug, '--title', title, '--body-file', '-'], body).trim()
}

/** Adds a comment to a report. */
export function commentReport({ slug, number, body, cli = (args, input) => runGh(args, input) }) {
  ask(cli, ['issue', 'comment', String(number), '--repo', slug, '--body-file', '-'], body)
}

/** Closes a report. */
export function closeReport({ slug, number, cli = (args, input) => runGh(args, input) }) {
  ask(cli, ['issue', 'close', String(number), '--repo', slug])
}

/** The slug (owner/name) of the repository at a web or Git address on GitHub, or null when it is none. */
export function slugOfUrl(url) {
  return /^(?:https:\/\/|git@)github\.com[/:]([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/.exec(url ?? '')?.[1] ?? null
}
