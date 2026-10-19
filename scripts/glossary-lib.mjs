// Rules of the glossary (design §2): one row per concept with its code name and aliases, a name that means one thing, and every
// term the design emphasises in two or more files defined in it.
const GLOSSARY_FILE = '02-glossary.md'
const SKIPPED_FILES = new Set([GLOSSARY_FILE, '20-open-questions.md', '21-backlog.md'])
const GLOSSARY_COLUMNS = 4
const EMPTY = '–'
// Words that are emphasised for stress, not defined
const STRESS_WORDS = new Set([
  'and',
  'or',
  'not',
  'no',
  'only',
  'real',
  'type',
  'all',
  'any',
  'never',
  'always',
  'each',
  'every'
])

const withoutCode = (text) => text.replace(/^```[\s\S]*?^```/gm, '')
const normalise = (name) => name.trim().toLowerCase().replace(/`/g, '')
// "chunks" and "chunk" are one name
const singular = (name) => name.replace(/s$/, '')

// The rows of the glossary table: term, code name, aliases, definition
export function glossaryRows(text) {
  return withoutCode(text)
    .split('\n')
    .filter((line) => /^\| \*\*/.test(line))
    .map((line) =>
      line
        .split(/(?<!\\)\|/)
        .slice(1, -1)
        .map((cell, index) => (index === 0 ? cell.trim().replace(/\*/g, '') : cell.trim()))
    )
}

// The names of a row: its term and its aliases, as plain lower-case words
function namesOf([term, , aliases]) {
  const own = [term]
  const others = aliases && aliases !== EMPTY ? aliases.split(',') : []
  return [...own, ...others].map(normalise).filter(Boolean)
}

// The bold phrases of a design file that read as a term: two or three words, no punctuation
function emphasisedTerms(text) {
  return [...withoutCode(text).matchAll(/\*\*([A-Za-z][A-Za-z -]{2,30})\*\*/g)].map((match) => normalise(match[1]))
}

// `files` maps a file name inside the design folder to its text
export function glossaryProblems(files) {
  const problems = []
  const glossary = files[GLOSSARY_FILE]
  if (glossary === undefined) {
    return [`${GLOSSARY_FILE}: the glossary is missing`]
  }

  const rows = glossaryRows(glossary)
  const owner = new Map()

  for (const row of rows) {
    if (row.length !== GLOSSARY_COLUMNS || row.some((cell) => !cell)) {
      problems.push(
        `${GLOSSARY_FILE}: "${row[0]}" must fill the four columns (term, code name, aliases, definition); use ${EMPTY} for none`
      )
      continue
    }
    for (const name of namesOf(row)) {
      const key = singular(name)
      const previous = owner.get(key)
      if (previous && previous !== row[0]) {
        problems.push(`${GLOSSARY_FILE}: the name "${name}" belongs to both ${previous} and ${row[0]}`)
      }
      owner.set(key, row[0])
    }
  }

  const filesOf = new Map()
  for (const [name, text] of Object.entries(files)) {
    if (SKIPPED_FILES.has(name)) {
      continue
    }
    for (const term of new Set(emphasisedTerms(text).filter((phrase) => !STRESS_WORDS.has(phrase)))) {
      filesOf.set(term, (filesOf.get(term) ?? new Set()).add(name))
    }
  }
  for (const [term, where] of filesOf) {
    if (where.size >= 2 && !owner.has(singular(term))) {
      problems.push(`${GLOSSARY_FILE}: "${term}" is emphasised in ${[...where].join(', ')} but is not defined`)
    }
  }

  return problems
}
