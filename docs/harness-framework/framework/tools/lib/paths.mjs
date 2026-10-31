// `harness check paths` (design §7.1): a repository path written in backticks in a document must exist. The link check sees only links, and
// the harness documents name scripts and files in plain text. STATE documents (logs, reports, plans) are history and are not checked, nor is
// the vendored copy (checked at its source). A path counts as a repository path when it starts with `./` or `../` (relative to the document),
// or when its first folder is a top-level entry of the repository; a path the repository ignores (a local file such as an environment file)
// is accepted, since it exists only on a developer's machine. A path names a file by its extension or a folder by a final `/`. A path is present
// when Git tracks it or a file under it, so the check gives the same answer on every machine and in CI.
import { readFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { classify, layerConfig, trackedFiles } from './layers.mjs'
import { ignoredPaths } from './links.mjs'
import { VENDOR_DIR } from './lock.mjs'
import { blankFences } from './markdown.mjs'

// One path: segments of letters, digits and `._@-`, at least one `/`; no space, no placeholder, no glob. It names a file (its last segment has
// an extension) or a folder (it ends with `/`), so a branch name such as `docs/1.2-slug` is not taken for a path
const PATH = /^(?:\.{1,2}\/)*[\w.@-]+(?:\/[\w.@-]+)*(?:\/[\w@-][\w.@-]*\.[A-Za-z][A-Za-z0-9]{0,5}|\/)$/

/**
 * The backticked repository paths of a document, as `{ line, token, path, folder }`: `path` relative to the repository root, `folder` when the
 * token ends with `/`.
 */
export function documentPaths(document, text, topLevel) {
  const found = []
  blankFences(text)
    .split('\n')
    .forEach((line, index) => {
      for (const [, span] of line.matchAll(/`([^`\n]+)`/g)) {
        const token = span.replace(/:\d+(?:-\d+)?$/, '')
        if (!PATH.test(token)) {
          continue
        }
        const relativeToDocument = token.startsWith('./') || token.startsWith('../')
        if (!relativeToDocument && !topLevel.has(token.split('/')[0])) {
          continue
        }
        const path = normalize(relativeToDocument ? join(dirname(document), token) : token)
          .split('\\')
          .join('/')
          .replace(/\/$/, '')
        found.push({ line: index + 1, token, path, folder: token.endsWith('/') })
      }
    })
  return found
}

/** The documents the check reads: tracked Markdown files that are not STATE and not in the vendored copy. */
export function checkedDocuments(root, profile, files = trackedFiles(root)) {
  const markdown = files.filter((file) => file.endsWith('.md') && !file.startsWith(`${VENDOR_DIR}/`))
  const config = layerConfig(root, profile)
  if (!config) {
    return markdown
  }
  const { classes } = classify(markdown, config)
  return markdown.filter((file) => !(classes.get(file) ?? []).includes('state'))
}

/**
 * `harness check paths`.
 * @returns {{ problems: string[], message: string }}
 */
export function checkPaths({ root, profile, files = trackedFiles(root) }) {
  const topLevel = new Set(files.map((file) => file.split('/')[0]))
  const documents = checkedDocuments(root, profile, files)

  const found = documents.flatMap((document) =>
    documentPaths(document, readFileSync(join(root, document), 'utf8'), topLevel).map((item) => ({ document, ...item }))
  )
  // Present means tracked, or a folder that holds tracked files, so the answer does not depend on what a machine has on disk
  const tracked = new Set(files)
  const folders = new Set(
    files.flatMap((file) =>
      file
        .split('/')
        .slice(0, -1)
        .map((_, index, parts) => parts.slice(0, index + 1).join('/'))
    )
  )
  const missing = found.filter(({ path }) => !path.startsWith('..') && !tracked.has(path) && !folders.has(path))
  // A folder is asked with its final `/`, which a folder rule of the ignore files needs when the folder is absent
  const query = ({ path, folder }) => (folder ? `${path}/` : path)
  const ignored = ignoredPaths(root, [...new Set(missing.map(query))])
  const problems = missing
    .filter((item) => !ignored.has(query(item)))
    .map(
      ({ document, line, token }) =>
        `${document}:${line}: the path \`${token}\` does not exist; correct it or drop the backticks`
    )

  return { problems, message: `Checked ${found.length} repository paths in ${documents.length} documents.` }
}
