// The migration note of a version (task 3.11): `<release.migrations>/<version>.md`, what a project that takes the version from the previous one must do.
// The note has a fixed shape (`NOTE_HEADINGS`); the areas it lists are derived by `harness release` from the files that changed since the previous release
// (the globs of `areas.json` next to the notes), and written between two markers, so a note holds only what needs judgment.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { globToRegExp } from './layers.mjs'

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
