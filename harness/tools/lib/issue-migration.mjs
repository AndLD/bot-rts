// The migration of the open-ended phase to the issue queue (task 3.13). A project of an earlier version kept the defects it found in use as the tasks of
// one phase that never ended (`plan.openEndedPhaseNumber`). This makes that phase a normal one that keeps its number and every id, with a goal and exit
// criteria made of the tasks that remain, and turns only its tasks that have not started and that no order names (the defects) into issues of the queue,
// each naming its old id (`I-1, formerly 12.5`). A task in progress or done never moves, so an order written by id survives. Idempotent: a profile
// file without `plan.openEndedPhaseNumber` has nothing to convert.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, posix } from 'node:path'
import { UNCLASSIFIED, nextIssueNumber, readQueue } from './issue-queue.mjs'
import { rewriteLinks } from './link-moves.mjs'
import { inFramework } from './lock.mjs'
import { orderOfDevelopment } from './next-task.mjs'
import { parseTaskFile } from './phase-files.mjs'
import { splitPhase } from './phase-split.mjs'
import { render } from './render.mjs'

// The text without the line of a JSON key (a string or a number value), mending the comma of the line before it when the key was the last
function removeKey(text, key) {
  const line = new RegExp(`^[ \\t]*"${key}":[ \\t]*(?:"(?:[^"\\\\]|\\\\.)*"|\\d+)(,?)[ \\t]*\\n`, 'm')
  const match = line.exec(text)
  if (!match) return text
  const without = text.replace(line, '')
  return match[1] === '' ? without.replace(/,(\s*\n\s*\})/, '$1') : without
}

/** The profile file's text with `plan.openEndedPhase` and `plan.openEndedPhaseNumber` removed and `paths.issues` added after `paths.planIndex`; null when it cannot be edited safely. */
export function profileWithQueue(text, issues) {
  let next = removeKey(removeKey(text, 'openEndedPhase'), 'openEndedPhaseNumber')
  if (!/"issues":/.test(next)) {
    next = next.replace(
      /^([ \t]*)"planIndex":[ \t]*("(?:[^"\\]|\\.)*"),?[ \t]*\n/m,
      (line, indent, value) => `${indent}"planIndex": ${value},\n${indent}"issues": ${JSON.stringify(issues)},\n`
    )
  }
  try {
    JSON.parse(next)
    return next
  } catch {
    return null
  }
}

const bodyOf = (text) =>
  text
    .split('\n')
    .slice(text.split('\n').findIndex((line) => /^\*\*Status:\*\*/.test(line)) + 1)
    .join('\n')
    .replace(/^\n+/, '')

function issueText({ number, task, body, log }) {
  return (
    `[← Issue queue](./README.md)\n\n# I-${number} — ${task.title}\n\n` +
    [
      `**Status:** ${task.status}`,
      ...(task.agent ? [`**Agent:** ${task.agent}`] : []),
      `**Size:** ${task.points} SP`,
      `**Area:** ${UNCLASSIFIED}`,
      '**Reported:** —',
      `**Formerly:** ${task.id}`,
      ...(log ? [`**Log:** [I-${number}.log.md](./I-${number}.log.md)`] : [])
    ].join(' · ') +
    `\n\n${body}`
  )
}

const withoutParagraph = (text, start) => {
  const from = text.indexOf(start)
  if (from < 0) return null
  const to = text.indexOf('\n\n', from)
  return { before: text.slice(0, from), after: to < 0 ? '' : text.slice(to + 2) }
}

/**
 * @returns {string[]} what was done, for the migration's output
 */
