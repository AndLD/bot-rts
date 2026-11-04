// The changelog tools (design §7.1): the fragments a behaviour change adds (`harness check changelog`), the preparation of a release on its
// branch (`harness release`), and the notes of one version for the host's release (`harness release notes <version>`). The version files are
// the project's (`release.versionFiles` of the profile file), so the tool works for any stack whose version sits in a JSON file.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import {
  areasOf,
  noteProblems,
  notePath,
  noteStub,
  placeholderProblems,
  previousTag,
  readAreas,
  WATCHED,
  withAreas
} from './migration-notes.mjs'

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/
// The version a development line is at, before the release it leads to: 0.1.0-dev.1 comes before 0.1.0
const DEVELOPMENT = /^(\d+)\.(\d+)\.(\d+)-[0-9A-Za-z.-]+$/

export function parseVersion(version) {
  const match = SEMVER.exec(version)
  if (!match) {
    throw new Error(`"${version}" is not a version like 1.4.2`)
  }
  return match.slice(1).map(Number)
}

// `bump` is major | minor | patch, or an explicit version that must be higher than the current one. A current version that is a development version
// (`0.1.0-dev.1`) is below its own release: `patch` and `0.1.0` both give 0.1.0.
export function nextVersion(current, bump) {
  const development = DEVELOPMENT.exec(current)
  const [major, minor, patch] = development ? development.slice(1).map(Number) : parseVersion(current)

  if (bump === 'major') return `${major + 1}.0.0`
  if (bump === 'minor') return `${major}.${minor + 1}.0`
  if (bump === 'patch') return development ? `${major}.${minor}.${patch}` : `${major}.${minor}.${patch + 1}`

  const [nextMajor, nextMinor, nextPatch] = parseVersion(bump)
  const isHigher =
    nextMajor !== major
      ? nextMajor > major
      : nextMinor !== minor
        ? nextMinor > minor
        : development
          ? nextPatch >= patch
          : nextPatch > patch
  if (!isHigher) {
    throw new Error(`${bump} is not higher than the current version ${current}`)
  }
  return bump
}

/**
 * The next development version of a release: 0.1.1 gives 0.1.1-dev.1, then 0.1.1-dev.2, by the tags the repository already has (`tags`, with or
 * without the `v`). A project syncs a development version to run its checks before the final tag.
 */
export function nextDevelopmentVersion(version, tags) {
  const prefix = `${version}-dev.`
  const taken = tags
    .map((tag) => tag.replace(/^v/, ''))
    .filter((tag) => tag.startsWith(prefix))
    .map((tag) => Number(tag.slice(prefix.length)))
    .filter(Number.isInteger)
  return `${prefix}${Math.max(0, ...taken) + 1}`
}

const UNRELEASED = '## [Unreleased]'

// The headings of Keep a Changelog, in the order a release lists them
export const CHANGELOG_KINDS = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security']

// A changelog fragment is a file of the changelog fragments folder whose text is `<Kind>: <entry>`; the entry may go on over
// several lines. Returns { kind, entry }, or throws with the name of the file.
export function parseFragment(name, text) {
  const match = /^([A-Za-z]+): ([\s\S]+)$/.exec(text.trim())
  if (!match || !CHANGELOG_KINDS.includes(match[1])) {
    throw new Error(`${name}: a changelog fragment starts with "<kind>: " where kind is ${CHANGELOG_KINDS.join(', ')}`)
  }
  return { kind: match[1], entry: match[2].trim().replace(/\n\s*/g, '\n  ') }
}

// Adds the entries of the fragments to the end of their sections in the body of "Unreleased", creating the sections that are missing
export function addFragments(body, fragments) {
  let result = body.trim()
  for (const kind of CHANGELOG_KINDS) {
    const entries = fragments.filter((fragment) => fragment.kind === kind).map(({ entry }) => `- ${entry}`)
    if (!entries.length) {
      continue
    }
    const heading = result.indexOf(`### ${kind}\n`)
    if (heading < 0) {
      result = `${result}${result ? '\n\n' : ''}### ${kind}\n\n${entries.join('\n')}`
      continue
    }
    const next = result.indexOf('\n### ', heading + 1)
    const end = next < 0 ? result.length : next
    result = `${result.slice(0, end).trimEnd()}\n${entries.join('\n')}${next < 0 ? '' : '\n'}${result.slice(end)}`
  }
  return result
}

const LINK = /^\[[^\]]+\]: .*$/

