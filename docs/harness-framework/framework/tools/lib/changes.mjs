// "Is this change documentation only?" (design §7.1): one rule for CI and the push gate, so they cannot disagree about which checks to skip.
// The patterns are `checks.documentationPaths` of the profile file (globs; every Markdown file by default).
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { claims } from './layers.mjs'

export const DEFAULT_DOCUMENTATION_PATHS = Object.freeze(['**/*.md'])

export const documentationPaths = (profile) => profile.checks?.documentationPaths ?? DEFAULT_DOCUMENTATION_PATHS

export const isDocumentation = (path, patterns = DEFAULT_DOCUMENTATION_PATHS) => claims(patterns, path)

/** True when every path is documentation; an empty list (a change of no file) is documentation only too. */
export const isDocumentationOnly = (paths, patterns = DEFAULT_DOCUMENTATION_PATHS) =>
  paths.every((path) => isDocumentation(path, patterns))

/**
 * The paths that changed between two commits (`base...head`, from their merge base), or null when that cannot be told: no base, an all-zero
 * base (a new branch), or a failing diff (a base the clone does not have).
 */
export function changedPaths(root, base, head) {
  if (!base || !head || /^0+$/.test(base)) {
    return null
  }
  try {
    return execFileSync('git', ['diff', '--name-only', `${base}...${head}`], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .split('\n')
      .filter(Boolean)
  } catch {
    return null
  }
}

/**
 * `harness ci changes <base> <head>`: whether the change needs the code checks (`code`). In doubt it answers that it does. On the host the
 * answer is written to the step outputs as `code=true` or `code=false`.
 * @returns {{ code: boolean, paths: string[] | null, message: string }}
 */
export function ciChanges({ root, profile, base, head, output = process.env.GITHUB_OUTPUT }) {
  const paths = changedPaths(root, base, head)
  const code = paths === null || !isDocumentationOnly(paths, documentationPaths(profile))
  const message =
    paths === null
      ? 'The change could not be listed, so the code checks run.'
      : `${paths.length} changed path(s): ${code ? 'the code checks run' : 'documentation only, the code checks are skipped'}.`
  if (output) {
    appendFileSync(output, `code=${code}\n`)
  }
  return { code, paths, message }
}
