// `harness reports …` (task 3.16): the one way the procedures `triage-reports` and `report-upstream` reach the reports on the host, through the host
// adapter's `reports` role, so that the procedures stay neutral and the host is a seam. Reading is free; answering, closing and creating on the host need the
// owner's approval, which the agent states with `--approved` after it asked (the upstream `post` switch needs none for a new report).
import { hostModule } from './host.mjs'
import { openTasks, readBacklogOf, readQueueOf } from './plan.mjs'
import { readLock } from './lock.mjs'
import {
  RELATIONS,
  candidates,
  recordedReports,
  reportSettings,
  reporterVersion,
  selectForTriage,
  triagePlan,
  untriaged
} from './reports.mjs'

const line = (report) => `#${report.number} [${report.state}] ${report.title} (${report.url})`

/** True when the host adapter of the profile fills the `reports` role. */
export function hostReports(profile, hosts) {
  try {
    return hostModule(profile, 'reports', hosts)
  } catch {
    return null
  }
}

/**
 * @returns {{ lines: string[], code: number }}
 */
export function reportsCommand({ words, flags, root, profile, hosts, cli }) {
  const [action, ...rest] = words
  const host = hostReports(profile, hosts)
  const settings = reportSettings({ profile, root, capable: Boolean(host) })
  const lines = []
  const refuse = (message) => ({ lines: [message], code: 1 })

  if (action === 'status') {
    return {
      code: 0,
      lines: [
        `intake: ${settings.intake}`,
        `triageLimit: ${settings.triageLimit}`,
        `upstream: ${settings.upstream}`,
        ...settings.notes
      ]
    }
  }
  if (!host) {
    return refuse(
      `the host adapter "${profile.adapters?.host}" has no \`reports\` role, so the reports switches stay off`
    )
  }
  const upstream = Boolean(flags.upstream)
  let slug = profile.repository?.slug
  if (upstream) {
    const lock = readLock(root)
    slug = lock?.source?.type === 'git' ? host.slugOfUrl(lock.source.url) : null
    if (!slug) {
      return refuse(
        "the framework's repository cannot be told: the lock's source is not a Git address on the host (`harness sync --from <address>` takes it from one)"
      )
    }
    if (settings.upstream === 'off') {
      return refuse(
        "reporting upstream is off (`reports.upstream` is `off`): note the suspected defect in the task's log and tell the owner"
      )
    }
  } else if (settings.intake === 'off' && ['list', 'candidates', 'plan'].includes(action) && !flags.force) {
    lines.push('(the intake is off here; reading is allowed)')
  }
  const options = { slug, ...(cli ? { cli } : {}) }
  const approved = Boolean(flags.approved) || (upstream && settings.upstream === 'post' && action === 'create')
  const needsApproval = (what) =>
    `${what} on the host needs the owner's approval: ask, then run it again with --approved`

  if (action === 'list') {
    const reports = host.listReports(options)
    const recorded = recordedReports({
      queue: readQueueOf(root, profile),
      backlog: readBacklogOf(root, profile),
      taskTexts: []
    })
    const shown = flags.untriaged ? untriaged(reports, recorded) : reports
    return {
      code: 0,
      lines: [
        ...lines,
        ...shown.map(line),
        ...(flags.untriaged
          ? [
              `(${selectForTriage(shown, settings.triageLimit).now.length} to triage in a session of ${settings.triageLimit} at most)`
            ]
          : [])
      ]
    }
  }
  if (action === 'show' && rest.length === 1) {
    const report = host.showReport({ ...options, number: rest[0] })
    return { code: 0, lines: [line(report), '', report.body] }
  }
  if (action === 'search' && rest.length) {
    return { code: 0, lines: host.searchReports({ ...options, text: rest.join(' ') }).map(line) }
  }
  if (action === 'candidates' && rest.length === 1) {
    const report = host.showReport({ ...options, number: rest[0] })
    const found = candidates({
      report,
      queue: readQueueOf(root, profile),
      backlog: readBacklogOf(root, profile),
      tasks: openTasks({ root, profile })
    })
    const version = reporterVersion(report)
    return {
      code: 0,
      lines: [
        `${line(report)}${version ? `; reporter's version ${version}` : ''}`,
        ...(found.length
          ? found.map(
              (item) =>
                `${item.id} [${item.where}] ${item.title}${item.area ? ` (${item.area})` : ''}${item.fixedIn ? `; fixed in ${item.fixedIn}` : ''}`
            )
          : [
              'no candidate in the indexes: a new issue, unless it is not a defect (a feature request is a backlog item)'
            ])
      ]
    }
  }
  if (action === 'plan') {
    if (!RELATIONS.includes(flags.relation)) {
      return refuse(`--relation is one of ${RELATIONS.join(', ')}`)
    }
    const queues = [readQueueOf(root, profile), readBacklogOf(root, profile)].filter(Boolean)
    const queue = flags.candidate
      ? queues.find((each) => [...each.open, ...each.archived].some((item) => item.id === flags.candidate))
      : null
    const issue = queue ? [...queue.open, ...queue.archived].find((item) => item.id === flags.candidate) : null
    const candidate = issue
      ? { id: issue.id, where: queue.archived.includes(issue) ? 'archive' : 'open', fixedIn: issue.fixedIn }
      : null
    const { steps } = triagePlan({ relation: flags.relation, candidate, version: flags.version ?? null })
    return { code: 0, lines: steps.map((step, index) => `${index + 1}. ${step}`) }
  }
  if (action === 'comment' && rest.length === 1 && flags.body) {
    if (!approved) return refuse(needsApproval('A comment'))
    host.commentReport({ ...options, number: rest[0], body: flags.body })
    return { code: 0, lines: [`Commented on #${rest[0]}.`] }
  }
  if (action === 'close' && rest.length === 1) {
    if (!approved) return refuse(needsApproval('Closing a report'))
    host.closeReport({ ...options, number: rest[0] })
    return { code: 0, lines: [`Closed #${rest[0]}.`] }
  }
  if (action === 'create' && flags.title && flags.body) {
    if (!approved) return refuse(needsApproval('A new report'))
    return { code: 0, lines: [`Created ${host.createReport({ ...options, title: flags.title, body: flags.body })}`] }
  }
  return refuse(
    "usage: harness reports status | list [--untriaged] | show <n> | search <text> | candidates <n> | plan --relation <same|close|different|not-a-defect|feature> [--candidate <id>] [--version <v>] | comment <n> --body <text> --approved | close <n> --approved | create --title <t> --body <b> --approved   (add --upstream for the framework's repository)"
  )
}
