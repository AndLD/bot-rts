// `harness flow audit <n>` (task 6.1): where the tokens of a flow went. The sessions of the flow (its workers, named by the "step started" entries of its log, and
// its orchestrator, named by the caller) are read by the runtime adapter's role `transcripts` into neutral records, and counted here by tool, by command, by step
// and by session. Two numbers are kept apart: what ENTERED the context (tool results, and the agent's own output) and the PEAK context of a session, since
// everything in a context is read again on each later turn. A tool result has no count of its own, so it is characters divided by four; the agent's output is
// the usage the runtime reports when it reports it, else the same estimate; the report says which. Pure functions on the records; the file system is a seam.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readFlowsOf } from './flows.mjs'

/** Characters per token of the estimate. */
export const CHARS_PER_TOKEN = 4
/** The rows of each ranking the report prints, when `--top` is not given. */
export const TOP = 12

/** The estimate of a count of characters, not rounded, so the sums of many results carry no rounding of their own. */
export const tokensOf = (chars) => chars / CHARS_PER_TOKEN

/**
 * The workers a flow's log names: for each `local_…` id of a session of the desktop app, and each name of a worker started on the command line ("`claude -p` named `<name>`"),
 * the first step whose "step <id> started" entry names it as its worker.
 * @returns {Map<string, string>} session id or name → step id
 */
