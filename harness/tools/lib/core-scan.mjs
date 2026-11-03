// `harness check core`: the CORE files hold no stack term, product term or project value (the term lists are `terms` of the profile file). Two
// kinds of CORE are scanned: the project's own CORE documents (the `layers.core` entries, some only in numbered sections, where the entry file's
// one "Role binding" line may name the project's values; a project that uses the framework has none, since its entry file's rules are managed
// blocks rendered from `core/rules/`); and the framework's `core/` folder where the project owns it, whole: the staging folder of a framework
// built inside the project, the vendored copy of a detached project, or the framework's own repository (mode "self"); and the vendored copy of a
// pinned project, which the project scans with its own terms (`VENDORED`): the framework cannot know a project's product words, so only the project
// can. The words the framework's core uses on purpose (`core/vocabulary.json`) are never reported, whatever the terms say.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { DEFAULT_ENTRY_FILE } from './entry.mjs'
import { adapterTerms } from './adapters.mjs'
import { coreEntries } from './layers.mjs'
import { MODES, readLock, VENDOR_DIR } from './lock.mjs'
import { walk } from './tree.mjs'

export const BINDING_MARKER = '**Role binding.**'
export const VOCABULARY_FILE = 'vocabulary.json'

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

// `adapters` are the term patterns of the framework's adapters (`adapterTerms`): words of a stack, a runtime or a host, which core must not use either.
// A pattern of the profile file's `terms` has a `field` (the term list a project edits to change what it reports); the adapters' words are the framework's own.
function leakPatterns(terms, adapters = []) {
  return [
    ['stack term', new RegExp(terms.stack, 'gi'), 'stack'],
    ['product term', new RegExp(productPattern(terms), 'gi'), 'productGeneric'],
    ['project value', new RegExp(terms.projectValues, 'gi'), 'projectValues'],
    ...adapters.map(({ source, pattern }) => [`${source} term`, new RegExp(pattern, 'gi'), null])
  ]
}

// A word of the vocabulary, or its plural, is not reported (a term pattern such as `\\bscripts?\\b` matches both)
const inVocabulary = (vocabulary, term) => {
  const word = term.toLowerCase()
  return vocabulary.has(word) || vocabulary.has(word.replace(/e?s$/, ''))
}

// What a project can do about a hit in the vendored copy of the framework's core, which it cannot edit
function wayOut(field) {
  const upstream =
    'report it upstream (an issue of the framework repository), record it in `terms.exceptions` of the profile file for this version, and take the fix with the next one'
  if (!field) {
    return upstream
  }
  const ordinary =
    field === 'productGeneric'
      ? 'an ordinary word: add it to `terms.productGeneric` of the profile file'
      : `an ordinary word: make \`terms.${field}\` of the profile file narrower`
  return `${ordinary}; a product or tool word: ${upstream}`
}

// The hits of one line: `{ path, line, kind, term, field }`; a word of the vocabulary is not one
function lineHits(path, text, index, patterns, vocabulary) {
  return patterns.flatMap(([kind, pattern, field]) => {
    const term = [...text.matchAll(pattern)]
      .map((match) => match[0])
      .find((found) => !field || !inVocabulary(vocabulary, found))
    return term ? [{ path, line: index + 1, kind, term, field }] : []
  })
}

function describe({ path, line, kind, term, field }, vendored) {
  const what = vendored
    ? `is in the vendored framework core, which you cannot edit; ${wayOut(field)}`
    : 'does not belong in a CORE file; cite a role of the profile'
  return `${path}:${line}: the ${kind} "${term}" ${what}`
}

const lineProblems = (path, text, index, patterns, { vocabulary = new Set(), vendored = false } = {}) =>
  lineHits(path, text, index, patterns, vocabulary).map((hit) => describe(hit, vendored))

// The exceptions of the profile file that no longer hold: for another version than the lock's, or for a hit that is gone
function staleExceptions(exceptions, hits, version) {
  return exceptions.flatMap((exception, index) => {
    const where = `terms.exceptions[${index}] of the profile file: the exception for "${exception.word}" in ${exception.file} (${exception.report})`
    if (exception.version !== version) {
      return [
        `${where} holds for version ${exception.version}, and the lock is at ${version}: remove it; if the scan still reports the word, report it upstream again or go back to ${exception.version}`
      ]
    }
    const used = hits.some((hit) => accepts(exception, hit))
    return used ? [] : [`${where} matches no hit in version ${version}: remove it`]
  })
}

const accepts = (exception, hit) =>
  exception.file === hit.path && exception.word.toLowerCase() === hit.term.toLowerCase()

/**
 * The problems of the framework's `core/` folder, every file whole (no binding line, no sections); `files` maps a path to its text. With no file
 * at all the scan would prove nothing, so an empty `files` is a problem. `vendored` says that the folder is the pinned copy a project cannot edit, so a
 * hit names the ways out; `vocabulary` is the set of the words the core uses on purpose (`loadVocabulary`). `exceptions` are the recorded hits of the
 * profile file (`terms.exceptions`: file, word, report, version), accepted in a vendored folder while `version` (the lock's) is the one they hold for;
 * one that holds for another version, or for a hit that is gone, is a problem itself, so that an exception cannot outlive the fix.
 */
