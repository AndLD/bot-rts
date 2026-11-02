// `harness check values` (design §7.5): the project's values live in the profile file, and the files that must name them by role do. It holds:
// the host's CI triggers equal the protected branches; every required check is a job; no value of the profile (a branch, the repository, a plan
// path, the coverage packages) is spelled out in the files of `checks.roleOnlyPaths`; and no workflow names a protected branch outside its
// branch triggers or lists the coverage packages. The host's files are read through the host adapter (`readTriggers`, `readJobNames`).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hostModule } from './host.mjs'
import { claims, trackedFiles } from './layers.mjs'

// The text of a Markdown file without its fenced code blocks, as lines (a fenced line is blank, so line numbers stay true)
function outsideFences(text) {
  let fenced = false
  return text.split('\n').map((line) => {
    if (/^\s*```/.test(line)) {
      fenced = !fenced
      return ''
    }
    return fenced ? '' : line
  })
}

const alternatives = (values) => values.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')

// A branch named in prose: in backticks, as `origin/<branch>`, or after a Git verb
function proseBranch(branches) {
  const names = alternatives(branches)
  return new RegExp(
    `\`(${names})\`|origin/(${names})\\b|\\b(checkout|merge|push|pull|rebase|tag|into|from) (${names})\\b`
  )
}

// A value spelled out in a script, a hook or a workflow
function codeLiteral(profile, branches) {
  const names = alternatives(branches)
  const paths = [
    profile.repository?.slug,
    profile.paths?.plan,
    profile.paths?.changelog,
    profile.paths?.changelogFragments
  ].filter(Boolean)
  return new RegExp(
    [
      `origin/(${names})\\b`,
      `refs/heads/(${names})\\b`,
      `['"\`](${names})['"\`]`,
      ...(paths.length ? [alternatives(paths)] : [])
    ].join('|')
  )
}

// Every package of a list of at least two on one line, as a run of whole words (`api client mcp`, `[api, client]`); a `needs:` line names jobs
function packageList(packages) {
  if (packages.length < 2) {
    return null
  }
  const words = packages.map((name) => `\\b${alternatives([name])}\\b`)
  return (line) => !/^\s*needs:/.test(line) && words.every((word) => new RegExp(word).test(line))
}

function triggerProblems(root, branches, host) {
  const triggers = host.readTriggers(root)
  const problems = []
  const expected = [...branches].sort()

  for (const { file, event, branches: listed } of triggers) {
    if (JSON.stringify([...listed].sort()) !== JSON.stringify(expected)) {
      problems.push(
        `${file}: the ${event} trigger lists ${listed.join(', ')}, but the protected branches are ${expected.join(', ')}`
      )
    }
  }
  const events = new Set(triggers.map(({ event }) => event))
  if (!events.has('pull_request') || !events.has('push')) {
    problems.push(
      'no workflow triggers on both pull requests and pushes of the protected branches, so the required checks would not report'
    )
  }
  return problems
}

function jobProblems(root, requiredChecks, host) {
  const names = new Set(host.readJobNames(root).map(({ name }) => name))
  return requiredChecks
    .filter((check) => !names.has(check))
    .map((check) => `the required check "${check}" is not a job of any workflow`)
}

function fileProblems(path, text, { profile, branches, host }) {
  const lines = path.endsWith('.md') ? outsideFences(text) : text.split('\n')
  const problems = []
  const report = (index, what) => problems.push(`${path}:${index + 1}: ${what}`)

  if (path.endsWith('.md')) {
    const named = proseBranch(branches)
    lines.forEach(
      (line, index) => named.test(line) && report(index, 'names a protected branch; use its role or a placeholder')
    )
    return problems
  }
  const literal = codeLiteral(profile, branches)
  lines.forEach((line, index) => {
    if (literal.test(line) && !line.trimStart().startsWith('//')) {
      report(index, 'spells out a value of the profile file; read it from there')
    }
  })
  if (host.isWorkflowFile(path)) {
    const branch = new RegExp(`\\b(${alternatives(branches)})\\b`)
    const list = packageList(profile.coveragePackages ?? [])
    lines.forEach((line, index) => {
      if (branch.test(line) && !/^\s+branches: \[/.test(line)) {
        report(index, 'names a protected branch outside a branches trigger')
      }
      if (list?.(line)) {
        report(index, 'lists the coverage packages; read them with `harness profile get coveragePackages`')
      }
    })
  }
  return problems
}

/**
 * `harness check values` on a project.
 * @param {{ root: string, profile: object, files?: string[] }} context `files` are the tracked files (default: Git's)
 * @returns {{ problems: string[], message: string }}
 */
export function checkValues({ root, profile, files = trackedFiles(root) }) {
  if (!profile.branches || !profile.adapters?.host) {
    return {
      problems: [],
      message: 'The profile file has no branches or no host adapter, so there are no values to hold.'
    }
  }
  const host = hostModule(profile, 'values-in-host-files')
  const branches = [profile.branches.production, profile.branches.integration]
  const patterns = profile.checks?.roleOnlyPaths ?? []
  const checked = files.filter((file) => claims(patterns, file))
  const problems = [
    ...triggerProblems(root, branches, host),
    ...jobProblems(root, profile.requiredChecks ?? [], host),
    ...checked.flatMap((file) =>
      fileProblems(file, readFileSync(join(root, file), 'utf8'), { profile, branches, host })
    )
  ]
  return {
    problems,
    message: `Checked the triggers and the required checks of the host's workflows, and ${checked.length} files that name values by role.`
  }
}