export function workersOfLog(text) {
  const workers = new Map()
  for (const block of text.split(/^### /m).slice(1)) {
    const step = block.match(/^[^\n]*— step (\S+) started/)?.[1]
    if (!step) continue
    for (const match of block.matchAll(/\*\*Worker:\*\*\s*(?:(local_[0-9a-f-]+)|`claude -p` named `([^`]+)`)/g)) {
      const id = match[1] ?? match[2]
      if (!workers.has(id)) workers.set(id, step)
    }
  }
  return workers
}

const isWord = (word) => word !== undefined && /^[A-Za-z][\w.:-]*$/.test(word)

/**
 * The key of a shell command for the ranking by command: its first words, so a commit, a push and a pull request listing are told apart, and a call of the
 * framework's own command line is `harness <command> <subcommand>`. A leading `cd <dir> &&` is dropped.
 */
export function commandKey(command) {
  const first = command
    .replace(/^\s*cd\s+\S+\s*(&&|;)\s*/, '')
    .split(/&&|;|\|/)[0]
    .trim()
  const words = first.split(/\s+/).filter(Boolean)
  if (!words.length) return '(empty)'
  const harness = words.findIndex((word) => /harness\.mjs$/.test(word))
  if (harness >= 0 && harness <= 1) return ['harness', words[harness + 1], words[harness + 2]].filter(isWord).join(' ')
  return [words[0].replace(/^.*\//, ''), isWord(words[1]) ? words[1] : null].filter(Boolean).join(' ')
}

/** Adds `amount` tokens to the row `key` of a map of `{ calls, tokens }`. */
function add(map, key, tokens) {
  const row = map.get(key) ?? { key, calls: 0, tokens: 0 }
  row.calls += 1
  row.tokens += tokens
  map.set(key, row)
}

const ranked = (map) => [...map.values()].sort((a, b) => b.tokens - a.tokens || a.key.localeCompare(b.key))

/**
 * Counts the sessions.
 * @param {{ flow: number, sessions: { id: string, label: string, role: 'orchestrator' | 'worker', step: string | null, records: { turns: object[], results: object[] } }[], missing?: string[] }} input
 */
export function auditSessions({ flow, sessions, missing = [] }) {
  const byTool = new Map()
  const byCommand = new Map()
  const largest = []
  const rows = sessions.map((session) => {
    const calls = new Map(session.records.turns.flatMap((turn) => turn.calls).map((call) => [call.id, call]))
    let results = 0
    for (const result of session.records.results) {
      const call = calls.get(result.callId)
      const tokens = tokensOf(result.chars)
      results += tokens
      add(byTool, call?.tool ?? '(unknown)', tokens)
      if (call?.tool === 'Bash' && call.command) add(byCommand, commandKey(call.command), tokens)
      largest.push({ tokens, tool: call?.tool ?? '(unknown)', command: call?.command ?? null, session: session.label })
    }
    let output = 0
    let reported = 0
    let peak = null
    let cacheRead = 0
    for (const turn of session.records.turns) {
      if (turn.usage) {
        reported += 1
        output += turn.usage.output
        cacheRead += turn.usage.cacheRead
        peak = Math.max(peak ?? 0, turn.usage.input + turn.usage.cacheRead + turn.usage.cacheCreate)
      } else output += tokensOf(turn.outputChars)
    }
    return {
      id: session.id,
      label: session.label,
      role: session.role,
      step: session.step,
      turns: session.records.turns.length,
      results,
      output,
      entered: results + output,
      peak,
      cacheRead,
      outputReported:
        reported === session.records.turns.length && reported > 0 ? 'reported' : reported ? 'mixed' : 'estimated'
    }
  })
  const sum = (field) => rows.reduce((total, row) => total + row[field], 0)
  const steps = new Map()
  for (const row of rows) {
    const key = row.step ?? (row.role === 'orchestrator' ? '(orchestrator)' : '(no step)')
    const step = steps.get(key) ?? { step: key, sessions: 0, results: 0, output: 0, entered: 0, peak: null }
    step.sessions += 1
    for (const field of ['results', 'output', 'entered']) step[field] += row[field]
    if (row.peak !== null) step.peak = Math.max(step.peak ?? 0, row.peak)
    steps.set(key, step)
  }
  const peaks = rows.map((row) => row.peak).filter((peak) => peak !== null)
  return {
    flow,
    sessions: rows,
    missing,
    totals: {
      results: sum('results'),
      output: sum('output'),
      entered: sum('entered'),
      cacheRead: sum('cacheRead'),
      peak: peaks.length ? Math.max(...peaks) : null
    },
    byTool: ranked(byTool),
    byCommand: ranked(byCommand),
    byStep: [...steps.values()],
    largest: largest.sort((a, b) => b.tokens - a.tokens).slice(0, 50)
  }
}

const k = (tokens) =>
  tokens === null
    ? 'n/a'
    : tokens >= 10000
      ? `${Math.round(tokens / 1000)}k`
      : tokens >= 1000
        ? `${(tokens / 1000).toFixed(1)}k`
        : String(Math.round(tokens))
const share = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : '—')
const clip = (text, length) => (text.length > length ? `${text.slice(0, length - 1)}…` : text).replace(/\s+/g, ' ')

/** The printed report: totals, then the rankings by tool, by command, by step and by session, and the largest results. */
export function auditLines(report, { top = TOP, title = '' } = {}) {
  const { totals } = report
  const methods = new Set(report.sessions.map((session) => session.outputReported))
  const lines = [
    `Flow ${report.flow}${title ? ` — ${title}` : ''}: ${report.sessions.length} session(s) read${report.missing.length ? `, ${report.missing.length} named but not found (${report.missing.join(', ')})` : ''}.`,
    `Counts: tool results are characters ÷ ${CHARS_PER_TOKEN} (the runtime reports no count of a result); the agent's own output is ${methods.size === 1 && methods.has('reported') ? 'the usage the runtime reports' : methods.size === 1 && methods.has('estimated') ? `characters ÷ ${CHARS_PER_TOKEN} (no usage in the transcripts)` : `the usage the runtime reports where there is one, else characters ÷ ${CHARS_PER_TOKEN}`}.`,
    `Entered the context: ${k(totals.entered)} tokens — tool results ${k(totals.results)} (${share(totals.results, totals.entered)}), the agent's output ${k(totals.output)} (${share(totals.output, totals.entered)}).`,
    `Peak context of one session: ${k(totals.peak)}. Read again from the cache over all turns: ${k(totals.cacheRead)}.`,
    '',
    'By tool (tool results):'
  ]
  for (const row of report.byTool.slice(0, top))
    lines.push(
      `  ${k(row.tokens).padStart(7)}  ${share(row.tokens, totals.results).padStart(4)}  ${String(row.calls).padStart(5)} calls  ${row.key}`
    )
  lines.push('', 'By command (shell results):')
  for (const row of report.byCommand.slice(0, top))
    lines.push(
      `  ${k(row.tokens).padStart(7)}  ${share(row.tokens, totals.results).padStart(4)}  ${String(row.calls).padStart(5)} calls  ${row.key}`
    )
  lines.push('', 'By step (entered; peak context):')
  for (const row of report.byStep)
    lines.push(
      `  step ${row.step}: ${k(row.entered)} entered (results ${k(row.results)}, output ${k(row.output)}), peak ${k(row.peak)}, ${row.sessions} session(s)`
    )
  lines.push('', 'By session:')
  for (const row of report.sessions)
    lines.push(
      `  ${row.label} [${row.role}${row.step ? ` of step ${row.step}` : ''}]: ${row.turns} turns, ${k(row.entered)} entered (results ${k(row.results)}, output ${k(row.output)}), peak ${k(row.peak)}`
    )
  lines.push('', `Largest results:`)
  for (const row of report.largest.slice(0, top))
    lines.push(
      `  ${k(row.tokens).padStart(7)}  ${row.tool}${row.command ? `  ${clip(row.command, 90)}` : ''}  (${row.session})`
    )
  return lines
}

/** The problems of what the role `transcripts` returns; the conformance check shares it. */
export function transcriptsProblems(transcripts) {
  if (!transcripts || typeof transcripts !== 'object') return ['transcriptsFor returns no object']
  const problems = []
  if (typeof transcripts.means !== 'string' || !transcripts.means.trim())
    problems.push('transcripts has no `means` text')
  if (typeof transcripts.locate !== 'function') problems.push('transcripts has no `locate()` operation')
  else {
    const located = transcripts.locate({ ids: ['local_none'], roots: { apps: [], projects: [] } })
    if (!Array.isArray(located?.found) || !Array.isArray(located?.missing) || located.missing[0] !== 'local_none')
      problems.push('`locate({ ids })` returns no `{ found, missing }` that lists an id it cannot find as missing')
  }
  if (typeof transcripts.parse !== 'function') problems.push('transcripts has no `parse()` operation')
  else {
    const parsed = transcripts.parse('')
    if (!Array.isArray(parsed?.turns) || !Array.isArray(parsed?.results))
      problems.push('`parse(text)` returns no `{ turns, results }` (an empty transcript gives empty lists)')
  }
  return problems
}

const fail = (message) => ({ lines: [message], code: 1 })

/** The first runtime adapter of the profile that fills the role `transcripts`. */
export function runtimeTranscripts(profile, runtimes) {
  for (const name of profile?.adapters?.runtimes ?? []) {
    const adapter = runtimes?.[name]
    const entry = adapter?.manifest?.roles?.transcripts
    const make = entry && adapter.modules?.[entry.module]?.[entry.export]
    if (typeof make === 'function') return { runtime: name, transcripts: make(profile) }
  }
  return null
}

/**
 * Runs `harness flow audit <n> [--orchestrator <id>[,<id>]] [--top <n>] [--json]`. `roots` is the runtime adapter's folders, replaced by a test.
 * @returns {{ lines: string[], code: number }}
 */
export function auditCommand({
  number,
  flags,
  root,
  profile,
  runtimes,
  roots,
  readText = (path) => readFileSync(path, 'utf8')
}) {
  const read = readFlowsOf(root, profile)
  if (!read)
    return fail('The profile file names no flows folder, or the folder has no index; there is no flow to audit.')
  const flow = read.flows.find((each) => each.number === Number(number))
  if (!flow)
    return fail(
      `There is no flow ${number}; the flows are ${read.flows.map((each) => each.number).join(', ') || 'none'}.`
    )
  const runtime = runtimeTranscripts(profile, runtimes)
  if (!runtime)
    return fail(
      'The audit cannot run: no runtime adapter of this project fills the role `transcripts` (the runtime contract), so there is no way to read the sessions of a flow.'
    )
  const top = flags.top === undefined ? TOP : Number(flags.top)
  if (!(Number.isInteger(top) && top >= 1)) return fail('--top is a whole number of rows from 1.')
  const logPath = join(root, read.dir, flow.file.replace(/\.md$/, '.log.md'))
  const workers = existsSync(logPath) ? workersOfLog(readFileSync(logPath, 'utf8')) : new Map()
  const orchestrators = String(flags.orchestrator ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  const wanted = [
    ...orchestrators.map((id) => ({ id, role: 'orchestrator', step: null })),
    ...[...workers].map(([id, step]) => ({ id, role: 'worker', step }))
  ]
  if (!wanted.length)
    return fail(
      `Flow ${flow.number}'s log names no worker, and no --orchestrator is given; there is no session to read.`
    )
  const { found, missing } = runtime.transcripts.locate({ ids: wanted.map((each) => each.id), roots })
  const byId = new Map()
  for (const each of found) {
    const records = runtime.transcripts.parse(readText(each.path))
    const session = byId.get(each.id) ?? {
      ...wanted.find((item) => item.id === each.id),
      label: each.id.startsWith('local_') ? each.id.slice(6, 14) : each.id,
      records: { turns: [], results: [] }
    }
    session.records.turns.push(...records.turns)
    session.records.results.push(...records.results)
    byId.set(each.id, session)
  }
  const sessions = [...byId.values()]
  if (!sessions.length)
    return fail(
      `None of the ${wanted.length} session(s) of flow ${flow.number} has a transcript on this machine (${runtime.runtime}: ${runtime.transcripts.means}).`
    )
  const report = auditSessions({ flow: flow.number, sessions, missing })
  if (flags.json) return { lines: [JSON.stringify(report)], code: 0 }
  return { lines: auditLines(report, { top, title: flow.title }), code: 0 }
}
