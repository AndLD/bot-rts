// Moving a document and keeping every link to it right (tasks 3.10 and 3.13): a relative link is followed to where its target moved and written
// relative to where the text now stands, and the full path of a moved file written in plain text (a code span) is replaced. Used by the split of a phase
// into a folder and by the archive of the issue queue.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, posix } from 'node:path'

const LINK = /(\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g
const REFERENCE = /^(\[[^\]]+\]:\s*)(\S+)/gm
const EXTERNAL = /^([a-z][a-z0-9+.-]*:|#|\/\/)/i

/**
 * `text` (the content of the repository file `from`, now to be written as `to`) with every relative link made right for its new place: a target that is
 * itself moved (`moves`: old path to new path) is followed, and the path is written relative to `to`'s folder.
 */
export function rewriteLinks(text, from, to, moves) {
  const rewrite = (target) => {
    if (EXTERNAL.test(target)) {
      return target
    }
    const [path, anchor] = target.split('#')
    if (!path) {
      return target
    }
    const resolved = posix.normalize(posix.join(posix.dirname(from), path))
    if (resolved.startsWith('..')) {
      return target
    }
    const mapped = moves.get(resolved) ?? moves.get(resolved.replace(/\/$/, '')) ?? resolved
    let relative = posix.relative(posix.dirname(to), mapped) || '.'
    if (path.endsWith('/') && !relative.endsWith('/')) {
      relative += '/'
    }
    if (path.startsWith('.') && !relative.startsWith('.')) {
      relative = `./${relative}`
    }
    return anchor === undefined ? relative : `${relative}#${anchor}`
  }
  return text
    .replace(LINK, (_, open, target, close) => `${open}${rewrite(target)}${close}`)
    .replace(REFERENCE, (_, open, target) => `${open}${rewrite(target)}`)
}

/** The full paths of a moved file written in plain text (a code span, a sentence) are replaced by the new ones. */
export const replacePaths = (text, moves) => {
  let result = text
  for (const [from, to] of [...moves].sort((a, b) => b[0].length - a[0].length)) {
    result = result.split(from).join(to)
  }
  return result
}

export const listFiles = (root) => {
  try {
    return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .split('\n')
      .filter((name) => name && existsSync(join(root, name)))
  } catch {
    const files = []
    const visit = (dir) => {
      for (const name of readdirSync(join(root, dir))) {
        if (name === '.git' || name === 'node_modules') continue
        const path = dir ? `${dir}/${name}` : name
        if (statSync(join(root, path)).isDirectory()) visit(path)
        else files.push(path)
      }
    }
    visit('')
    return files
  }
}

/**
 * Follows `moves` (old repository path to new path) through the other files of the repository: the Markdown and JSON files that are not themselves moved
 * get their links and their plain-text paths rewritten.
 * @returns {string[]} the files that changed
 */
export function followMoves({ root, moves }) {
  const touched = []
  for (const path of listFiles(root).filter(
    (name) => /\.(md|json)$/.test(name) && !moves.has(name) && !name.startsWith('docs/temp/')
  )) {
    const original = readFileSync(join(root, path), 'utf8')
    const next = replacePaths(path.endsWith('.md') ? rewriteLinks(original, path, path, moves) : original, moves)
    if (next !== original) {
      writeFileSync(join(root, path), next)
      touched.push(path)
    }
  }
  return touched
}
