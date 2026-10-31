// The changelog tools (design §7.1): the fragments a behaviour change adds (`harness check changelog`), the preparation of a release on its
// branch (`harness release`), and the notes of one version for the host's release (`harness release notes <version>`). The version files are
// the project's (`release.versionFiles` of the profile file), so the tool works for any stack whose version sits in a JSON file.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/

export function parseVersion(version) {
  const match = SEMVER.exec(version)
  if (!match) {
    throw new Error(`"${version}" is not a version like 1.4.2`)
  }
  return match.slice(1).map(Number)
}

// `bump` is major | minor | patch, or an explicit version that must be higher than the current one
export function nextVersion(current, bump) {
  const [major, minor, patch] = parseVersion(current)

  if (bump === 'major') return `${major + 1}.0.0`
  if (bump === 'minor') return `${major}.${minor + 1}.0`
  if (bump === 'patch') return `${major}.${minor}.${patch + 1}`

  const [nextMajor, nextMinor, nextPatch] = parseVersion(bump)
  const isHigher = nextMajor !== major ? nextMajor > major : nextMinor !== minor ? nextMinor > minor : nextPatch > patch
  if (!isHigher) {
    throw new Error(`${bump} is not higher than the current version ${current}`)
  }
  return bump
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
export function releaseChangelog(text, version, date, repoUrl, fragments = []) {
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

  const released = `${content.slice(0, bodyStart)}\n\n## [${version}] - ${date}\n\n${body}\n${content.slice(bodyEnd)}`
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

const RELEASE_BRANCH = /^(release|hotfix)\/(\d+\.\d+\.\d+)$/

/**
 * `harness release [--dry-run]`, on a branch `release/<x.y.z>` or `hotfix/<x.y.z>`: sets the version in every version file, moves the entries under
 * "Unreleased" and those of the fragments to a section of the version, removes the fragments and runs the lock command of the profile. It
 * commits and tags nothing.
 * @returns {string[]} what it did or would do
 */
export function release({ root, profile, dryRun = false, date = new Date().toISOString().slice(0, 10) }) {
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

  const current = JSON.parse(readFileSync(join(root, versionFiles[0]), 'utf8')).version
  const version = nextVersion(current, match[2])
  const fragmentsDir = join(root, profile.paths.changelogFragments)
  const names = fragmentFiles(fragmentsDir)
  const fragments = names.map((name) => parseFragment(name, readFileSync(join(fragmentsDir, name), 'utf8')))
  const changelogPath = join(root, profile.paths.changelog)
  const changelog = releaseChangelog(
    readFileSync(changelogPath, 'utf8'),
    version,
    date,
    profile.repository.url,
    fragments
  )

  const lines = [`${branch}: ${current} -> ${version} (${date}), ${fragments.length} changelog fragments`]
  if (dryRun) {
    return [...lines, 'Dry run: nothing was written.']
  }
  for (const file of versionFiles) {
    const manifest = JSON.parse(readFileSync(join(root, file), 'utf8'))
    writeFileSync(join(root, file), `${JSON.stringify({ ...manifest, version }, null, 2)}\n`)
  }
  writeFileSync(changelogPath, changelog)
  names.forEach((name) => rmSync(join(fragmentsDir, name)))
  const lockCommand = profile.release?.lockCommand
  if (lockCommand) {
    const [command, ...args] = lockCommand.split(' ')
    if (spawnSync(command, args, { cwd: root, stdio: 'inherit' }).status !== 0) {
      throw new Error(`${lockCommand} failed`)
    }
  }
  return [
    ...lines,
    `Done. Review the diff, then: git commit -am "chore(release): ${version}" and open the pull request into ${profile.branches.production}.`
  ]
}
