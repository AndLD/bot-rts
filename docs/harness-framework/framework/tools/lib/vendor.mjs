// The vendored copy of the framework in a project (design §1): `sync` copies the distributable paths and the selected adapters into
// `harness/` and pins them in the lock, `checkVendored` proves the copy unchanged, `diff` shows a local change, and `detach` hands the copy
// to the project for good (§1.5). Every function takes the project root, so the tests run them on throwaway projects.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { generators as registered } from './generators.mjs'
import { extractBlock, hashBlock, replaceBlock } from './managed.mjs'
import { LOCK_FILE, MODES, VENDOR_DIR, profileHash, readLock, selectedAdapters, writeLock } from './lock.mjs'
import { loadProfile } from './profile.mjs'
import { readManifest, referenceTree, resolveSource } from './source.mjs'
import { copyFiles, hashFile, hashTree, walk } from './tree.mjs'

// The hash of the block `id` in a file's text; null when the markers are gone
const hashBlockOf = (text, id) => {
  const content = extractBlock(text, id)
  return content === null ? null : hashBlock(content)
}

const SYNC_HINT = 'change the framework source and run `harness sync`, or record an override in the lock (design §1.3)'
const LOCAL_HINT = 'run `harness sync --local`'

const describeSource = (source) =>
  source.type === 'git' ? `${source.url} at ${source.tag} (${source.commit.slice(0, 12)})` : source.location

/**
 * The files of a framework tree that a project receives: the distributable paths of `framework.json`, and of `adapters/` only the
 * selected adapters. Fails on a selected adapter the framework does not have.
 */
export function selectFiles(dir, manifest, adapters) {
  const files = walk(dir)
  const adapterFolders = [
    ...adapters.stacks.map((name) => `adapters/stack/${name}`),
    ...adapters.runtimes.map((name) => `adapters/runtime/${name}`),
    ...(adapters.host ? [`adapters/host/${adapters.host}`] : [])
  ]
  const inside = (folder) => (file) => file.startsWith(`${folder}/`)

  const unknown = adapterFolders.filter((folder) => !files.some(inside(folder)))
  if (unknown.length) {
    throw new Error(`the framework has no adapter ${unknown.join(', ')}; check adapters in the profile file`)
  }

  const selected = new Set()
  for (const path of manifest.distributable) {
    const matches =
      path === 'adapters'
        ? files.filter((file) => adapterFolders.some((folder) => inside(folder)(file)))
        : files.filter((file) => file === path || inside(path)(file))
    matches.forEach((file) => selected.add(file))
  }
  return [...selected].sort()
}

const managedPath = (generator, profile) =>
  typeof generator.path === 'function' ? generator.path(profile) : generator.path

/**
 * Writes every managed file (or the block of a file, when the generator names one) and returns their hashes, as the lock keeps them
 * (design §6.3): of a whole file, or of the block alone.
 */
function generateManaged(root, generators) {
  const profile = loadProfile(root)
  const managed = {}
  for (const generator of generators) {
    const path = managedPath(generator, profile)
    if (!path) {
      continue // a role the project's profile file does not have: `harness check profile` is what asks for it
    }
    const target = join(root, path)
    const content = generator.render({ root, profile })
    if (generator.block) {
      if (!existsSync(target)) {
        throw new Error(
          `${path} must exist, with the markers of the block "${generator.block}", before it can be generated`
        )
      }
      // A block has no line break at either end, so that what the lock hashes is what the file holds between its markers
      const trimmed = content.replace(/^\n+|\n+$/g, '')
      try {
        writeFileSync(target, replaceBlock(readFileSync(target, 'utf8'), generator.block, trimmed))
      } catch (error) {
        throw new Error(`${path}: ${error.message}`)
      }
      managed[path] = hashBlock(trimmed)
    } else {
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, content)
      managed[path] = hashFile(target)
    }
  }
  return managed
}

