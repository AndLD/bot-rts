// The secret scan of `harness check security` (probes S1-001, S1-010, S1-017) and the files that must not be tracked at all (S1-002). The patterns are the
// profile's (`security.secretPatterns`); the scan reads the tracked files and, with a range, the lines that the commits of the range added. No download, and a
// finding names the rule and the place, never the value that matched.
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { globToRegExp } from './layers.mjs'

const ALLOW_MARK = 'harness:allow-secret'
const MAX_BYTES = 1_000_000

/** The compiled rules of the profile: `{ id, regex, files }`; a pattern that is not a regular expression is an error that names it. */
export function secretRules(profile) {
  return (profile.security?.secretPatterns ?? []).map(({ id, pattern, flags, files }) => {
    try {
      return { id, regex: new RegExp(pattern, flags), files: files?.map(globToRegExp) }
    } catch {
      throw new Error(`security.secretPatterns "${id}" is not a regular expression`)
    }
  })
}

/** Whether `path` matches one of `globs` (a glob without a slash matches in any folder). */
export const matchesAny = (path, globs = []) =>
  globs.some((glob) => globToRegExp(glob.includes('/') ? glob : `**/${glob}`).test(path))

/** The 1-based line numbers of `text` where a rule matches, as `{ line, id }`; a line with the allow mark, and a rule limited to other files, are skipped. */
export function scanText({ path, text, rules }) {
  const applicable = rules.filter((rule) => !rule.files || rule.files.some((glob) => glob.test(path)))
  const found = []
  text.split('\n').forEach((content, index) => {
    if (content.includes(ALLOW_MARK) || content.length > 2000) return
    for (const rule of applicable) {
      if (rule.regex.test(content)) found.push({ line: index + 1, id: rule.id })
    }
  })
  return found
}

/** The tracked files of `root` (Git's list), the ones the profile excludes aside. */
export function trackedFiles(root, profile) {
  return execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0')
    .filter((file) => file && !matchesAny(file, profile.security?.exclude))
}

/** The text of a tracked file, or null when it is gone, too large or binary. */
export function readText(root, file) {
  try {
    const path = join(root, file)
    if (statSync(path).size > MAX_BYTES) return null
    const buffer = readFileSync(path)
    return buffer.subarray(0, 8000).includes(0) ? null : buffer.toString('utf8')
  } catch {
    return null
  }
}

/** S1-001, S1-010, S1-017: the secret scan of the tracked files. Returns the problems and the number of files it read. */
export function scanTracked({ root, profile, files = trackedFiles(root, profile) }) {
  const rules = secretRules(profile)
  const problems = []
  let read = 0
  for (const file of files) {
    const text = readText(root, file)
    if (text === null) continue
    read += 1
    for (const { line, id } of scanText({ path: file, text, rules })) {
      problems.push({
        probe: 'S1-001',
        text: `${file}:${line}: looks like a credential (rule ${id}); remove it and revoke it, or mark a test value ${ALLOW_MARK}`
      })
    }
  }
  return { problems, read }
}

/**
 * S1-001 over a history range (`<base>..<head>`, the commits of a push): the lines the commits added, as the secret scan reads them. A value that a later
 * commit of the range removed is still reported, because it is in the history that the push publishes.
 */
export function scanRange({ root, profile, range }) {
  const rules = secretRules(profile)
  const output = execFileSync('git', ['log', '-p', '-U0', '--no-color', '--no-ext-diff', '--format=commit %h', range], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024
  })
  const problems = []
  let commit = ''
  let file = ''
  let line = 0
  let commits = 0
  for (const row of output.split('\n')) {
    if (row.startsWith('commit ')) {
      commit = row.slice(7)
      commits += 1
    } else if (row.startsWith('+++ ')) file = row.slice(4).replace(/^b\//, '')
    else if (row.startsWith('@@')) line = Number(/\+(\d+)/.exec(row)?.[1] ?? 0) - 1
    else if (row.startsWith('+') && file && file !== '/dev/null') {
      line += 1
      if (matchesAny(file, profile.security?.exclude)) continue
      for (const hit of scanText({ path: file, text: row.slice(1), rules })) {
        problems.push({
          probe: 'S1-001',
          text: `commit ${commit} ${file}:${line}: the commit adds what looks like a credential (rule ${hit.id}); it stays in the history after a later commit removes it, so revoke it`
        })
      }
    }
  }
  return { problems, commits }
}

// S1-002: the files that hold real values, matched by the `access.denyRead` patterns of the profile (gitignore style: no slash matches in any folder, `!` carves out)
function deniedBy(patterns, path) {
  let denied = false
  for (const pattern of patterns) {
    const negated = pattern.startsWith('!')
    const glob = negated ? pattern.slice(1) : pattern
    if (matchesAny(path, [glob])) denied = !negated
  }
  return denied
}

const isIgnored = (root, path) => {
  try {
    execFileSync('git', ['check-ignore', '-q', '--no-index', path], { cwd: root, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/** S1-002: no tracked file matches `access.denyRead`, and the ignore file of Git covers a sample name of each pattern. */
export function checkSecretFiles({ root, profile, files = trackedFiles(root, profile) }) {
  const patterns = profile.access?.denyRead ?? []
  const problems = files
    .filter((file) => deniedBy(patterns, file))
    .map((file) => ({
      probe: 'S1-002',
      text: `${file}: a file for secrets or keys is tracked (it matches access.denyRead); untrack it and revoke what it holds`
    }))
  for (const pattern of patterns.filter((each) => !each.startsWith('!') && !each.includes('/'))) {
    const sample = pattern.replace(/\*/g, 'sample')
    if (deniedBy(patterns, sample) && !isIgnored(root, sample)) {
      problems.push({
        probe: 'S1-002',
        text: `.gitignore: does not list "${pattern}" of access.denyRead (a "git add ." would commit it)`
      })
    }
  }
  return problems
}
