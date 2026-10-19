// Rules of the design's open-items register (design §20): no build-status markers in the design, every marker word names a
// registered open item or a backlog entry, and every cited id exists in the register.
const BUILD_MARKERS = /[✅🟡🔴]/u
const MARKER_WORDS = [
  'TODO',
  'TBD',
  'to be decided',
  'to be revisited',
  'to be validated',
  'not yet',
  'not done yet',
  'for now',
  'still to come',
  'not in the plan',
  'known gap',
  'left to the'
]
const MARKER_PATTERN = new RegExp(`\\b(?:${MARKER_WORDS.join('|')})\\b`, 'i')
const BACKLOG_REFERENCE = /§21\b|21-backlog\.md/
const QUESTION_ID = /\bQ\d+\b/g
const REGISTER_FILE = '20-open-questions.md'
const BACKLOG_FILE = '21-backlog.md'
const REGISTER_COLUMNS = 6

const withoutCode = (text) => text.replace(/^```[\s\S]*?^```/gm, (block) => block.replace(/[^\n]/g, ''))

export function registerRows(text) {
  return withoutCode(text)
    .split('\n')
    .filter((line) => /^\| Q\d+ \|/.test(line))
    .map((line) =>
      line
        .split(/(?<!\\)\|/)
        .slice(1, -1)
        .map((cell) => cell.trim())
    )
}

// `files` maps a file name inside the design folder to its text.
export function openItemProblems(files) {
  const problems = []
  const register = files[REGISTER_FILE]
  const rows = register === undefined ? [] : registerRows(register)
  const ids = new Set(rows.map(([id]) => id))

  if (register === undefined) {
    problems.push(`${REGISTER_FILE}: the open-items register is missing`)
  }

  const seen = new Set()
  for (const row of rows) {
    if (seen.has(row[0])) {
      problems.push(`${REGISTER_FILE}: id ${row[0]} is registered twice`)
    }
    seen.add(row[0])
    if (row.length !== REGISTER_COLUMNS || row.some((cell) => !cell)) {
      problems.push(
        `${REGISTER_FILE}: ${row[0]} must fill all ${REGISTER_COLUMNS} columns (id, question, kind, section, blocks, owner)`
      )
    }
  }

  for (const [name, text] of Object.entries(files)) {
    const lines = withoutCode(text).split('\n')
    lines.forEach((line, index) => {
      const where = `${name}:${index + 1}`
      if (BUILD_MARKERS.test(line)) {
        problems.push(`${where}: a build-status marker; the design shows decisions only, the plan tracks what is built`)
      }
      if (name === REGISTER_FILE || name === BACKLOG_FILE) {
        return
      }
      const cited = line.match(QUESTION_ID) ?? []
      for (const id of cited) {
        if (!ids.has(id)) {
          problems.push(`${where}: ${id} is not registered in ${REGISTER_FILE}`)
        }
      }
      if (MARKER_PATTERN.test(line) && cited.length === 0 && !BACKLOG_REFERENCE.test(line)) {
        problems.push(
          `${where}: a marker word without an open-item id (Qn) or a backlog entry (§21): "${line.trim().slice(0, 80)}"`
        )
      }
    })
  }

  return problems
}