/**
 * `harness sync`: replaces `harness/` with the framework at `from` (or the locked source) and rewrites the lock; with `local`, only
 * regenerates the managed files from the vendored tree and the profile file, without fetching anything, in every mode.
 * @returns {{ lock: object, messages: string[] }}
 */
export function sync({ root, from, to, local = false, generators = registered }) {
  const lock = readLock(root)

  if (local) {
    if (!lock) {
      throw new Error(`there is no ${LOCK_FILE} yet: run \`harness sync --from <source>\` first`)
    }
    const next = { ...lock, managed: generateManaged(root, generators), profile: profileHash(root) }
    writeLock(root, next)
    const count = Object.keys(next.managed).length
    return { lock: next, messages: [`Regenerated ${count} managed file(s) from ${VENDOR_DIR}/ and the profile file.`] }
  }
  if (lock?.mode === MODES.detached) {
    throw new Error(
      `this project detached from the framework (${LOCK_FILE}: mode "detached"), so there is no version to take; ` +
        '`harness sync --local` regenerates the managed files'
    )
  }
  if (lock?.mode === MODES.self) {
    throw new Error(
      'this is the framework itself (mode "self"): there is nothing to vendor; `harness sync --local` regenerates the managed files'
    )
  }

  const profile = loadProfile(root)
  const adapters = profile.adapters || !lock ? selectedAdapters(profile) : lock.adapters
  const fetched = resolveSource({ root, from, to, lock })
  try {
    const paths = selectFiles(fetched.dir, fetched.manifest, adapters)
    const vendor = join(root, VENDOR_DIR)
    rmSync(vendor, { recursive: true, force: true })
    copyFiles(fetched.dir, vendor, paths)

    const { source, version } = fetched
    const sameRepository = source.type === 'git' && lock?.source?.type === 'git' && lock.source.url === source.url
    const next = {
      framework: fetched.manifest.name,
      mode: MODES.pinned,
      version,
      source,
      adapters,
      files: hashTree(vendor, paths),
      managed: generateManaged(root, generators),
      profile: profileHash(root),
      overrides: [],
      seen: source.type === 'git' ? { ...(sameRepository ? lock.seen : {}), [version]: source.commit } : undefined
    }
    writeLock(root, next)

    const messages = [`Synced ${paths.length} files of ${next.framework} ${version} from ${describeSource(source)}.`]
    for (const override of lock?.overrides ?? []) {
      messages.push(`Dropped the override of ${override.path} (${override.reason}): the synced version replaces it.`)
    }
    return { lock: next, messages }
  } finally {
    fetched.cleanup()
  }
}

/**
 * `harness check vendored`: the vendored copy, the managed files and the profile file against the lock.
 * @returns {{ problems: string[], notes: string[] }}
 */
