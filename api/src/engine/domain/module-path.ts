import { ScriptLoadError } from './engine.errors'

// The extensions a script file may have; an import may leave the extension out and gets the first of these that exists
export const SCRIPT_EXTENSIONS = ['.js', '.ts', '.json'] as const

const PATH = /^\/([^/]+)\/(.+)$/

// The paths an import names, in the order to try them (design §10.1.1): relative to the importing file, on the same drive
// and nowhere else. Throws ScriptLoadError for anything else (bare names, absolute paths, leaving the drive).
export function importCandidates(importer: string, specifier: string): string[] {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    throw new ScriptLoadError(`Cannot import "${specifier}": only relative paths of the same drive are allowed`)
  }
  const match = PATH.exec(importer)
  if (!match) {
    throw new ScriptLoadError(`Cannot import from "${importer}": not a file of a drive`)
  }
  const [, drive, file] = match
  const parts = file.split('/').slice(0, -1)
  for (const segment of specifier.split('/')) {
    if (segment === '..') {
      if (!parts.length) {
        throw new ScriptLoadError(`Cannot import "${specifier}" from "${importer}": it leaves the drive`)
      }
      parts.pop()
    } else if (segment !== '.' && segment !== '') {
      parts.push(segment)
    }
  }
  const exact = `/${drive}/${parts.join('/')}`
  return SCRIPT_EXTENSIONS.some((extension) => exact.endsWith(extension))
    ? [exact]
    : SCRIPT_EXTENSIONS.map((extension) => `${exact}${extension}`)
}

// The module specifiers a compiled (JavaScript) file imports or re-exports
export function importsOf(source: string): string[] {
  const found: string[] = []
  const pattern = /(?:^|[\n;}])\s*(?:import|export)\b(?:[^'"`;]*?\bfrom\b)?\s*['"]([^'"\n]+)['"]/g
  for (const match of source.matchAll(pattern)) {
    found.push(match[1])
  }
  return found
}
