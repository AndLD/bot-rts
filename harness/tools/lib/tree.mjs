// Files of a folder as the vendoring sees them: relative POSIX paths, SHA-256 of the bytes, and byte-identical copies (design §1.1).
import { createHash } from 'node:crypto'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'

// Files that an operating system or an editor leaves behind; they are never part of the framework
const IGNORED = new Set(['.DS_Store', 'Thumbs.db'])

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

export const hashFile = (path) => sha256(readFileSync(path))

/** Every file under `dir`, as sorted paths relative to it with `/` separators; an absent folder has none. */
export function walk(dir) {
  if (!existsSync(dir)) {
    return []
  }
  const files = []
  const visit = (relative) => {
    for (const entry of readdirSync(join(dir, relative), { withFileTypes: true })) {
      const path = relative ? `${relative}/${entry.name}` : entry.name
      if (IGNORED.has(entry.name)) {
        continue
      }
      if (entry.isDirectory()) {
        visit(path)
      } else if (entry.isFile()) {
        files.push(path)
      }
    }
  }
  visit('')
  return files.sort()
}

/** `{ path: sha256 }` for the given paths under `dir` (all of its files by default), in path order. */
export function hashTree(dir, paths = walk(dir)) {
  return Object.fromEntries(paths.map((path) => [path, hashFile(join(dir, path))]))
}

/** Copies `paths` from `from` to `to` byte for byte, keeping each file's mode (a hook stays executable). */
export function copyFiles(from, to, paths) {
  for (const path of paths) {
    const target = join(to, path)
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(join(from, path), target)
    chmodSync(target, statSync(join(from, path)).mode & 0o777)
  }
}