export function checkVendored({ root, generators = registered }) {
  const lock = readLock(root)
  const vendor = join(root, VENDOR_DIR)
  const problems = []
  const notes = []

  if (!lock) {
    if (existsSync(vendor)) {
      problems.push(`${VENDOR_DIR}/ exists but ${LOCK_FILE} does not: run \`harness sync --from <source>\``)
    } else {
      notes.push('No vendored framework in this project.')
    }
    return { problems, notes }
  }

  if (lock.mode === MODES.pinned) {
    const actual = hashTree(vendor)
    const overrides = new Map((lock.overrides ?? []).map((override) => [override.path, override]))

    for (const [path, hash] of Object.entries(lock.files)) {
      const override = overrides.get(path)
      if (!(path in actual)) {
        problems.push(`${VENDOR_DIR}/${path} is missing: ${SYNC_HINT}`)
      } else if (actual[path] !== hash && override?.hash === actual[path]) {
        notes.push(
          `Override: ${VENDOR_DIR}/${path} differs from ${lock.version} (${override.reason}; ${override.issue}).`
        )
      } else if (actual[path] !== hash) {
        problems.push(`${VENDOR_DIR}/${path} was edited: ${SYNC_HINT}`)
      }
    }
    for (const path of Object.keys(actual).filter((path) => !(path in lock.files))) {
      problems.push(`${VENDOR_DIR}/${path} is not part of the framework: remove it, or ${SYNC_HINT}`)
    }

    // While the source is a folder of this project (the staging folder), the source and the copy change in the same pull request
    if (lock.source.type === 'path') {
      const dir = join(root, lock.source.location)
      if (existsSync(dir)) {
        const sourceHashes = hashTree(dir, selectFiles(dir, readManifest(dir), lock.adapters))
        if (JSON.stringify(sourceHashes) !== JSON.stringify(lock.files)) {
          problems.push(
            `the framework source ${lock.source.location} changed since the last sync: run \`harness sync\``
          )
        }
      } else {
        notes.push(`The source folder ${lock.source.location} is gone, so it was not compared with the copy.`)
      }
    }
  } else if (lock.mode === MODES.detached) {
    notes.push(
      `Detached (${lock.reason}): ${VENDOR_DIR}/ is the project's, so its files are not compared with the framework.`
    )
    if (!existsSync(join(vendor, 'LICENSE'))) {
      problems.push(
        `${VENDOR_DIR}/LICENSE is missing: the MIT license requires its copyright and permission notice to stay with the copy`
      )
    }
  } else {
    notes.push('The framework itself (mode "self"): there is no vendored copy.')
  }

  const profile = loadProfile(root)
  const blocks = new Map(
    generators.filter((generator) => generator.block).map((g) => [managedPath(g, profile), g.block])
  )
  for (const [path, hash] of Object.entries(lock.managed ?? {})) {
    const target = join(root, path)
    const block = blocks.get(path)
    const actual = !existsSync(target)
      ? null
      : block
        ? hashBlockOf(readFileSync(target, 'utf8'), block)
        : hashFile(target)
    if (actual !== hash) {
      problems.push(
        `the managed ${block ? 'block' : 'file'} ${path} differs from what the tools generated: ${LOCAL_HINT}`
      )
    }
  }
  if (lock.profile !== profileHash(root)) {
    problems.push(`the profile file changed since the managed files were generated: ${LOCAL_HINT}`)
  }

  return { problems, notes }
}

function unifiedDiff(from, to, label) {
  const result = spawnSync('git', ['diff', '--no-index', '--no-color', '--', from, to], { encoding: 'utf8' })
  const out = result.stdout
    .split('\n')
    .map((line) =>
      line.startsWith('diff --git ')
        ? `diff --git a/${label} b/${label}`
        : line
            .replace(/^--- (?!\/dev\/null).*/, `--- a/${label}`)
            .replace(/^\+\+\+ (?!\/dev\/null).*/, `+++ b/${label}`)
    )
  return out.join('\n').trimEnd()
}

/**
 * `harness diff`: what the project changed in `harness/`, against the locked version (pinned) or the fork point (detached). With the
 * reference's content within reach the changes are printed as unified diffs; otherwise as a list of paths.
 */
