// The migration note of a version (task 3.11): `<release.migrations>/<version>.md`, what a project that takes the version from the previous one must do.
// The note has a fixed shape (`NOTE_HEADINGS`); the areas it lists are derived by `harness release` from the files that changed since the previous release
// (the globs of `areas.json` next to the notes), and written between two markers, so a note holds only what needs judgment.
// Every version has a note, a development version (`<x.y.z>-dev.<n>`) included (task 4.8): a development note says what a project does when it takes that
// version from the previous one, and is frozen once the version ships; the final note is the complete story from the previous final version.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { globToRegExp } from './layers.mjs'
import { baseVersion, compareVersions, isDevelopment, parseVersion } from './versions.mjs'

export const AREAS_FILE = 'areas.json'
export const AREAS_BEGIN = '<!-- areas:begin -->'
export const AREAS_END = '<!-- areas:end -->'

// The folders whose changes decide the areas of a version
export const WATCHED = ['core', 'tools', 'adapters', 'profile']

export const NOTE_HEADINGS = [
  'What changed for a project',
  'Areas touched',
  'Required actions',
  'Optional actions',
  'How to verify'
]

export const notePath = (folder, version) => `${folder}/${version}.md`

// The word a stub of a note leaves where the author has to write; a release is refused while the required actions still hold it
export const PLACEHOLDER = 'TODO'

/**
 * The notes that a project moving from `from` to `target` reads, in version order: those of the versions after its own up to the target, except that the
 * notes of the development versions of an `x.y.z` are left out when the final note of it is among them (the final one covers them).
 * @param {{ version: string, note?: string }[]} entries the versions that have a note or a script, oldest first
 */
export function selectNotes(entries, from, target) {
  const inRange = entries.filter(
    ({ note, version }) => note && compareVersions(version, from) > 0 && compareVersions(version, target) <= 0
  )
  const finals = new Set(inRange.filter(({ version }) => !isDevelopment(version)).map(({ version }) => version))
  return inRange.filter(({ version }) => !(isDevelopment(version) && finals.has(baseVersion(version))))
}

/**
 * The release a note of `version` is written against, from the tags of the repository (with the `v` of a final version, without it for a development one):
 * the previous development version of the same `x.y.z` when there is one, else the previous final version. Null when there is none.
 * @returns {{ version: string, tag: string } | null}
 */
export function previousTag(version, tags) {
  const base = baseVersion(version)
  const known = tags.flatMap((tag) => {
    try {
      return [{ tag, version: tag.replace(/^v/, ''), pre: parseVersion(tag).pre }]
    } catch {
      return []
    }
  })
  const newest = (list) => list.sort((a, b) => compareVersions(b.version, a.version))[0] ?? null
  const earlier = isDevelopment(version)
    ? newest(
        known.filter(
          (item) => item.pre && baseVersion(item.version) === base && compareVersions(item.version, version) < 0
        )
      )
    : null
  const found = earlier ?? newest(known.filter((item) => !item.pre && compareVersions(item.version, base) < 0))
  return found && { version: found.version, tag: found.tag }
}

export const readAreas = (root, folder) => JSON.parse(readFileSync(join(root, folder, AREAS_FILE), 'utf8'))

/** The problems of a note's shape: its title, its five sections in order, and the one pair of area markers. */
export function noteProblems(text, version) {
  const problems = []
  if (
    !new RegExp(`^# Migration to ${version.replace(/\./g, '\\.')}( from \\S+)?\\s*$`, 'm').test(
      text.split('\n')[0] ?? ''
    )
  ) {
    problems.push(`the first line must be "# Migration to ${version} from <previous version>"`)
  }
  const headings = [...text.matchAll(/^## (.+?)\s*$/gm)].map((match) => match[1])
  if (headings.join('|') !== NOTE_HEADINGS.join('|')) {
    problems.push(`the sections must be, in order: ${NOTE_HEADINGS.map((heading) => `"${heading}"`).join(', ')}`)
  }
  if (
    text.split(AREAS_BEGIN).length !== 2 ||
    text.split(AREAS_END).length !== 2 ||
    text.indexOf(AREAS_BEGIN) > text.indexOf(AREAS_END)
  ) {
    problems.push(
      `the section "Areas touched" must hold one ${AREAS_BEGIN} and one ${AREAS_END}, which \`harness release\` fills`
    )
  }
  return problems
}

/**
 * The areas the changed `paths` touch, in the order of the list, and the paths that belong to no area (not ignored either).
 * @returns {{ areas: string[], unmatched: string[] }}
 */
export function areasOf(paths, { ignore = [], areas }) {
  const ignored = ignore.map(globToRegExp)
  const lists = Object.entries(areas).map(([name, globs]) => [name, globs.map(globToRegExp)])
  const touched = new Set()
  const unmatched = []
  for (const path of paths.filter((path) => !ignored.some((pattern) => pattern.test(path)))) {
    const area = lists.find(([, patterns]) => patterns.some((pattern) => pattern.test(path)))
    if (area) touched.add(area[0])
    else unmatched.push(path)
  }
  return { areas: lists.map(([name]) => name).filter((name) => touched.has(name)), unmatched }
}

/** The text of a note with the list between its area markers replaced. */
export function withAreas(text, areas) {
  const list = areas.length ? areas.map((area) => `- ${area}`).join('\n') : 'None.'
  const begin = text.indexOf(AREAS_BEGIN) + AREAS_BEGIN.length
  return `${text.slice(0, begin)}\n${list}\n${text.slice(text.indexOf(AREAS_END))}`
}

/** The problems of a note whose required actions still hold the placeholder of a stub. */
export function placeholderProblems(text) {
  const section = /^## Required actions\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(text)?.[1] ?? ''
  return new RegExp(`\\b${PLACEHOLDER}\\b`).test(section)
    ? [
        `the required actions still hold a ${PLACEHOLDER}: write them (each with the check that proves it), or say that the version needs nothing from a project`
      ]
    : []
}

/**
 * The stub of a note that does not exist yet, in its shape: the changelog fragments of the version as the raw material of "What changed", the areas the
 * version touched, and the placeholder in the required actions.
 * @param {{ version: string, previous: string|null, fragments: { kind: string, entry: string }[], areas: string[] }} input
 */
export function noteStub({ version, previous, fragments, areas }) {
  const changes = fragments.length
    ? fragments.map(({ kind, entry }) => `- ${kind}: ${entry}`).join('\n')
    : '- (no changelog fragment)'
  return withAreas(
    [
      `# Migration to ${version} from ${previous ?? '<previous version>'}`,
      '',
      `## ${NOTE_HEADINGS[0]}`,
      '',
      `${PLACEHOLDER}: say in a few lines each what a project can feel. The changelog fragments of this version, as the raw material (replace them):`,
      '',
      changes,
      '',
      `## ${NOTE_HEADINGS[1]}`,
      '',
      `${AREAS_BEGIN}`,
      AREAS_END,
      '',
      `## ${NOTE_HEADINGS[2]}`,
      '',
      `${PLACEHOLDER}: what the project must do, each action with the check that proves it is done; or say that the version needs nothing from a project.`,
      '',
      `## ${NOTE_HEADINGS[3]}`,
      '',
      'None.',
      '',
      `## ${NOTE_HEADINGS[4]}`,
      '',
      `\`node harness/tools/harness.mjs check all\` exits 0, and \`version\` in \`harness.lock.json\` is \`${version}\`.`,
      ''
    ].join('\n'),
    areas
  )
}