// Moves the entries under "Unreleased", and those of the fragments, to a section of the version, leaves an empty "Unreleased", and keeps the comparison links
// at the end of the file (`[1.2.0]: <repo>/compare/v1.1.0...v1.2.0`)
export function releaseChangelog(text, version, date, repoUrl, fragments = [], noteLink = null) {
  const start = text.indexOf(UNRELEASED)
  if (start < 0) {
    throw new Error('The changelog has no "## [Unreleased]" section')
  }

  const lines = text.trimEnd().split('\n')
  const links = []
  while (lines.length && (LINK.test(lines.at(-1)) || lines.at(-1) === '')) {
    const line = lines.pop()
    if (line) links.unshift(line)
  }
  const content = lines.join('\n')

  const bodyStart = content.indexOf(UNRELEASED) + UNRELEASED.length
  const next = content.slice(bodyStart).search(/\n## \[/)
  const bodyEnd = next < 0 ? content.length : bodyStart + next
  const body = addFragments(content.slice(bodyStart, bodyEnd), fragments)
  if (!body) {
    throw new Error('There is nothing under "## [Unreleased]" to release')
  }

  const previous = links.map((link) => /^\[(\d+\.\d+\.\d+)\]:/.exec(link)?.[1]).find(Boolean)
  const kept = links.filter((link) => !link.startsWith('[Unreleased]:'))
  const comparison = previous
    ? `[${version}]: ${repoUrl}/compare/v${previous}...v${version}`
    : `[${version}]: ${repoUrl}/releases/tag/v${version}`

  const migration = noteLink ? `Migration note: ${noteLink}\n` : ''
  const released = `${content.slice(0, bodyStart)}\n\n## [${version}] - ${date}\n\n${migration}${migration ? '\n' : ''}${body}\n${content.slice(bodyEnd)}`
  return `${released.trimEnd()}\n\n${[`[Unreleased]: ${repoUrl}/compare/v${version}...HEAD`, comparison, ...kept].join('\n')}\n`
}

// The text of one version's section, for the notes of a GitHub release
export function releaseNotes(text, version) {
  const heading = new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\].*$`, 'm')
  const match = heading.exec(text)
  if (!match) {
    throw new Error(`The changelog has no section for ${version}`)
  }
  const rest = text.slice(match.index + match[0].length)
  const end = rest.search(/\n## \[|\n\[[^\]]+\]: /)
  return (end < 0 ? rest : rest.slice(0, end)).trim()
}

// The fragment files of a folder: every Markdown file except its README, in name order
export function fragmentFiles(dir) {
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => name.endsWith('.md') && name !== 'README.md')
        .sort()
    : []
}

/**
 * `harness check changelog`: every changelog fragment starts with a Keep a Changelog kind.
 * @returns {{ problems: string[], message: string }}
 */
export function checkChangelog({ root, profile }) {
  const dir = join(root, profile.paths.changelogFragments)
  const names = fragmentFiles(dir)
  const problems = []
  for (const name of names) {
    try {
      parseFragment(name, readFileSync(join(dir, name), 'utf8'))
    } catch (error) {
      problems.push(error.message)
    }
  }
  return { problems, message: `Checked ${names.length} changelog fragments.` }
}

// The `version = "x.y.z"` line of the `[project]` table of a TOML file, which a Python project keeps its version in; every other version file is JSON
const PROJECT_VERSION = /(^\[project\]\s*\n(?:(?!\[)[^\n]*\n)*?version\s*=\s*)(["'])([^"']*)\2/m
const isToml = (file) => file.endsWith('.toml')

/** The version in the text of a version file (a JSON file with a `version`, or the `[project]` table of a TOML file). */
export function readVersion(file, text) {
  const version = isToml(file) ? PROJECT_VERSION.exec(text)?.[3] : JSON.parse(text).version
  if (!version) {
    throw new Error(`${file} has no version${isToml(file) ? ' in its [project] table' : ''}`)
  }
  return version
}

/** The text of a version file with its version set; the rest of the file is kept as it is, so that a formatter finds nothing to change. */
export function writeVersion(file, text, version) {
  const current = readVersion(file, text)
  return isToml(file)
    ? text.replace(PROJECT_VERSION, `$1$2${version}$2`)
    : text.replace(
        new RegExp(`("version"\\s*:\\s*)"${current.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`),
        `$1"${version}"`
      )
}

// The release version before `version`, as the changelog's comparison links have it
const previousRelease = (changelogText) => /^\[(\d+\.\d+\.\d+)\]:/m.exec(changelogText)?.[1]

/**
 * The migration note of a release, a development version included (`release.migrations` of the profile file): it must exist and have its shape, its required
 * actions must hold no placeholder, and its areas are derived from the files that changed in the watched folders since the previous release (for a
 * development version: the previous development version of the same `x.y.z`, else the previous final one). When the note is missing, a stub with the
 * changelog fragments and the areas is written (unless `dryRun`) and the release stops. Returns the note with the areas written, and the areas.
 */
