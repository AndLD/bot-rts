import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nextVersion, parseVersion, releaseChangelog, releaseNotes } from './release-lib.mjs'

const REPO = 'https://github.com/AndLD/bot-rts'

test('nextVersion bumps by kind or accepts a higher explicit version', () => {
  assert.equal(nextVersion('1.4.2', 'patch'), '1.4.3')
  assert.equal(nextVersion('1.4.2', 'minor'), '1.5.0')
  assert.equal(nextVersion('1.4.2', 'major'), '2.0.0')
  assert.equal(nextVersion('1.4.2', '1.4.10'), '1.4.10')
  assert.equal(nextVersion('1.4.2', '1.5.0'), '1.5.0')
  assert.equal(nextVersion('1.4.2', '3.0.0'), '3.0.0')
})

test('nextVersion refuses a version that is not higher, and anything that is not a version', () => {
  assert.throws(() => nextVersion('1.4.2', '1.4.2'), /not higher/)
  assert.throws(() => nextVersion('1.4.2', '1.3.9'), /not higher/)
  assert.throws(() => nextVersion('1.4.2', '0.9.0'), /not higher/)
  assert.throws(() => nextVersion('1.4.2', 'soon'), /not a version/)
  assert.throws(() => parseVersion('1.2'), /not a version/)
})

const FIRST = `# Changelog

## [Unreleased]

### Added

- The first things.

### Fixed

- A bug.
`

test('the first release moves the entries under the version and links its tag', () => {
  const result = releaseChangelog(FIRST, '1.0.0', '2026-11-01', REPO)

  assert.match(result, /## \[Unreleased\]\n\n## \[1\.0\.0\] - 2026-11-01\n\n### Added\n\n- The first things\./)
  assert.match(result, /\[Unreleased\]: .*\/compare\/v1\.0\.0\.\.\.HEAD\n\[1\.0\.0\]: .*\/releases\/tag\/v1\.0\.0\n$/)
})

test('a later release links the comparison with the previous one and keeps the older links', () => {
  const first = releaseChangelog(FIRST, '1.0.0', '2026-11-01', REPO)
  const second = releaseChangelog(
    first.replace('## [Unreleased]\n', '## [Unreleased]\n\n### Fixed\n\n- Another.\n'),
    '1.0.1',
    '2026-11-05',
    REPO
  )

  assert.match(second, /## \[Unreleased\]\n\n## \[1\.0\.1\] - 2026-11-05\n\n### Fixed\n\n- Another\.\n\n## \[1\.0\.0\]/)
  assert.match(
    second,
    /\[Unreleased\]: .*v1\.0\.1\.\.\.HEAD\n\[1\.0\.1\]: .*\/compare\/v1\.0\.0\.\.\.v1\.0\.1\n\[1\.0\.0\]: .*releases\/tag\/v1\.0\.0\n$/
  )
  assert.equal(second.match(/^\[Unreleased\]:/gm).length, 1)
})

test('releasing an empty Unreleased section, or a file without one, is refused', () => {
  assert.throws(() => releaseChangelog('# Changelog\n\n## [Unreleased]\n\n', '1.0.0', '2026-11-01', REPO), /nothing/)
  assert.throws(() => releaseChangelog('# Changelog\n', '1.0.0', '2026-11-01', REPO), /no "## \[Unreleased\]"/)
})

test('releaseNotes returns the section of one version only', () => {
  const first = releaseChangelog(FIRST, '1.0.0', '2026-11-01', REPO)
  const second = releaseChangelog(
    first.replace('## [Unreleased]\n', '## [Unreleased]\n\n- Another.\n'),
    '1.1.0',
    '2026-12-01',
    REPO
  )

  assert.equal(releaseNotes(second, '1.1.0'), '- Another.')
  assert.match(releaseNotes(second, '1.0.0'), /^### Added\n\n- The first things\.\n\n### Fixed\n\n- A bug\.$/)
  assert.throws(() => releaseNotes(second, '9.9.9'), /no section for 9\.9\.9/)
})
