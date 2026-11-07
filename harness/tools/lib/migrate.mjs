// `harness migrate` (tasks 3.5 and 3.12): the second half of taking a version. `sync` only places the new version's files and updates the lock; this
// command runs in a new process, with the new version's tools, and brings the project's own files to the version:
//   1. runs the migration scripts (`migrations/<version>.mjs` of the vendored tree) of every version after the project's own up to the target that
//      are not recorded as applied, in version order, and records each in the lock (`migrations.applied`), so that a stopped run resumes;
//   2. regenerates the managed files, then runs the conformance suite of the new version on every adapter of the project's own repository (task 3.4),
//      and stops with the adapters named when one no longer meets its contract (nothing is committed; the adapter is fixed and the command run again);
//   3. prints the migration notes of the versions after the project's own up to the target, in order, for the agent or the person to follow (task 4.8): a
//      development version has a note of its own, and the notes of the development versions of an `x.y.z` are left out when its final note is among them.
// A lock without the record counts as `0.1.0` with nothing applied, unless the last commit holds the lock the project had before an older `sync`
// replaced its version: that version is where the project is. A script is `export default ({ root, profile }) => string[] | void` (it may be
// async); it checks its starting state, and it is run again without harm. The script of a development version's final version runs for the
// development version too, and is not recorded as applied, so each next development version runs it again.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { inFramework, MODES, readLock, writeLock } from './lock.mjs'
import { finalNoteAhead, selectNotes } from './migration-notes.mjs'
import { localSuiteProblems } from './local-adapters.mjs'
import { loadProfile } from './profile.mjs'
import { regenerate } from './vendor.mjs'
import { commitEverything, isRepository } from './migration-git.mjs'
import { startOfMigrate } from './migration-guard.mjs'
import { baseVersion, compareVersions, FIRST_VERSION, isDevelopment } from './versions.mjs'
import { probeAdvice, probeMode } from './probe-mode.mjs'

// A script is named for a final version (`0.2.0.mjs`); a note for any version, a development one included (`0.2.0-dev.1.md`)
const MIGRATION_FILE = /^(\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)\.(mjs|md)$/

/** The versions that have a script or a note in the migrations folder, with which of the two, oldest first. */
export function listMigrations(folder) {
  if (!existsSync(folder)) {
    return []
  }
  const found = new Map()
  for (const file of readdirSync(folder)) {
    const match = MIGRATION_FILE.exec(file)
    if (match && !(match[2] === 'mjs' && isDevelopment(match[1]))) {
      found.set(match[1], {
        ...found.get(match[1]),
        version: match[1],
        [match[2] === 'mjs' ? 'script' : 'note']: join(folder, file)
      })
    }
  }
  return [...found.values()].sort((a, b) => compareVersions(a.version, b.version))
}

/**
 * @returns {Promise<{ lock: object, messages: string[] }>}
 */
export async function migrate({ root, generators, profile = loadProfile(root), localSuite = localSuiteProblems }) {
  const lock = readLock(root)
  if (!lock) {
    throw new Error(
      'there is no harness.lock.json: nothing to migrate; `harness sync --from <source>` takes a version first'
    )
  }
  const messages = []
  if (lock.mode !== MODES.pinned) {
    return {
      ...regenerate({ root, generators }),
      messages: ['Regenerated the managed files (only a pinned project has migrations to run).']
    }
  }

  const target = lock.version
  // A migration is pending when the lock holds a version the project's files are not yet at; it is one commit, undone by `harness rollback`
  const undoable = isRepository(root) && lock.migrations?.version !== target
  const start = undoable ? startOfMigrate({ root, profile, lock }) : lock.migrations?.start
  const record = (version) => ({ version, applied, ...(start ? { start } : {}) })
  const from = lock.migrations?.version ?? start?.version ?? FIRST_VERSION
  const applied = [...(lock.migrations?.applied ?? [])]
  const listed = listMigrations(join(root, inFramework(profile, 'migrations')))
  const pending = listed.filter(
    ({ version }) => compareVersions(version, from) > 0 && compareVersions(version, baseVersion(target)) <= 0
  )

  for (const { version, script } of pending.filter(({ script }) => script)) {
    if (applied.includes(version)) {
      continue
    }
    const run = (await import(pathToFileURL(script).href)).default
    if (typeof run !== 'function') {
      throw new Error(`${script} must export a function by default: ({ root, profile }) => lines`)
    }
    const lines = (await run({ root, profile })) ?? []
    messages.push(`Migration script of ${version}:`, ...lines.map((line) => `  ${line}`))
    if (!(isDevelopment(target) && version === baseVersion(target))) {
      applied.push(version)
    }
    writeLock(root, { ...readLock(root), migrations: record(from) })
  }

  messages.push(...regenerate({ root, generators }).messages)
  const rejected = localSuite(root).problems
  if (rejected.length) {
    const notes = selectNotes(listed, from, target).map(
      ({ version, note }) => `${version} (${note.slice(root.length + 1)})`
    )
    throw new Error(
      [
        `${target} does not accept the adapters of this repository (harness-adapters/); the contract they were written for changed:`,
        ...rejected.map((problem) => `  ${problem}`),
        `The migration note${notes.length === 1 ? '' : 's'} of ${notes.join(', ') || target} say${notes.length === 1 ? 's' : ''} what changed in the contract. Fix the adapter, then run \`harness migrate\` again.`
      ].join('\n')
    )
  }
  const next = { ...readLock(root), migrations: record(target) }
  writeLock(root, next)

  if (undoable) {
    const committed = commitEverything(
      root,
      `chore(framework): migrate to ${target}\n\nFrom ${start.version} (${start.commit.slice(0, 12)}). \`harness rollback\` undoes this commit's changes.`
    )
    messages.push(
      committed
        ? 'Committed the migration as one commit; `harness rollback` undoes it.'
        : 'The migration changed no file.'
    )
  }

  for (const { version, note } of selectNotes(listed, from, target)) {
    messages.push(`Migration note of ${version} (follow its required actions):`, readFileSync(note, 'utf8').trimEnd())
  }
  const ahead = finalNoteAhead(listed, from, target)
  if (ahead) {
    messages.push(
      `Migration note of ${ahead.version} (the final version of this line, which you have not taken: read it now, it is the complete story, and do its required actions when you take ${ahead.version}):`,
      readFileSync(ahead.note, 'utf8').trimEnd()
    )
  }
  messages.push(...probeAdvice({ ...probeMode({ profile, root }), from, to: target }))
  messages.push(`Migrated to ${next.framework} ${target}.`)
  return { lock: next, messages }
}
