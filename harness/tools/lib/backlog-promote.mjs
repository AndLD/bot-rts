// The promotion of a backlog item (task 3.21): an item of the backlog is a proposal the owner has not approved, never started as it is. The owner's decision to
// do it turns it into a task of a phase of the plan, and only that task is claimed, branched, built and logged. `harness plan promote <B-n> --phase <n>` writes
// the task (the next free id of the phase, from the item's title and description, with the item's source and a link to the item), sets the item to `Promoted`
// with `Promoted to:`, and runs the plan summary, which moves the item to the archive and writes the indexes and the size of the phase.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { PROMOTED, PROPOSED } from './issue-queue.mjs'
import { rewriteLinks } from './link-moves.mjs'
import { TASK_FILE } from './phase-files.mjs'
import { planSummary, readBacklogOf } from './plan.mjs'

const bodyOf = (text) =>
  text
    .split('\n')
    .slice(text.split('\n').findIndex((line) => /^\*\*Status:\*\*/.test(line)) + 1)
    .join('\n')
    .replace(/^\n+/, '')
    .trimEnd()

/**
 * @param {{ id: string, phase: number, agent?: string, size?: number, approved?: boolean }} options `agent` and `size` default to what the item holds
 * @returns {string[]} what was done, for the output of the command
 */
export function promoteItem({ root, profile, id, phase, agent, size, approved = false }) {
  if (!approved) {
    throw new Error(
      'promoting an item is the owner’s decision: ask, then run the command again with --approved (it changes the plan)'
    )
  }
  const backlog = readBacklogOf(root, profile)
  if (!backlog) {
    throw new Error('the profile file names no backlog (paths.backlog), so there is no item to promote')
  }
  const item = backlog.open.find((entry) => entry.id === id)
  if (!item) {
    const done = backlog.archived.find((entry) => entry.id === id)
    throw new Error(
      done
        ? `${id} was promoted already (to task ${done.promotedTo ?? '?'})`
        : `the backlog has no open item ${id}; it has ${backlog.open.map((entry) => entry.id).join(', ') || 'none'}`
    )
  }
  if (item.status !== PROPOSED) {
    throw new Error(`${id} is ${item.status}, and only a proposed item is promoted`)
  }

  const phasesDir = profile.paths.phases
  const folder = existsSync(join(root, phasesDir))
    ? readdirSync(join(root, phasesDir)).find((name) => new RegExp(`^phase-${phase}-[^./]+$`).test(name))
    : null
  if (!folder) {
    throw new Error(`${phasesDir} has no folder for Phase ${phase}: a task is added to a phase kept as a folder`)
  }
  const phaseDir = `${phasesDir}/${folder}`
  const readmePath = join(root, phaseDir, 'README.md')
  const readme = readFileSync(readmePath, 'utf8')
  const heading = /^# Phase (\d+) — (.+?) \((\d+) SP/m.exec(readme)
  if (!heading) {
    throw new Error(`${phaseDir}/README.md: the title must read "# Phase <n> — <theme> (<n> SP)"`)
  }

  const scale = Object.keys(profile.plan?.complexity?.scale ?? {})
  const marker = agent ?? item.agent
  if (scale.length && !marker) {
    throw new Error(`a task needs an agent marker (${scale.join(', ')}): give --agent <marker>; the item holds none`)
  }
  if (scale.length && !scale.includes(marker)) {
    throw new Error(`the marker ${marker} is not on the scale (${scale.join(', ')})`)
  }
  const points = size === undefined ? item.points : Number(size)
  if (!Number.isInteger(points) || points < 1) {
    throw new Error('a task needs a size in story points: give --size <n>; the item holds none')
  }

  const taken = readdirSync(join(root, phaseDir))
    .map((name) => TASK_FILE.exec(name)?.[1])
    .filter(Boolean)
    .map((taskId) => Number(taskId.split('.')[1].replace(/[a-z]$/, '')))
  const taskId = `${phase}.${Math.max(0, ...taken) + 1}`
  const itemPath = `${backlog.dir}/${id}.md`
  const taskPath = `${phaseDir}/${taskId}.md`
  const archivedItem = `${backlog.dir}/archived/${id}.md`
  const itemText = readFileSync(join(root, itemPath), 'utf8')
  const body = rewriteLinks(bodyOf(itemText), itemPath, taskPath, new Map())

  writeFileSync(
    join(root, taskPath),
    `[← Phase ${phase} — ${heading[2]}](./README.md)\n\n# ${taskId} — ${item.title}\n\n` +
      `**Status:** ⬜${scale.length ? ` · **Agent:** ${marker}` : ''} · **Size:** ${points} SP\n\n` +
      `Promoted from the backlog item [${id}](${posix.relative(phaseDir, archivedItem)}), whose source is ${item.reported}.\n\n${body}\n`
  )
  writeFileSync(
    join(root, itemPath),
    itemText.replace(`**Status:** ${PROPOSED}`, `**Status:** ${PROMOTED} · **Promoted to:** ${taskId}`)
  )
  writeFileSync(
    readmePath,
    readme.replace(
      /^(# Phase \d+ — .+? \()(\d+)( SP)/m,
      (_, start, old, end) => `${start}${Number(old) + points}${end}`
    )
  )

  const { problems } = planSummary({ root, profile })
  return [
    `Promoted ${id} to task ${taskId} of Phase ${phase} (${points} SP${scale.length ? `, ${marker}` : ''}); the item moved to ${archivedItem}.`,
    ...problems.map((problem) => `plan: ${problem}`)
  ]
}
