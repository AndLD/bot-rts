// `harness check links`: every relative link of the project's tracked Markdown files resolves. The target exists and is not ignored by Git, and
// an `#anchor` into a Markdown file matches one of its headings. The vendored copy is checked at its source, where its links resolve.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { VENDOR_DIR } from './lock.mjs'
import { headingAnchors, linkTargets } from './markdown.mjs'

const git = (root, ...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })

/** The tracked Markdown files of the project, without the vendored copy. */
export function markdownFiles(root) {
  return git(root, 'ls-files', '*.md')
    .split('\n')
    .filter((file) => file && !file.startsWith(`${VENDOR_DIR}/`))
}

/** The paths among `paths` (relative to `root`) that Git ignores, asked in one call. */
export function ignoredPaths(root, paths) {
  if (!paths.length) {
    return new Set()
  }
  // Exit code 1 means that no path is ignored; the output lists the ignored ones
  const result = spawnSync('git', ['check-ignore', '--stdin'], { cwd: root, input: paths.join('\n'), encoding: 'utf8' })
  return new Set(result.stdout.split('\n').filter(Boolean))
}

/**
 * The problems of the links of `files` (paths relative to `root`).
 * @returns {{ problems: string[], count: number }}
 */
export function checkLinks({ root, files = markdownFiles(root) }) {
  const anchors = new Map()
  const anchorsOf = (path) => {
    if (!anchors.has(path)) {
      anchors.set(path, headingAnchors(readFileSync(path, 'utf8')))
    }
    return anchors.get(path)
  }

  const found = []
  for (const file of files) {
    for (const target of linkTargets(readFileSync(join(root, file), 'utf8'))) {
      const [pathPart, anchor] = target.split('#')
      const resolved = pathPart ? resolve(root, dirname(file), decodeURIComponent(pathPart)) : join(root, file)
      found.push({ file, target, anchor, resolved, display: relative(root, resolved) })
    }
  }

  const ignored = ignoredPaths(root, [
    ...new Set(found.filter(({ resolved }) => existsSync(resolved)).map(({ display }) => display))
  ])
  const problems = []
  for (const { file, target, anchor, resolved, display } of found) {
    if (!existsSync(resolved)) {
      problems.push(`${file}: broken link "${target}" (no such file ${display})`)
    } else if (ignored.has(display)) {
      problems.push(`${file}: link "${target}" points to a git-ignored file`)
    } else if (anchor && resolved.endsWith('.md') && statSync(resolved).isFile() && !anchorsOf(resolved).has(anchor)) {
      problems.push(`${file}: link "${target}" has no matching heading`)
    }
  }
  return { problems, count: files.length }
}
