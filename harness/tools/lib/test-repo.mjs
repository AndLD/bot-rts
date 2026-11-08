// A seam for the tests of the security checks: a throw-away Git repository with the given files, all of them tracked (even the ones its .gitignore lists).
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const made = []

export const git = (root, ...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe', encoding: 'utf8' })

/** @param {Record<string, string | Buffer>} files */
export function repo(files) {
  const root = mkdtempSync(join(tmpdir(), 'security-'))
  made.push(root)
  git(root, 'init', '--quiet')
  git(root, 'config', 'user.email', 't@example.com')
  git(root, 'config', 'user.name', 't')
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true })
    writeFileSync(join(root, name), content)
  }
  git(root, 'add', '-A', '-f')
  return root
}

/** Removes the repositories made so far (`after(removeRepos)`). */
export const removeRepos = () => made.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }))
