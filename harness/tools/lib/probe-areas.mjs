// The areas of the cold-start probes (task 3.15). A version of the framework can pass every check and still make agents read more, or leave a project document
// that restates a rule the version changed, and only the probes of a project measure that. Each probe in the project's harness-review bindings names the areas it
// exercises, from the list of areas of the migration notes; taking a version reruns the probes whose areas meet the areas that the notes of the versions taken
// list, and an area no probe covers is run from the framework's starting probe for it (`core/reviews/harness/starting-probes.md`).
import { existsSync, readFileSync } from 'node:fs'
import { inFramework } from './lock.mjs'
import { AREAS_BEGIN, AREAS_END, selectNotes } from './migration-notes.mjs'
import { listMigrations } from './migrate.mjs'

const cells = (line) =>
  line
    .replace(/^\|\s*/, '')
    .replace(/\s*\|\s*$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim())

/** The probes of a bindings text: the rows of a table whose first cell is `P<n>`, as `{ id, scenario, areas, words }`. */
export function parseProbes(text) {
  return text
    .split('\n')
    .filter((line) => /^\|\s*P\d+\s*\|/.test(line))
    .map((line) => {
      const [id, scenario, areas = '', words = ''] = cells(line)
      return {
        id,
        scenario,
        areas: areas
          .split(',')
          .map((area) => area.trim())
          .filter(Boolean),
        words
      }
    })
}

export const PROBE_COLUMNS = 'Probe | Scenario | Areas | Words read at the last review'

/**
 * The problem of the probe table's columns, or null: the table that holds the probe rows must name its third column "Areas" (the cell the areas are read from).
 * A table of the older shape (`Id | Scenario | Expected`) is reported once, instead of its every probe as naming an area that does not exist.
 */
export function probeTableProblem(text, file) {
  const lines = text.split('\n')
  const first = lines.findIndex((line) => /^\|\s*P\d+\s*\|/.test(line))
  if (first < 0) {
    return null
  }
  let at = first - 1
  while (at >= 0 && /^\|[\s:|-]*$/.test(lines[at])) {
    at -= 1
  }
  const header = at >= 0 && lines[at].startsWith('|') ? cells(lines[at]) : []
  return /^areas$/i.test(header[2] ?? '')
    ? null
    : `${file}: the table of the probes has the columns "${header.join(' | ') || 'none'}"; it must have "${PROBE_COLUMNS}" (the third cell of a probe names its areas of the migration notes, separated by commas; move other columns out of the table)`
}

/** The problems of the probes against the areas of the migration notes: each names at least one area, and only areas that exist. */
export function probeProblems(probes, known, file) {
  return probes.flatMap((probe) => {
    const problems = []
    if (!probe.areas.length) {
      problems.push(`${file}: the probe ${probe.id} names no area (${known.join(', ')})`)
    }
    for (const area of probe.areas.filter((name) => !known.includes(name))) {
      problems.push(
        `${file}: the probe ${probe.id} names the area "${area}", which is not an area of the migration notes (${known.join(', ')})`
      )
    }
    return problems
  })
}

/** The areas listed in a migration note, between its two markers. */
export function areasOfNote(text) {
  const from = text.indexOf(AREAS_BEGIN)
  const to = text.indexOf(AREAS_END)
  if (from < 0 || to < from) return []
  return text
    .slice(from + AREAS_BEGIN.length, to)
    .split('\n')
    .map((line) => /^- (.+)$/.exec(line.trim())?.[1])
    .filter(Boolean)
}

/** The starting probes of the framework by area: the rows of its table, as a map from the area to the scenario. */
export function startingProbes(text) {
  return new Map(
    text
      .split('\n')
      .filter((line) => line.startsWith('|'))
      .map(cells)
      .filter((row) => row.length >= 2 && !/^-+$/.test(row[0]) && row[0] !== 'Area')
      .map(([area, scenario]) => [area, scenario])
  )
}

/**
 * What taking versions asks of the probes: the probes to run again (those that name an area the versions touched), and the areas no probe covers.
 * @returns {{ rerun: { probe: object, areas: string[] }[], uncovered: string[] }}
 */
export function probePlan({ probes, touched }) {
  const rerun = probes
    .map((probe) => ({ probe, areas: probe.areas.filter((area) => touched.includes(area)) }))
    .filter(({ areas }) => areas.length)
  const covered = new Set(probes.flatMap((probe) => probe.areas))
  return { rerun, uncovered: touched.filter((area) => !covered.has(area)) }
}

/** The areas the notes of the versions after `from`, up to `to`, list, in the order of the areas of the first note that names them. */
export function touchedAreas({ folder, from, to }) {
  const areas = []
  for (const { note } of selectNotes(listMigrations(folder), from, to)) {
    for (const area of areasOfNote(readFileSync(note, 'utf8'))) if (!areas.includes(area)) areas.push(area)
  }
  return areas
}

const bindingsOf = (profile) => profile.documents?.harnessBindings ?? profile.paths?.harnessBindings

/** `harness check probes`: the probes of the project's bindings name areas that exist. A project with no bindings or no probe table has nothing to check. */
export function checkProbes({ root, profile }) {
  const file = bindingsOf(profile)
  if (!file || !existsSync(`${root}/${file}`)) {
    return { problems: [], message: 'The project has no harness-review bindings, so there are no probes to check.' }
  }
  const text = readFileSync(`${root}/${file}`, 'utf8')
  const shape = probeTableProblem(text, file)
  if (shape) {
    return { problems: [shape], message: 'The probe table has other columns than the probes need.' }
  }
  const probes = parseProbes(text)
  const areasFile = `${root}/${inFramework(profile, 'migrations')}/areas.json`
  if (!probes.length || !existsSync(areasFile)) {
    return { problems: [], message: 'The bindings hold no probe table, so there are no probe areas to check.' }
  }
  const known = Object.keys(JSON.parse(readFileSync(areasFile, 'utf8')).areas)
  return {
    problems: probeProblems(probes, known, file),
    message: `Checked that the ${probes.length} probes name areas of the migration notes.`
  }
}

/**
 * `harness probes <from> <to>`: the probes to run again for the versions after `from` up to `to`, and the starting probe for each area no probe covers.
 * @returns {string[]} the lines to print
 */
export function probesReport({ root, profile, from, to }) {
  const touched = touchedAreas({ folder: `${root}/${inFramework(profile, 'migrations')}`, from, to })
  if (!touched.length) {
    return [`The notes of the versions after ${from} up to ${to} list no area, so no probe needs to run again.`]
  }
  const file = bindingsOf(profile)
  const probes = file && existsSync(`${root}/${file}`) ? parseProbes(readFileSync(`${root}/${file}`, 'utf8')) : []
  const { rerun, uncovered } = probePlan({ probes, touched })
  const starting = startingProbes(
    readFileSync(`${root}/${inFramework(profile, 'core/reviews/harness/starting-probes.md')}`, 'utf8')
  )
  return [
    `Areas touched by the versions after ${from} up to ${to}: ${touched.join(', ')}.`,
    ...(rerun.length
      ? [
          'Run again, and compare the words read with the last review:',
          ...rerun.map(
            ({ probe, areas }) =>
              `  ${probe.id} (${areas.join(', ')}): ${probe.scenario}; last review: ${probe.words || '—'}`
          )
        ]
      : ['No probe of the project exercises these areas.']),
    ...(uncovered.length
      ? [
          'No probe covers these areas; run the starting probe of the framework for each and record it in the bindings:',
          ...uncovered.map((area) => `  ${area}: ${starting.get(area) ?? 'no starting probe is written for this area'}`)
        ]
      : [])
  ]
}