export function diff({ root }) {
  const lock = readLock(root)
  if (!lock) {
    throw new Error(`there is no ${LOCK_FILE}: nothing is vendored`)
  }
  if (lock.mode === MODES.self) {
    throw new Error('this is the framework itself (mode "self"): there is no vendored copy to compare')
  }
  const reference =
    lock.mode === MODES.detached
      ? { ...lock.base, what: 'the fork point' }
      : {
          framework: lock.framework,
          source: lock.source,
          version: lock.version,
          files: lock.files,
          what: 'the locked version'
        }

  const actual = hashTree(join(root, VENDOR_DIR))
  const paths = [...new Set([...Object.keys(reference.files), ...Object.keys(actual)])].sort()
  const changes = paths
    .map((path) => {
      if (!(path in actual)) return { path, kind: 'removed' }
      if (!(path in reference.files)) return { path, kind: 'added' }
      return actual[path] === reference.files[path] ? null : { path, kind: 'changed' }
    })
    .filter(Boolean)

  const header = `${VENDOR_DIR}/ against ${reference.framework} ${reference.version} (${reference.what})`
  if (changes.length === 0) {
    return `${header}: no change.`
  }

  const tree = referenceTree(root, reference.source, reference.version)
  try {
    const lines = [`${header}: ${changes.length} file(s).`]
    for (const { path, kind } of changes) {
      const label = `${VENDOR_DIR}/${path}`
      const original = tree && join(tree.dir, path)
      const reachable =
        kind === 'added' || (original && existsSync(original) && hashFile(original) === reference.files[path])
      if (!reachable) {
        lines.push(`${kind}: ${label} (the content of ${reference.what} is not within reach)`)
        continue
      }
      const before = kind === 'added' ? '/dev/null' : original
      const after = kind === 'removed' ? '/dev/null' : join(root, label)
      lines.push(unifiedDiff(before, after, label))
    }
    return lines.join('\n')
  } finally {
    tree?.cleanup()
  }
}

/**
 * `harness override <path> --reason <why> --issue <link>`: accepts the local edit of one vendored file until the next sync (design §1.3).
 * The lock keeps the edited file's hash, so a further edit fails the check again.
 * @returns {{ lock: object, messages: string[] }}
 */
export function override({ root, path, reason, issue }) {
  const lock = readLock(root)
  if (lock?.mode !== MODES.pinned) {
    throw new Error('an override exists only in a pinned project; a detached project owns every file')
  }
  if (!reason?.trim() || !issue?.trim()) {
    throw new Error('an override needs the reason and the framework issue: --reason "<why>" --issue "<link>"')
  }
  const relative = path.replace(/^\.\//, '').replace(new RegExp(`^${VENDOR_DIR}/`), '')
  if (!(relative in lock.files)) {
    throw new Error(`${VENDOR_DIR}/${relative} is not a vendored file`)
  }
  const target = join(root, VENDOR_DIR, relative)
  if (!existsSync(target)) {
    throw new Error(`${VENDOR_DIR}/${relative} is missing; an override keeps an edited file, not a removed one`)
  }

  const entry = { path: relative, hash: hashFile(target), reason: reason.trim(), issue: issue.trim() }
  const next = { ...lock, overrides: [...(lock.overrides ?? []).filter((item) => item.path !== relative), entry] }
  writeLock(root, next)
  return {
    lock: next,
    messages: [
      `Override recorded for ${VENDOR_DIR}/${relative}; the next sync drops it. Send the change to the framework (${entry.issue}).`
    ]
  }
}

/**
 * `harness detach --reason <why>`: the project takes the copy over (design §1.5). The hashes move to `base`, the fork point, so that
 * `harness diff` can still show what the project changed; there is no upstream any more.
 * @returns {{ lock: object, messages: string[] }}
 */
export function detach({ root, reason }) {
  if (!reason?.trim()) {
    throw new Error('detaching needs a reason that the lock keeps: harness detach --reason "<why>"')
  }
  const lock = readLock(root)
  if (lock?.mode !== MODES.pinned) {
    throw new Error(
      lock
        ? `only a pinned project can detach; this one is "${lock.mode}"`
        : `there is no ${LOCK_FILE}: nothing is vendored`
    )
  }

  const next = {
    framework: lock.framework,
    mode: MODES.detached,
    version: null,
    source: null,
    adapters: lock.adapters,
    reason: reason.trim(),
    base: { framework: lock.framework, source: lock.source, version: lock.version, files: lock.files },
    managed: lock.managed,
    profile: lock.profile
  }
  writeLock(root, next)

  return {
    lock: next,
    messages: [
      `Detached from ${lock.framework} ${lock.version}: ${VENDOR_DIR}/ is now the project's, and \`harness sync\` takes no more versions.`,
      `Keep ${VENDOR_DIR}/LICENSE: the MIT license requires its copyright and permission notice to stay with the copy.`
    ]
  }
}