export function frameworkCoreProblems(
  files,
  terms,
  folder,
  adapters = [],
  { vocabulary = new Set(), vendored = false, exceptions = [], version } = {}
) {
  const patterns = leakPatterns(terms, adapters)
  const paths = Object.keys(files).sort()

  if (paths.length === 0) {
    return [`${folder}: no file found, so the CORE scan of the framework would prove nothing`]
  }
  const hits = paths.flatMap((path) =>
    files[path].split('\n').flatMap((line, index) => lineHits(path, line, index, patterns, vocabulary))
  )
  const excepted = (hit) =>
    vendored && exceptions.some((exception) => exception.version === version && accepts(exception, hit))
  const rejected = hits.filter((hit) => !excepted(hit))
  return [
    ...rejected.map((hit) => describe(hit, vendored)),
    ...(vendored ? staleExceptions(exceptions, hits, version) : [])
  ]
}

/**
 * The problems of the project's CORE documents. `files` maps a path to its text; `entries` are the CORE entries (`coreEntries`); a listed path
 * missing from `files` is a problem. The entry file must hold exactly one binding line in its CORE sections.
 */
export function coreLeakProblems(files, terms, entries, { entryFile = DEFAULT_ENTRY_FILE, vocabulary } = {}) {
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
      problems.push(...lineProblems(path, line, index, patterns, { vocabulary }))
    })
  }

  if (entries.some(({ path }) => path === entryFile) && bindings !== 1) {
    problems.push(`${entryFile}: expected one "${BINDING_MARKER}" line in the CORE sections, found ${bindings}`)
  }

  return problems
}

/**
 * The framework `core/` folder that the project scans itself, and whether it is the pinned copy (`vendored`: the project cannot edit it, so a hit
 * is reported with the ways out). Null when the framework scans it upstream: a pinned source folder outside the project, which is scanned where it lives.
 */
export function frameworkCoreScan(root) {
  const lock = readLock(root)
  if (lock?.mode === MODES.self) return { folder: 'core', vendored: false }
  if (lock?.mode === MODES.detached) return { folder: `${VENDOR_DIR}/core`, vendored: false }
  // A folder source inside the project is the staging folder of a framework built there; a folder elsewhere is scanned where it lives
  if (lock?.source?.type === 'path') {
    return isAbsolute(lock.source.location) ? null : { folder: `${lock.source.location}/core`, vendored: false }
  }
  // Pinned to a Git source: the framework scanned its core with its own words, the project scans the copy with its own
  return lock?.mode === MODES.pinned ? { folder: `${VENDOR_DIR}/core`, vendored: true } : null
}

export const frameworkCoreFolder = (root) => frameworkCoreScan(root)?.folder ?? null

/** The words the framework's core uses on purpose (`vocabulary.json` of its `core/` folder), lower case; empty for a version that has none. */
export function loadVocabulary(coreDir) {
  const path = join(coreDir, VOCABULARY_FILE)
  return new Set(existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).words.map((word) => word.toLowerCase()) : [])
}

/**
 * `harness check core` on a project.
 * @returns {{ problems: string[], message: string }}
 */
export function checkCore({ root, profile }) {
  if (!profile.terms) {
    return { problems: [], message: 'The profile file has no `terms`, so there is nothing to scan the CORE files for.' }
  }
  const scan = frameworkCoreScan(root)
  const vocabulary = scan ? loadVocabulary(join(root, scan.folder)) : new Set()
  const entries = coreEntries(profile.layers?.core)
  const files = {}
  for (const { path } of entries) {
    if (existsSync(join(root, path))) {
      files[path] = readFileSync(join(root, path), 'utf8')
    }
  }
  const problems = coreLeakProblems(files, profile.terms, entries, {
    entryFile: profile.paths?.entryFile,
    vocabulary
  })

  const frameworkFiles = {}
  if (scan) {
    const { folder, vendored } = scan
    for (const path of walk(join(root, folder))) {
      frameworkFiles[`${folder}/${path}`] = readFileSync(join(root, folder, path), 'utf8')
    }
    problems.push(
      ...frameworkCoreProblems(
        frameworkFiles,
        profile.terms,
        folder,
        adapterTerms(join(root, dirname(folder), 'adapters')),
        { vocabulary, vendored, exceptions: profile.terms.exceptions, version: readLock(root)?.version }
      )
    )
  }

  const scope = scan ? ` and ${Object.keys(frameworkFiles).length} files of ${scan.folder}` : ''
  return {
    problems,
    message: `Checked ${Object.keys(files).length} CORE files${scope} for stack terms, product terms and project values.`
  }
}
