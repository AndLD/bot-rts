import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addFragments, nextVersion, parseFragment, parseVersion, releaseChangelog, releaseNotes } from './changelog.mjs'

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

test('parseFragment reads the kind and the entry, and keeps a multi-line entry together', () => {
  assert.deepEqual(parseFragment('a.md', 'Added: A new thing.\n'), { kind: 'Added', entry: 'A new thing.' })
  assert.deepEqual(parseFragment('a.md', 'Fixed: First line\ncontinues here.'), {
    kind: 'Fixed',
    entry: 'First line\n  continues here.'
  })
})

test('parseFragment refuses a fragment without a known kind', () => {
  assert.throws(() => parseFragment('b.md', 'A new thing.'), /b\.md: a changelog fragment starts with/)
  assert.throws(() => parseFragment('c.md', 'Improved: x'), /c\.md/)
  assert.throws(() => parseFragment('d.md', 'Added:'), /d\.md/)
})

test('addFragments appends to an existing section and creates the missing ones in the order of the kinds', () => {
  const body = '### Fixed\n\n- Old fix.\n\n### Added\n\n- Old thing.'
  const fragments = [
    { kind: 'Fixed', entry: 'New fix.' },
    { kind: 'Security', entry: 'Closed a hole.' },
    { kind: 'Changed', entry: 'A change.' },
    { kind: 'Added', entry: 'New thing.' }
  ]
  assert.equal(
    addFragments(body, fragments),
    '### Fixed\n\n- Old fix.\n- New fix.\n\n### Added\n\n- Old thing.\n- New thing.\n\n### Changed\n\n- A change.\n\n### Security\n\n- Closed a hole.'
  )
  assert.equal(addFragments('', [{ kind: 'Added', entry: 'x' }]), '### Added\n\n- x')
  assert.equal(addFragments('### Added\n\n- a', []), '### Added\n\n- a')
})

test('releaseChangelog releases the fragments too, and an Unreleased list that has only fragments', () => {
  const only = '# Changelog\n\n## [Unreleased]\n\n'
  const result = releaseChangelog(only, '1.0.0', '2026-11-01', REPO, [{ kind: 'Added', entry: 'From a fragment.' }])
  assert.match(result, /## \[1\.0\.0\] - 2026-11-01\n\n### Added\n\n- From a fragment\./)
  assert.throws(() => releaseChangelog(only, '1.0.0', '2026-11-01', REPO, []), /nothing/)
})
