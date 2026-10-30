// Keeps the CORE files of the harness (the method, the plan method, the review methods and the rules of AGENTS.md sections 1 and 7) free of
// stack terms, product terms and project values. The CORE files come from the layer map of the harness bindings; the term lists are the
// `terms` of the profile file. The one line of AGENTS.md that binds the roles to this repository's values is the only place a project value may stay.
export const BINDING_MARKER = '**Role binding.**'
const ENTRY_FILE = 'AGENTS.md'

// The product terms of the profile without its generic words (productGeneric), which are judged in context and not scanned
function productPattern(terms) {
  const generic = new Set(terms.productGeneric.split('|'))
  return terms.product
    .split('|')
    .filter((alternative) => !generic.has(alternative))
    .join('|')
}

// The `core-files` block of the bindings: one path per line, optionally followed by `sections` and the numbers of the sections to read
export function coreFiles(bindingsText) {
  const block = bindingsText.match(/^```core-files\n([\s\S]*?)^```/m)
  if (!block) {
    throw new Error('The bindings have no core-files block in the layer map')
  }
  return block[1]
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [path, keyword, ...numbers] = line.trim().split(/\s+/)
      return { path, sections: keyword === 'sections' ? numbers : null }
    })
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

// The problems of one line: every kind of term it holds
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

// The whole text of every file of the framework's `core/` folder is CORE (no binding line, no sections); `files` maps a path to its text.
// With no file at all the scan would prove nothing, so an empty `files` is a problem.
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

// `files` maps a path of the repository to its text; a path of the core-files block that is missing from it is a problem
export function coreLeakProblems(files, terms, bindingsText) {
  const patterns = leakPatterns(terms)
  const problems = []
  let bindings = 0

  for (const { path, sections } of coreFiles(bindingsText)) {
    const text = files[path]
    if (text === undefined) {
      problems.push(`${path}: listed as CORE in the harness bindings but not found`)
      continue
    }
    const lines = sections ? inSections(text, sections) : text.split('\n')

    lines.forEach((line, index) => {
      if (path === ENTRY_FILE && line.startsWith(BINDING_MARKER)) {
        bindings += 1
        return
      }
      problems.push(...lineProblems(path, line, index, patterns))
    })
  }

  if (bindings !== 1) {
    problems.push(`${ENTRY_FILE}: expected one "${BINDING_MARKER}" line in the CORE sections, found ${bindings}`)
  }

  return problems
}
