// Where a sync takes the framework from (design §1.1): a folder (the staging folder while the framework is built inside a project), or a Git
// repository and a version tag. A tag that once pointed to another commit is refused (a moved tag).
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

// `scheme://…` or `user@host:path`; a local repository is given as `file://<path>`, a plain path is a folder source
const isGitUrl = (spec) => /^[a-z][a-z0-9+.-]*:\/\//i.test(spec) || /^[^/\s]+@[^/\s]+:/.test(spec)

export function readManifest(dir) {
  const path = join(dir, 'framework.json')
  if (!existsSync(path)) {
    throw new Error(`${dir} holds no framework.json, so it is not a framework source`)
  }
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** The tags of a Git repository as `{ tag: commit }`, an annotated tag resolved to the commit it points to. */
export function remoteTags(url) {
  const tags = {}
  for (const line of git(['ls-remote', '--tags', url]).split('\n').filter(Boolean)) {
    const [commit, ref] = line.split('\t')
    const peeled = ref.endsWith('^{}')
    const tag = ref.replace(/^refs\/tags\//, '').replace(/\^\{\}$/, '')
    if (peeled || !(tag in tags)) {
      tags[tag] = commit
    }
  }
  return tags
}

function folderSource(root, spec, to) {
  const dir = resolve(root, spec)
  const manifest = readManifest(dir)
  if (to && to !== manifest.version) {
    throw new Error(
      `the folder ${spec} holds version ${manifest.version}, not ${to}; a folder source has only the version it holds`
    )
  }
  const inside = relative(root, dir)
  const location = !inside.startsWith('..') && !isAbsolute(inside) ? inside.split('\\').join('/') : dir

  return { source: { type: 'path', location }, version: manifest.version, manifest, dir, cleanup: () => {} }
}

function gitSource(url, version, seen) {
  if (!version) {
    throw new Error(`a Git source needs the version to take: --to <version>`)
  }
  const tags = remoteTags(url)
  const tag = [version, `v${version}`].find((name) => name in tags)
  if (!tag) {
    throw new Error(`${url} has no tag ${version} or v${version}`)
  }
  const commit = tags[tag]
  if (seen[version] && seen[version] !== commit) {
    throw new Error(
      `the tag of ${version} moved: it pointed to ${seen[version]} and now points to ${commit}. A released version never changes; ` +
        'ask the framework owner, and do not sync it'
    )
  }

  const dir = mkdtempSync(join(tmpdir(), 'harness-sync-'))
  const cleanup = () => rmSync(dir, { recursive: true, force: true })
  try {
    git(['clone', '--quiet', '--depth', '1', '--branch', tag, url, dir])
    const head = git(['rev-parse', 'HEAD'], dir).trim()
    if (head !== commit) {
      throw new Error(`the tag ${tag} moved while it was fetched (${commit}, then ${head})`)
    }
    const manifest = readManifest(dir)
    if (manifest.version !== version) {
      throw new Error(`the tag ${tag} holds framework.json version ${manifest.version}, not ${version}`)
    }
    return { source: { type: 'git', url, tag, commit }, version, manifest, dir, cleanup }
  } catch (error) {
    cleanup()
    throw error
  }
}

/**
 * Resolves the source of a sync: `from` (a folder, or a Git URL), or the source of the lock when `from` is not given.
 * @returns {{ source: object, version: string, manifest: object, dir: string, cleanup: () => void }}
 *   `dir` holds the framework tree; `cleanup` removes it when it was fetched
 */
export function resolveSource({ root, from, to, lock }) {
  const locked = lock?.source
  const spec = from ?? (locked?.type === 'git' ? locked.url : locked?.location)
  if (!spec) {
    throw new Error('no source to sync from: pass --from <folder or Git URL>')
  }
  if (isGitUrl(spec)) {
    const sameRepository = locked?.type === 'git' && locked.url === spec
    return gitSource(spec, to ?? (sameRepository ? lock.version : undefined), lock?.seen ?? {})
  }
  return folderSource(root, spec, to)
}

/**
 * The framework tree at a locked or forked source, for `harness diff`; null when it cannot be reached (a folder that is gone, a repository
 * that cannot be fetched). Never throws.
 */
export function referenceTree(root, source, version) {
  try {
    if (source?.type === 'path') {
      const dir = resolve(root, source.location)
      return existsSync(dir) ? { dir, cleanup: () => {} } : null
    }
    if (source?.type === 'git') {
      const fetched = gitSource(source.url, version, { [version]: source.commit })
      return { dir: fetched.dir, cleanup: fetched.cleanup }
    }
  } catch {
    return null
  }
  return null
}
