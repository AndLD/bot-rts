// The backlog of a project that sets `paths.backlog` after its plan exists (task 3.20): the folder with its two indexes, from the scaffold templates, and the
// block of the plan index that shows it. `harness plan summary` calls it before it reads the queues, so setting the role and running the summary is all a
// project does; it changes nothing where the folder already has its index, or where the project names no backlog.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { inFramework } from './lock.mjs'
import { render } from './render.mjs'

export const BACKLOG_BLOCK = '<!-- plan-backlog:start -->\n<!-- plan-backlog:end -->'
const ANCHORS = ['<!-- plan-issues:end -->', '<!-- plan-summary:end -->']

/** @returns {string[]} what was created, for the output of the command */
export function ensureBacklog({ root, profile }) {
  const dir = profile.paths?.backlog
  if (!dir || existsSync(join(root, dir, 'README.md'))) {
    return []
  }
  const templates = join(root, inFramework(profile, 'core/templates/scaffold'))
  const created = []
  for (const [template, path] of [
    ['backlog-queue.md', `${dir}/README.md`],
    ['backlog-archive.md', `${dir}/archived/README.md`]
  ]) {
    if (existsSync(join(root, path))) continue
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(
      join(root, path),
      render(readFileSync(join(templates, template), 'utf8'), profile, { document: path })
    )
    created.push(path)
  }
  const indexPath = join(root, profile.paths.planIndex)
  const index = readFileSync(indexPath, 'utf8')
  const anchor = ANCHORS.find((marker) => index.includes(marker))
  if (!index.includes('<!-- plan-backlog:start -->') && anchor) {
    writeFileSync(indexPath, index.replace(anchor, `${anchor}\n\n${BACKLOG_BLOCK}`))
    created.push(`the block of the backlog in ${profile.paths.planIndex}`)
  }
  return created.length ? [`Set up the backlog: created ${created.join(', ')}.`] : []
}
