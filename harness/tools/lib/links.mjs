// `harness check links`: every relative link of the project's tracked Markdown files resolves. The target exists and is not ignored by Git, and
// an `#anchor` into a Markdown file matches one of its headings. The vendored copy is checked at its source, where its links resolve.
// An indexed folder (`checks.indexedFolders`) has a README that links every file and subfolder of the folder, so that a new document cannot
// be left out of its index.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { VENDOR_DIR } from './lock.mjs'
import { headingAnchors, linkTargets, unindexedEntries } from './markdown.mjs'

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

/** The names directly in `folder` (files, and the first segment of a deeper path) among the tracked `paths`, without hidden ones. */
export function trackedEntries(paths, folder) {
  const prefix = `${folder.replace(/\/$/, '')}/`
  return [
    ...new Set(paths.filter((path) => path.startsWith(prefix)).map((path) => path.slice(prefix.length).split('/')[0]))
  ]
    .filter((name) => !name.startsWith('.'))
    .sort()
}

/**
 * The problems of the README of each indexed folder: it exists, and it links every file and subfolder that Git tracks in the folder.
 * `tracked` are the tracked paths of the project; what Git tracks is the same on every machine, which a listing of the disk is not.
 */
export function indexProblems({ root, indexedFolders, tracked }) {
  const problems = []
  for (const folder of indexedFolders) {
    const readme = `${folder.replace(/\/$/, '')}/README.md`
    if (!tracked.includes(readme)) {
      problems.push(`${folder}: the folder has no README.md to index it`)
      continue
    }
    const targets = linkTargets(readFileSync(join(root, readme), 'utf8'))
    for (const entry of unindexedEntries(trackedEntries(tracked, folder), targets)) {
      problems.push(`${readme}: does not link "${entry}"; add it to the index`)
    }
  }
  return problems
}

/**
 * The problems of the links of `files` (paths relative to `root`), and of the index rule for `indexedFolders`.
 * @returns {{ problems: string[], count: number }}
 */
export function checkLinks({ root, files = markdownFiles(root), indexedFolders = [] }) {
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
  if (indexedFolders.length) {
    const tracked = git(root, 'ls-files').split('\n').filter(Boolean)
    problems.push(...indexProblems({ root, indexedFolders, tracked }))
  }
  return { problems, count: files.length }
}
