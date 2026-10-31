// `harness check core`: the CORE files hold no stack term, product term or project value (the term lists are `terms` of the profile file). Two
// kinds of CORE are scanned: the project's CORE documents (the `layers.core` entries, some only in numbered sections), where the entry file's
// one "Role binding" line may name the project's values; and the framework's `core/` folder where the project owns it, whole: the staging
// folder of a framework built inside the project, the vendored copy of a detached project, or the framework's own repository (mode "self").
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { coreEntries } from './layers.mjs'
import { MODES, readLock, VENDOR_DIR } from './lock.mjs'
import { walk } from './tree.mjs'

export const BINDING_MARKER = '**Role binding.**'
export const DEFAULT_ENTRY_FILE = 'AGENTS.md'

// The product terms without the generic words (productGeneric), which are judged in context and not scanned
function productPattern(terms) {
  const generic = new Set((terms.productGeneric ?? '').split('|'))
  return terms.product
    .split('|')
    .filter((alternative) => !generic.has(alternative))
    .join('|')
}

// The lines of the numbered sections (`## 7.`), the others blanked so that line numbers stay true
function inSections(text, numbers) {
  let wanted = false
  return text.split('\n').map((line) => {
    const heading = line.match(/^## (\d+)\./)
    if (heading) {
      wanted = numbers.includes(heading[1])
    }
    return wanted ? line : ''
  })
}

function leakPatterns(terms) {
  return [
    ['stack term', new RegExp(terms.stack, 'i')],
    ['product term', new RegExp(productPattern(terms), 'i')],
    ['project value', new RegExp(terms.projectValues, 'i')]
  ]
}

function lineProblems(path, line, index, patterns) {
  const problems = []
  for (const [kind, pattern] of patterns) {
    const term = line.match(pattern)?.[0]
    if (term) {
      problems.push(
        `${path}:${index + 1}: the ${kind} "${term}" does not belong in a CORE file; cite a role of the profile`
      )
    }
  }
  return problems
}

/**
 * The problems of the framework's `core/` folder, every file whole (no binding line, no sections); `files` maps a path to its text. With no file
 * at all the scan would prove nothing, so an empty `files` is a problem.
 */
export function frameworkCoreProblems(files, terms, folder) {
  const patterns = leakPatterns(terms)
  const paths = Object.keys(files).sort()

  if (paths.length === 0) {
    return [`${folder}: no file found, so the CORE scan of the framework would prove nothing`]
  }
  return paths.flatMap((path) =>
    files[path].split('\n').flatMap((line, index) => lineProblems(path, line, index, patterns))
  )
}

/**
 * The problems of the project's CORE documents. `files` maps a path to its text; `entries` are the CORE entries (`coreEntries`); a listed path
 * missing from `files` is a problem. The entry file must hold exactly one binding line in its CORE sections.
 */
export function coreLeakProblems(files, terms, entries, { entryFile = DEFAULT_ENTRY_FILE } = {}) {
  const patterns = leakPatterns(terms)
  const problems = []
  let bindings = 0

  for (const { path, sections } of entries) {
    const text = files[path]
    if (text === undefined) {
      problems.push(`${path}: listed as CORE in layers.core of the profile file but not found`)
      continue
    }
    const lines = sections ? inSections(text, sections) : text.split('\n')

    lines.forEach((line, index) => {
      if (path === entryFile && line.startsWith(BINDING_MARKER)) {
        bindings += 1
        return
      }
      problems.push(...lineProblems(path, line, index, patterns))
    })
  }

  if (entries.some(({ path }) => path === entryFile) && bindings !== 1) {
    problems.push(`${entryFile}: expected one "${BINDING_MARKER}" line in the CORE sections, found ${bindings}`)
  }

  return problems
}

/** The framework `core/` folder that the project scans itself, or null when the framework scans it upstream (pinned to a Git source). */
export function frameworkCoreFolder(root) {
  const lock = readLock(root)
  if (lock?.mode === MODES.self) return 'core'
  if (lock?.mode === MODES.detached) return `${VENDOR_DIR}/core`
  if (lock?.source?.type === 'path') return `${lock.source.location}/core`
  return null
}

/**
 * `harness check core` on a project.
 * @returns {{ problems: string[], message: string }}
 */
export function checkCore({ root, profile }) {
  if (!profile.terms) {
    return { problems: [], message: 'The profile file has no `terms`, so there is nothing to scan the CORE files for.' }
  }
  const entries = coreEntries(profile.layers?.core)
  const files = {}
  for (const { path } of entries) {
    if (existsSync(join(root, path))) {
      files[path] = readFileSync(join(root, path), 'utf8')
    }
  }
  const problems = coreLeakProblems(files, profile.terms, entries, { entryFile: profile.paths?.entryFile })

  const folder = frameworkCoreFolder(root)
  const frameworkFiles = {}
  if (folder) {
    for (const path of walk(join(root, folder))) {
      frameworkFiles[`${folder}/${path}`] = readFileSync(join(root, folder, path), 'utf8')
    }
    problems.push(...frameworkCoreProblems(frameworkFiles, profile.terms, folder))
  }

  const scope = folder ? ` and ${Object.keys(frameworkFiles).length} files of ${folder}` : ''
  return {
    problems,
    message: `Checked ${Object.keys(files).length} CORE files${scope} for stack terms, product terms and project values.`
  }
}
