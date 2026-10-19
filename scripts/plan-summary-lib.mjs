// The summary table and the contents list of docs/development-plan/DEVELOPMENT-PLAN.md, written from the phase files, so that a size or a
// status is kept in one place (the phase file) and the index cannot disagree with it.
export const SUMMARY_START = '<!-- plan-summary:start -->'
export const SUMMARY_END = '<!-- plan-summary:end -->'
export const CONTENTS_START = '<!-- plan-contents:start -->'
export const CONTENTS_END = '<!-- plan-contents:end -->'

const TITLE = /^# Phase (\d+) — (.+?) \((\d+) SP(?:, ([^)]*))?\)\s*$/m
const STATUS = /\*\*Status:\*\*\s*((?:⬜|🟡|✅)\s*[A-Za-z ]+?)\s*(?:·|$)/m
const TASK_ROW = /^\| (\d+\.\d+[a-z]?) \|.*\| (\d+) \| (?:⬜|🟡|✅)[^|]*\|\s*$/gm

// { number, theme, points, note, status, file, title, taskPoints } of a phase file, or throws with the file name
export function parsePhase(file, text) {
  const title = TITLE.exec(text)
  const status = STATUS.exec(text)
  if (!title) {
    throw new Error(`${file}: the title must read "# Phase <n> — <theme> (<size> SP)"`)
  }
  if (!status) {
    throw new Error(`${file}: the status line must start with "**Status:** ⬜|🟡|✅ <words>"`)
  }
  const taskPoints = [...text.matchAll(TASK_ROW)].reduce((sum, match) => sum + Number(match[2]), 0)

  return {
    number: Number(title[1]),
    theme: title[2],
    points: Number(title[3]),
    note: title[4] ?? '',
    status: status[1].replace(/\s+/g, ' '),
    file,
    title: `Phase ${title[1]} — ${title[2]} (${title[3]} SP${title[4] ? `, ${title[4]}` : ''})`,
    taskPoints
  }
}

// Problems of one phase: the size in the title is the sum of the sizes of its tasks
export function phaseProblems(phase) {
  return phase.taskPoints === phase.points
    ? []
    : [`${phase.file}: the title says ${phase.points} SP but the tasks add up to ${phase.taskPoints} SP`]
}

export function summaryTable(phases) {
  const sorted = [...phases].sort((a, b) => a.number - b.number)
  const total = sorted.reduce((sum, phase) => sum + phase.points, 0)
  const grows = sorted.filter((phase) => phase.note.includes('grows')).map((phase) => `Phase ${phase.number}`)
  const last = sorted.at(-1)?.number ?? 0
  const lines = ['| Phase | Theme | Story points | Status |', '| ----- | ----- | ------------ | ------ |']

  for (const phase of sorted) {
    lines.push(
      `| ${phase.number} | ${phase.theme} | ${phase.points}${phase.note.includes('grows') ? ' (grows)' : ''} | ${phase.status} |`
    )
  }
  lines.push(
    `|  | **Total of Phases 0–${last}** | **${total}**${grows.length ? ` (${grows.join(', ')} grows as issues are added)` : ''} | |`
  )

  return lines.join('\n')
}

export function contentsList(phases) {
  return [...phases]
    .sort((a, b) => a.number - b.number)
    .map((phase) => `- [${phase.title}](./phases/${phase.file})`)
    .join('\n')
}

function replaceBetween(text, start, end, body) {
  const from = text.indexOf(start)
  const to = text.indexOf(end)
  if (from < 0 || to < from) {
    throw new Error(`The plan index has no ${start} … ${end} block`)
  }
  return `${text.slice(0, from + start.length)}\n${body}\n${text.slice(to)}`
}

// The index text with both generated blocks rewritten
export function renderIndex(indexText, phases) {
  const withSummary = replaceBetween(indexText, SUMMARY_START, SUMMARY_END, summaryTable(phases))
  return replaceBetween(withSummary, CONTENTS_START, CONTENTS_END, contentsList(phases))
}
