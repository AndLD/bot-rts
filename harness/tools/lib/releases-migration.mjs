// The migration of the release order out of the plan index (task 5.1). A project of an earlier version keeps its order of development as a section of the plan
// index. When that section holds a table, the table becomes the releases file (the columns `Release | Status | Tasks, in order | Consumers | Notes`), the
// profile file gains `paths.releases`, and the section of the index becomes the generated block. A section written in prose (arrows of phase numbers, a
// paragraph) cannot be read by the tools: nothing is changed and a message says what to do by hand. Idempotent: a profile that has the role, or an index with no
// such section, has nothing to move.
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, posix } from 'node:path'
import { inFramework } from './lock.mjs'
import { tokensOf, RELEASES_END, RELEASES_START, releasesFile } from './releases.mjs'
import { planPhases, planSummary } from './plan.mjs'
import { loadProfile } from './profile.mjs'

const SECTION_START = /\*\*Order of development\.?\*\*|^#+\s*Order of development/im
const cellsOf = (line) =>
  line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim())

/** The profile file's text with `paths.releases` added after `paths.planIndex`; null when it cannot be edited safely. */
export function profileWithReleases(text, releases) {
  if (/"releases":/.test(text)) {
    return text
  }
  const next = text.replace(
    /^([ \t]*)"planIndex":[ \t]*("(?:[^"\\]|\\.)*")(,?)[ \t]*\n/m,
    (line, indent, value, comma) =>
      `${indent}"planIndex": ${value},\n${indent}"releases": ${JSON.stringify(releases)}${comma}\n`
  )
  try {
    JSON.parse(next)
    return next === text ? null : next
  } catch {
    return null
  }
}

/** The lines of the section "Order of development" of the index: `{ from, to }` as a range of line numbers (`to` excluded), or null when there is none. */
export function orderSection(indexText) {
  const offset = indexText.search(SECTION_START)
  if (offset < 0) {
    return null
  }
  const lines = indexText.split('\n')
  const from = indexText.slice(0, offset).split('\n').length - 1
  const end = lines.slice(from + 1).findIndex((line) => /^(---|#{1,6} )/.test(line))
  return { from, to: end < 0 ? lines.length : from + 1 + end }
}

// The status of a release from the tasks it names: released when all are done, developing when one is started or done, planned otherwise
function statusOf(tasks, phases) {
  const byId = new Map(phases.flatMap((phase) => phase.tasks.map((task) => [task.id, task.status])))
  const statuses = tokensOf(tasks).flatMap((token) =>
    typeof token === 'string'
      ? (byId.get(token) ?? [])
      : (phases.find((phase) => phase.number === token.phase)?.tasks.map((task) => task.status) ?? [])
  )
  if (!statuses.length) {
    return '⬜'
  }
  return statuses.every((status) => status === '✅') ? '✅' : statuses.some((status) => status !== '⬜') ? '🟡' : '⬜'
}

/** The rows of the old table of the section, and the lines of the section that are not the table; `rows` is null where the section holds no table. */
export function readOldSection(lines, phases) {
  const table = lines.filter((line) => line.startsWith('|') && !/^\|\s*[-: |]+\|?\s*$/.test(line))
  if (table.length < 2) {
    return { rows: null, rest: lines }
  }
  const names = cellsOf(table[0]).map((cell) => cell.toLowerCase())
  const find = (pattern, fallback) => {
    const at = names.findIndex((name) => pattern.test(name))
    return at < 0 ? fallback : at
  }
  const tasksAt = find(/task/, 1)
  const consumersAt = find(/consumer/, names.length > 2 ? 2 : -1)
  const rows = table.slice(1).map((line) => {
    const cells = cellsOf(line)
    const tasks = cells[tasksAt] ?? ''
    return {
      release: cells[0] ?? '',
      status: statusOf(tasks, phases),
      tasks,
      consumers: consumersAt >= 0 ? (cells[consumersAt] ?? '') : '',
      notes: ''
    }
  })
  return { rows, rest: lines.filter((line) => !line.startsWith('|')) }
}

/** Moves the release order of the index into the releases file. @returns {string[]} the lines to print */
export function moveReleaseOrder({ root, profile }) {
  const { planIndex, plan: planDir } = profile.paths
  if (profile.paths.releases) {
    return []
  }
  const indexPath = join(root, planIndex)
  const indexText = readFileSync(indexPath, 'utf8')
  const section = orderSection(indexText)
  if (!section) {
    return []
  }
  const lines = indexText.split('\n')
  const { rows, rest } = readOldSection(lines.slice(section.from, section.to), planPhases({ root, profile }))
  const releases = posix.join(dirname(planIndex) === '.' ? '' : dirname(planIndex), 'releases.md')
  // The paragraph of the index template that a project never filled in is no order
  if (!rows && /^\*\*Order of development\.?\*\*\s*<[^]*>$/.test(rest.join(' ').trim())) {
    return []
  }
  if (!rows) {
    return [
      `Required action: ${planIndex} writes its order of development in prose, which the tools cannot read, so it was left as it is. Write the order as the table of ${inFramework(profile, 'core/plan/releases-template.md')} in ${releases}, set \`paths.releases\` to it in the profile file, replace the section of the index by the block of ${inFramework(profile, 'core/plan/index-template.md')}, and run \`harness plan summary\`.`
    ]
  }
  const profilePath = join(root, profile.paths.profileFile ?? 'harness-profile.json')
  const edited = profileWithReleases(readFileSync(profilePath, 'utf8'), releases)
  if (edited === null) {
    return [
      `Required action: the profile file could not be edited safely; add \`"releases": "${releases}"\` to \`paths\` of it, then run \`harness migrate\` again to move the order of development of ${planIndex}.`
    ]
  }
  writeFileSync(profilePath, edited)
  const notes = rest.join('\n').replace(/\n{3,}/g, '\n\n')
  writeFileSync(
    join(root, releases),
    releasesFile({
      title: profile.project?.title ?? 'the project',
      rows,
      notes,
      indexLink: `./${basename(planIndex)}`
    })
  )
  const replacement = [
    `**Releases** (the order of the releases and of their tasks is the file [releases](./${basename(releases)}), not a section of this index; the line below is written by \`harness plan summary\`)`,
    '',
    RELEASES_START,
    RELEASES_END
  ]
  writeFileSync(indexPath, [...lines.slice(0, section.from), ...replacement, '', ...lines.slice(section.to)].join('\n'))
  const written = planSummary({ root, profile: loadProfile(root) })
  return [
    `Moved the order of development of ${planIndex} (${rows.length} release(s)) into ${releases} and set \`paths.releases\`. The status of each release was worked out from its tasks (⬜ planned, 🟡 developing, ✅ released); a development version that was cut is 🏷, which only you know: review the column "Status".`,
    ...written.problems
  ]
}
