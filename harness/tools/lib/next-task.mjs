// The next task of a development plan, by the order the plan says (method, session protocol; the procedure `start-task`): the order of development of
// the plan index when it has one, in which a phase's tasks come in the order of the phase's own `Execution order` line, or of its task table when it
// has none; otherwise, phase by phase in number order, each in its execution order or its table's. The task table's order is the last resort, since
// the numbers of tasks are identities and not an order (the plan method). Pure functions on the texts of the files, so a test passes them as strings.

const TASK_ID = /\b\d+\.\d+[a-z]?\b/g
// A version (`0.1.2`, `1.0.0-dev.1`) holds what looks like a task id, so it is taken out first
const VERSION = /`?\b\d+\.\d+\.\d+(?:-[\w.]+)?\b`?/g
const ROW = /^\|\s*(\d+\.\d+[a-z]?)\s*\|(.*)\|\s*(⬜|🟡|✅)[^|]*\|\s*$/
const STATUS_SECTION = /\*\*Status:\*\*\s*(⬜|🟡|✅)/

const idsIn = (text) => [...text.replace(VERSION, ' ').matchAll(TASK_ID)].map((match) => match[0])
const markdownText = (text) => text.replace(/\*\*|`|\[([^\]]*)\]\([^)]*\)/g, '$1')
// The title of a task: its bold lead, else the start of its cell
const shorten = (title) => (title.length > 100 ? `${title.slice(0, 97)}…` : title)
const titleOf = (cell) => {
  const text = cell.split('|')[0].trim()
  return shorten(markdownText(text.match(/\*\*(.+?)\*\*/)?.[1] ?? text).trim())
}

/**
 * The phases of the plan from their files: `{ number, file, status, order, tasks: [{ id, title, status }] }`; `order` is the `Execution order` line of
 * the file (`null` when it has none), and `points` says that the line sends the reader to the plan index.
 * @param {{ file: string, text: string, tasks?: { id: string, title: string, status: string }[] }[]} files
 */
export function readPhases(files) {
  return files
    .map(({ file, text, tasks: given }) => {
      const order = text.match(/^\*\*Execution order:\*\*\s*(.*)$/m)?.[1] ?? null
      // A phase kept as a folder brings its tasks from the task files; a phase file has them as the rows of its table
      const tasks =
        given?.map((task) => ({ id: task.id, title: shorten(task.title ?? ''), status: task.status ?? '⬜' })) ??
        text.split('\n').flatMap((line) => {
          const row = line.match(ROW)
          return row ? [{ id: row[1], title: titleOf(row[2]), status: row[3] }] : []
        })
      return {
        number: Number(
          text.match(/^# Phase (\d+)\b/m)?.[1] ?? file.match(/phase-(\d+)/)?.[1] ?? Number.MAX_SAFE_INTEGER
        ),
        file,
        status: text.match(STATUS_SECTION)?.[1] ?? '⬜',
        order,
        points: order !== null && /plan index|order of development/i.test(order),
        tasks
      }
    })
    .sort((a, b) => a.number - b.number)
}

/**
 * The tasks of a phase in its own order: the ids its `Execution order` line lists (then any task it left out, in table order); the table's order when
 * the line is missing, names no task, or sends the reader to the plan index (whose order the caller applies).
 */
export function phaseSequence(phase) {
  const listed = phase.order !== null && !phase.points ? idsIn(phase.order) : []
  const known = new Set(phase.tasks.map((task) => task.id))
  const ordered = [...new Set(listed)].filter((id) => known.has(id))
  return [...ordered, ...phase.tasks.map((task) => task.id).filter((id) => !ordered.includes(id))]
}

/**
 * The tokens of the plan index's "Order of development" section, in order: a task id, or `{ phase }` for "Phase N"; empty when the index has no such
 * section. A table counts its second column (the tasks) only, since the first holds versions.
 */
export function orderOfDevelopment(indexText) {
  const start = indexText.search(/\*\*Order of development\*\*|^#+\s*Order of development/im)
  if (start < 0) {
    return []
  }
  const rest = indexText.slice(start).split('\n').slice(1)
  const end = rest.findIndex((line) => /^(---|#{1,6} )/.test(line))
  const lines = (end < 0 ? rest : rest.slice(0, end)).filter((line) => line.trim())
  const cells = lines.flatMap((line) =>
    line.startsWith('|') ? (/^\|\s*[-: |]+\|?\s*$/.test(line) ? [] : [line.split('|').slice(1, -1)[1] ?? '']) : [line]
  )
  return cells.flatMap((cell) =>
    [...cell.replace(VERSION, ' ').matchAll(/\b(?:Phase (\d+)|(\d+\.\d+[a-z]?)|([IB]-\d+))\b/g)].map((match) =>
      match[1] ? { phase: Number(match[1]) } : (match[2] ?? match[3])
    )
  )
}

/**
 * The next task: the first one not started (⬜) in the order of the plan.
 * @param {{ phases: ReturnType<typeof readPhases>, indexText?: string }} plan
 * @returns {{ id: string, title: string, file: string, source: 'order of development' | 'execution order' | 'table' } | null}
 */
export function nextTask({ phases, indexText = '' }) {
  const own = (phase) => phaseSequence(phase).map((id) => ({ id, phase }))
  const index = orderOfDevelopment(indexText)
  const byId = new Map(phases.flatMap((phase) => phase.tasks.map((task) => [task.id, { phase, task }])))

  const sequence = []
  let source = 'table'
  if (index.length) {
    source = 'order of development'
    for (const token of index) {
      if (typeof token === 'string') {
        const found = byId.get(token)
        if (found) {
          sequence.push({ id: token, phase: found.phase })
        }
      } else {
        sequence.push(...own(phases.find((phase) => phase.number === token.phase) ?? { tasks: [], order: null }))
      }
    }
  }
  // Whatever the order does not name follows, phase by phase
  sequence.push(...phases.flatMap(own))
  if (!index.length) {
    source = phases.some((phase) => phase.order !== null && !phase.points && idsIn(phase.order).length)
      ? 'execution order'
      : 'table'
  }
  for (const { id } of sequence) {
    const { phase, task } = byId.get(id) ?? {}
    if (task?.status === '⬜') {
      return { id, title: task.title, file: phase.file, source }
    }
  }
  return null
}