export function convertOpenEndedPhase({ root, profile }) {
  const number = profile.plan?.openEndedPhaseNumber
  if (number === undefined) {
    return []
  }
  const messages = []
  const phasesDir = profile.paths.phases
  const find = () => readdirSync(join(root, phasesDir)).find((name) => new RegExp(`^phase-${number}-[^.]+$`).test(name))
  if (!find()) {
    messages.push(...splitPhase({ root, profile, number }).messages)
  }
  const folder = find()
  const profilePath = join(root, profile.paths.profileFile ?? 'harness-profile.json')
  const issuesDir = posix.join(posix.dirname(profile.paths.planIndex), 'issues')
  if (!folder) {
    return [
      `Phase ${number} (the open-ended phase) was not found in ${phasesDir}: convert it by hand, then remove plan.openEndedPhaseNumber from the profile file.`
    ]
  }
  const phaseDir = `${phasesDir}/${folder}`

  // The queue's folder, from the framework's templates
  const templates = join(root, inFramework(profile, 'core/templates/scaffold'))
  const context = { ...profile, paths: { ...profile.paths, issues: issuesDir } }
  for (const [template, path] of [
    ['issue-queue.md', `${issuesDir}/README.md`],
    ['issue-archive.md', `${issuesDir}/archived/README.md`]
  ]) {
    if (!existsSync(join(root, path))) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(
        join(root, path),
        render(readFileSync(join(templates, template), 'utf8'), context, { document: path })
      )
    }
  }
  const queue = readQueue({
    dir: issuesDir,
    list: (path) => (existsSync(join(root, path)) ? readdirSync(join(root, path)) : []),
    readText: (path) => readFileSync(join(root, path), 'utf8')
  })

  // The tasks that become issues: not started, and named by no order of the plan index
  const named = new Set(
    orderOfDevelopment(readFileSync(join(root, profile.paths.planIndex), 'utf8')).filter(
      (token) => typeof token === 'string'
    )
  )
  const tasks = readdirSync(join(root, phaseDir))
    .filter((name) => /^\d+\.\d+[a-z]?\.md$/.test(name))
    .map((name) => parseTaskFile(`${phaseDir}/${name}`, readFileSync(join(root, phaseDir, name), 'utf8')))
  let next = nextIssueNumber(queue)
  const moved = []
  for (const task of tasks.filter((item) => item.status === '⬜' && !named.has(item.id))) {
    const old = `${phaseDir}/${task.id}.md`
    const path = `${issuesDir}/I-${next}.md`
    const logFrom = `${phaseDir}/${task.id}.log.md`
    const hasLog = existsSync(join(root, logFrom))
    const body = rewriteLinks(bodyOf(readFileSync(join(root, old), 'utf8')), old, path, new Map())
    writeFileSync(join(root, path), issueText({ number: next, task, body, log: hasLog }))
    rmSync(join(root, old))
    if (hasLog) {
      writeFileSync(
        join(root, `${issuesDir}/I-${next}.log.md`),
        rewriteLinks(
          readFileSync(join(root, logFrom), 'utf8'),
          logFrom,
          `${issuesDir}/I-${next}.log.md`,
          new Map()
        ).replace(/^\[←[^\n]*\n/, `[← I-${next} — ${task.title}](./I-${next}.md)\n`)
      )
      rmSync(join(root, logFrom))
    }
    moved.push(`${task.id} became I-${next}`)
    next += 1
  }

  // The phase becomes a normal one: what remains is its scope
  const remaining = tasks.filter((task) => !moved.some((line) => line.startsWith(`${task.id} `)))
  const points = remaining.reduce((sum, task) => sum + (task.points ?? 0), 0)
  const readmePath = join(root, phaseDir, 'README.md')
  let readme = readFileSync(readmePath, 'utf8')
  readme = readme.replace(/^(# Phase \d+ — .+?) \(\d+ SP(?:, [^)]*)?\)/m, `$1 (${points} SP)`)
  const open = remaining.filter((task) => task.status !== '✅')
  const status =
    open.length === 0
      ? '✅ Done'
      : open.some((task) => task.status === '🟡') || remaining.some((task) => task.status === '✅')
        ? '🟡 In progress'
        : '⬜ Not started'
  readme = readme.replace(/\*\*Status:\*\*\s*(?:⬜|🟡|✅)\s*[A-Za-z ]+?(?= ·|$)/m, `**Status:** ${status}`)
  const goal = `Stabilization work that was planned or under way when the issue queue replaced the open-ended phase. Defects and improvements found in use are issues of the [issue queue](${posix.relative(phaseDir, issuesDir)}/README.md).`
  const paragraph = withoutParagraph(readme, 'The open-ended phase:')
  readme = paragraph ? `${paragraph.before}${goal}\n\n${paragraph.after}` : readme
  readme = readme.replace(
    /\*\*Exit criteria:\*\*[^\n]*none[^\n]*/,
    `**Exit criteria:** ${remaining.length ? `the tasks of this phase are done (${remaining.map((task) => task.id).join(', ')}).` : 'there is no task left.'}`
  )
  writeFileSync(readmePath, readme)

  // The plan index gets the block that shows the queue, the profile file loses the roles of the open-ended phase and gains the queue's path
  const indexPath = join(root, profile.paths.planIndex)
  const index = readFileSync(indexPath, 'utf8')
  if (!index.includes('<!-- plan-issues:start -->') && index.includes('<!-- plan-summary:end -->')) {
    writeFileSync(
      indexPath,
      index.replace(
        '<!-- plan-summary:end -->',
        '<!-- plan-summary:end -->\n\n<!-- plan-issues:start -->\n<!-- plan-issues:end -->'
      )
    )
  }
  const edited = profileWithQueue(readFileSync(profilePath, 'utf8'), issuesDir)
  if (edited === null) {
    messages.push(
      `${profile.paths.profileFile ?? 'harness-profile.json'}: remove plan.openEndedPhase and plan.openEndedPhaseNumber and add paths.issues ("${issuesDir}") by hand; the file could not be edited safely.`
    )
  } else {
    writeFileSync(profilePath, edited)
  }
  messages.push(
    `Phase ${number}, the open-ended phase, is a normal phase now (${remaining.length} task(s), ${points} SP, ${status}).`,
    moved.length
      ? `Moved to the issue queue ${issuesDir}: ${moved.join(', ')}.`
      : 'No task of the phase was a defect that had not started, so the queue is empty.'
  )
  return messages
}
