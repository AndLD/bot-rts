// The pure parts of scripts/release.mjs (version arithmetic and CHANGELOG edits), kept apart so that they can be tested.

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

const LINK = /^\[[^\]]+\]: .*$/

// Moves the entries under "Unreleased" to a section of the version, leaves an empty "Unreleased", and keeps the comparison links
// at the end of the file (`[1.2.0]: <repo>/compare/v1.1.0...v1.2.0`)
export function releaseChangelog(text, version, date, repoUrl) {
  const start = text.indexOf(UNRELEASED)
  if (start < 0) {
    throw new Error('CHANGELOG.md has no "## [Unreleased]" section')
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
  const body = content.slice(bodyStart, bodyEnd).trim()
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
    throw new Error(`CHANGELOG.md has no section for ${version}`)
  }
  const rest = text.slice(match.index + match[0].length)
  const end = rest.search(/\n## \[|\n\[[^\]]+\]: /)
  return (end < 0 ? rest : rest.slice(0, end)).trim()
}