function migrationNote({ root, profile, git, version, changelogText, dev, dryRun, fragments }) {
  const folder = profile.release.migrations
  const path = notePath(folder, version)
  const tags = git('tag', '--list').split('\n').filter(Boolean)
  const lastFinal = previousRelease(changelogText)
  if (lastFinal && !tags.includes(`v${lastFinal}`)) {
    throw new Error(`the tag v${lastFinal} of the previous release is not in this clone: git fetch --tags`)
  }
  const previous = dev ? previousTag(version, tags) : lastFinal && { version: lastFinal, tag: `v${lastFinal}` }
  const changed = previous
    ? git('diff', '--name-only', previous.tag, '--', ...WATCHED)
        .split('\n')
        .filter(Boolean)
    : []
  const { areas, unmatched } = areasOf(changed, readAreas(root, folder))
  if (unmatched.length) {
    throw new Error(`${folder}/areas.json has no area for: ${unmatched.join(', ')}`)
  }

  if (!existsSync(join(root, path))) {
    const missing = `the migration note ${path} is missing: write it before the release (a version that needs nothing from a project says so)`
    if (dryRun) {
      throw new Error(missing)
    }
    // The fragments of the version: for a development version those added since the previous release, since the earlier ones are in the earlier notes
    const added = previous
      ? git('diff', '--name-only', '--diff-filter=A', previous.tag, '--', profile.paths.changelogFragments)
          .split('\n')
          .filter(Boolean)
          .map((file) => file.split('/').at(-1))
      : null
    const listed = dev && added ? fragments.filter(({ name }) => added.includes(name)) : fragments
    writeFileSync(
      join(root, path),
      noteStub({ version, previous: previous?.version ?? null, fragments: listed, areas })
    )
    throw new Error(
      `${missing}. A stub with the changelog fragments and the areas is written to ${path}: complete it, commit it, and run the release again`
    )
  }
  const text = readFileSync(join(root, path), 'utf8')
  const problems = [...noteProblems(text, version), ...placeholderProblems(text)]
  if (problems.length) {
    throw new Error(`${path}: ${problems.join('; ')}`)
  }
  return { path, areas, text: withAreas(text, areas) }
}

const RELEASE_BRANCH = /^(release|hotfix)\/(\d+\.\d+\.\d+)$/

/**
 * `harness release [--dry-run]`, on a branch `release/<x.y.z>` or `hotfix/<x.y.z>`: sets the version in every version file (JSON, or the `[project]` table of a TOML file), moves the entries under
 * "Unreleased" and those of the fragments to a section of the version, removes the fragments and runs the lock command of the profile. It
 * commits and tags nothing. With `dev` it only sets the next development version of the release (`0.1.1-dev.1`), which is tagged first so that
 * projects can sync it before the final tag: the changelog and the fragments stay as they are.
 * @returns {string[]} what it did or would do
 */
export function release({ root, profile, dryRun = false, dev = false, date = new Date().toISOString().slice(0, 10) }) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
  const versionFiles = profile.release?.versionFiles ?? ['package.json']

  const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
  const match = RELEASE_BRANCH.exec(branch)
  if (!match) {
    throw new Error(`run this on a branch named release/<x.y.z> or hotfix/<x.y.z>, not on "${branch}"`)
  }
  if (!dryRun && git('status', '--porcelain')) {
    throw new Error('the working tree is not clean: commit or stash first')
  }

  const current = readVersion(versionFiles[0], readFileSync(join(root, versionFiles[0]), 'utf8'))
  const target = nextVersion(current, match[2])
  const version = dev ? nextDevelopmentVersion(target, git('tag', '--list').split('\n')) : target
  const fragmentsDir = join(root, profile.paths.changelogFragments)
  const names = fragmentFiles(fragmentsDir)
  const fragments = names.map((name) => ({
    name,
    ...parseFragment(name, readFileSync(join(fragmentsDir, name), 'utf8'))
  }))
  const changelogPath = join(root, profile.paths.changelog)
  const changelogText = readFileSync(changelogPath, 'utf8')
  const note = profile.release?.migrations
    ? migrationNote({ root, profile, git, version, changelogText, dev, dryRun, fragments })
    : null
  const noteLink =
    note && `[${note.path}](${relative(dirname(changelogPath), join(root, note.path)).replace(/\\/g, '/')})`
  const changelog = dev
    ? null
    : releaseChangelog(changelogText, version, date, profile.repository.url, fragments, noteLink)

  const lines = [
    ...(note
      ? [`${note.path}: ${note.areas.length ? `areas touched: ${note.areas.join(', ')}` : 'no area touched'}`]
      : []),
    dev
      ? `${branch}: ${current} -> ${version} (a development version: no changelog entry)`
      : `${branch}: ${current} -> ${version} (${date}), ${fragments.length} changelog fragments`
  ]
  if (dryRun) {
    return [...lines, 'Dry run: nothing was written.']
  }
  for (const file of versionFiles) {
    writeFileSync(join(root, file), writeVersion(file, readFileSync(join(root, file), 'utf8'), version))
  }
  if (note) {
    writeFileSync(join(root, note.path), note.text)
  }
  if (!dev) {
    writeFileSync(changelogPath, changelog)
    names.forEach((name) => rmSync(join(fragmentsDir, name)))
  }
  const lockCommand = profile.release?.lockCommand
  if (lockCommand) {
    const [command, ...args] = lockCommand.split(' ')
    if (spawnSync(command, args, { cwd: root, stdio: 'inherit' }).status !== 0) {
      throw new Error(`${lockCommand} failed`)
    }
  }
  if (dev) {
    return [
      ...lines,
      `Done. Commit it with its migration note (chore(release): ${version}) and tag the commit ${version} (no "v": a tag with it is a release); the final release is made with \`harness release\`.`
    ]
  }
  return [
    ...lines,
    `Done. Review the diff, then: git commit -am "chore(release): ${version}" and open the pull request into ${profile.branches.production}.`
  ]
}
