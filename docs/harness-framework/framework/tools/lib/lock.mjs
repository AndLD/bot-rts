// The lock (`harness.lock.json`) and the project's profile file as the vendoring reads them (design §1.1, §1.5).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PROFILE_FILE } from './profile.mjs'
import { hashFile } from './tree.mjs'

export const LOCK_FILE = 'harness.lock.json'
export const VENDOR_DIR = 'harness'
export const MODES = Object.freeze({ pinned: 'pinned', detached: 'detached', self: 'self' })

// The order in which the lock's fields are written, so that a rewrite changes only what changed
const LOCK_FIELDS = [
  'framework',
  'mode',
  'version',
  'source',
  'adapters',
  'reason',
  'base',
  'files',
  'managed',
  'profile',
  'overrides',
  'seen'
]

export function readLock(root) {
  const path = join(root, LOCK_FILE)
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null
}

export function writeLock(root, lock) {
  const ordered = Object.fromEntries(
    LOCK_FIELDS.filter((field) => lock[field] !== undefined).map((field) => [field, lock[field]])
  )
  writeFileSync(join(root, LOCK_FILE), `${JSON.stringify(ordered, null, 2)}\n`)
}

/** The path of the profile file relative to `root`, or null when the project has none. */
export function profilePath(root) {
  return existsSync(join(root, PROFILE_FILE)) ? PROFILE_FILE : null
}

/** The hash the lock keeps of the profile file the managed files were generated from (null without a profile). */
export function profileHash(root) {
  const path = profilePath(root)
  return path ? hashFile(join(root, path)) : null
}

/**
 * The adapters a project selected in its profile (`adapters.stacks`, `adapters.runtimes`, `adapters.host`), as adapter names.
 * A stack entry is a name or `{ "adapter": <name>, … }` (design §4.1, several stacks per project).
 */
export function selectedAdapters(profile) {
  const adapters = profile.adapters ?? {}
  const name = (entry) => (typeof entry === 'string' ? entry : entry?.adapter)

  return {
    stacks: (adapters.stacks ?? []).map(name),
    runtimes: (adapters.runtimes ?? []).map(name),
    host: adapters.host ?? null
  }
}
