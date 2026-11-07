// The off-plan record (task 2.5, design §7.1): work that no task covers (documentation, tooling, CI, a change of the plan) is recorded in a fragment of its
// own, one file per pull request in the folder `paths.offPlan`, named `<pull request number>-<slug>.md`, so that two pull requests never edit the same lines.
// `harness plan log --off-plan` prints the fragments in the order of the pull requests, and `harness check off-plan` lists the merged pull requests that have
// neither a `Plan:` line in their commit nor a fragment. The pull requests that merged before the folder's index existed are not asked for one.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** The index of the folder, which says how a fragment reads; the first commit that adds it starts the history the check looks at. */
export const INDEX_NAME = 'README.md'

const NAME = /^(\d+)-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/
const FIELDS = [
  ['what', 'What changed'],
  ['why', 'Why and who asked'],
  ['left', 'What it leaves to do']
]
const FIELD_LINE = /^\*\*([^*]+):\*\*\s*(.*)$/
const PLAN_LINE = /^Plan:\s*\S/m
const PULL_NUMBER = /\(#(\d+)\)\s*$/

/**
 * A fragment: `{ pr, title, what, why, left }` from the file name and the text, or throws with the file name. The text is `# <title>`, then the three
 * fields, each a line `**<label>:** <text>` that goes on until a blank line or the next field.
 */
export function parseFragment(name, text) {
  const match = NAME.exec(name)
  if (!match) {
    throw new Error(`${name}: an off-plan record is named <pull request number>-<slug>.md (lower case, hyphens)`)
  }
  const title = /^# (.+?)\s*$/m.exec(text)?.[1]
  if (!title) {
    throw new Error(`${name}: the record must start with a title line "# <what the pull request did>"`)
  }
  const found = {}
  let current = null
  for (const line of text.split('\n')) {
    const field = FIELD_LINE.exec(line)
    const known = field && FIELDS.find(([, label]) => label === field[1])
    if (known) {
      current = known[0]
      found[current] = field[2].trim()
    } else if (!line.trim() || line.startsWith('#')) {
      current = null
    } else if (current) {
      found[current] = `${found[current]} ${line.trim()}`.trim()
    }
  }
  const missing = FIELDS.filter(([key]) => !found[key]).map(([, label]) => `"${label}"`)
  if (missing.length) {
    throw new Error(`${name}: the record needs a text for ${missing.join(', ')} (each a line "**<label>:** <text>")`)
  }
  return { pr: Number(match[1]), name, title, what: found.what, why: found.why, left: found.left }
}

/** The fragments of the folder, oldest pull request first, and the problems of those that do not read: `{ fragments, problems }`. */
export function readFragments({ root, dir }) {
  const folder = join(root, dir)
  const names = existsSync(folder)
    ? readdirSync(folder).filter((name) => name.endsWith('.md') && name !== INDEX_NAME)
    : []
  const fragments = []
  const problems = []
  for (const name of names.sort()) {
    try {
      fragments.push(parseFragment(name, readFileSync(join(folder, name), 'utf8')))
    } catch (error) {
      problems.push(error.message)
    }
  }
  return { fragments: fragments.sort((a, b) => a.pr - b.pr), problems }
}

const cell = (text) => text.replace(/\|/g, '\\|')

/** The table `harness plan log --off-plan` prints, with links to the pull requests of `repoUrl`. */
export function offPlanTable(fragments, repoUrl) {
  const lines = [
    '| PR | Change | What changed | Why and who asked | What it leaves to do |',
    '| -- | ------ | ------------ | ----------------- | -------------------- |'
  ]
  for (const { pr, title, what, why, left } of fragments) {
    lines.push(`| [#${pr}](${repoUrl}/pull/${pr}) | ${cell(title)} | ${cell(what)} | ${cell(why)} | ${cell(left)} |`)
  }
  return lines.join('\n')
}

/**
 * The merged pull requests with no record: a commit of `commits` (`{ subject, body }`, squash commits end their subject with `(#<n>)`) that has no
 * `Plan:` line in its body and whose pull request no fragment names. Returns `{ pr, title }`, oldest first when `commits` come newest first.
 */
export function unrecorded(commits, fragments) {
  const recorded = new Set(fragments.map(({ pr }) => pr))
  return commits
    .map(({ subject, body }) => ({
      pr: PULL_NUMBER.exec(subject)?.[1],
      title: subject.replace(PULL_NUMBER, '').trim(),
      body
    }))
    .filter(({ pr, body }) => pr && !PLAN_LINE.test(body) && !recorded.has(Number(pr)))
    .map(({ pr, title }) => ({ pr: Number(pr), title }))
    .reverse()
}

const git = (root, args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })

/** The commits that came after the one that added the folder's index, newest first, along the first parent; null when the history has none such. */
export function commitsSinceIndex({ root, dir, ref = 'HEAD' }) {
  let added = ''
  try {
    added = git(root, ['log', ref, '--diff-filter=A', '--format=%H', '--', `${dir}/${INDEX_NAME}`]).trim()
  } catch {
    return null
  }
  const first = added.split('\n').filter(Boolean).at(-1)
  if (!first) {
    return null
  }
  const FIELD = '\u001f'
  const END = '\u001e'
  return git(root, ['log', `${first}..${ref}`, '--first-parent', `--format=%s${FIELD}%b${END}`])
    .split(END)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [subject, body = ''] = record.split(FIELD)
      return { subject, body }
    })
}

/** `harness check off-plan`: every record reads, and every merged pull request since the folder began has a `Plan:` line or a record. */
export function checkOffPlan({ root, profile, ref }) {
  const dir = profile.paths.offPlan
  if (!dir) {
    return {
      problems: [],
      message: 'The profile has no `paths.offPlan` role, so there is no off-plan record to check.'
    }
  }
  const { fragments, problems } = readFragments({ root, dir })
  const commits = commitsSinceIndex({ root, dir, ref })
  if (!commits) {
    return {
      problems,
      message: `Checked ${fragments.length} off-plan records; the history has no commit that added ${dir}/${INDEX_NAME}, so no pull request was asked for one.`
    }
  }
  const missing = unrecorded(commits, fragments).map(
    ({ pr, title }) =>
      `the pull request #${pr} (${title}) merged with no \`Plan:\` line and no record: add ${dir}/${pr}-<slug>.md`
  )
  return {
    problems: [...problems, ...missing],
    message: `Checked ${fragments.length} off-plan records and ${commits.length} merged commits since ${dir}/${INDEX_NAME} was added.`
  }
}

/** The text of `harness plan log --off-plan`. */
export function offPlanLog({ root, profile }) {
  if (!profile.paths.offPlan) {
    throw new Error('the profile has no `paths.offPlan` role, so the project keeps no off-plan record')
  }
  const { fragments, problems } = readFragments({ root, dir: profile.paths.offPlan })
  if (problems.length) {
    throw new Error(problems.join('\n'))
  }
  return offPlanTable(fragments, profile.repository.url)
}
