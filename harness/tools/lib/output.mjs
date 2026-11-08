// Quiet output (task 6.2): a command prints failures and a one-line summary by default, and the full text of a long run goes to a file. The step of a gate, a project
// check and a hook run with their output in a file; when one fails, the path of the file and the failing lines are printed, capped at `output.maxLines` of the profile file.
import { mkdirSync, mkdtempSync, openSync, closeSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** The most lines of a failed run that are printed, when the profile file names no `output.maxLines`. */
export const MAX_LINES = 40

/** The line cap of the profile file. */
export const maxLinesOf = (profile) => {
  const value = profile?.output?.maxLines
  return Number.isInteger(value) && value >= 1 ? value : MAX_LINES
}

// Lines that say what failed: a runner's own words for it
const FAILING = /\b(fail(ed|ing|ure)?|error|not ok|✖|✗|×|assertion|expected|cannot|ENOENT|panic)\b/i

/**
 * The lines to print of the output of a failed run: the lines that look like failures, else the last lines; at most `maxLines`, and the count of what was left out.
 * @returns {{ lines: string[], omitted: number }}
 */
export function failureLines(text, maxLines = MAX_LINES) {
  const all = text.split('\n').filter((line) => line.trim())
  const failing = all.filter((line) => FAILING.test(line))
  const chosen = failing.length ? failing.slice(0, maxLines) : all.slice(-maxLines)
  return { lines: chosen, omitted: all.length - chosen.length }
}

/** A folder for the output files of one run of a command (a new one each time, under the system's temporary folder). */
export function outputFolder(prefix = 'harness') {
  const base = join(tmpdir(), 'harness-output')
  mkdirSync(base, { recursive: true })
  return mkdtempSync(join(base, `${prefix}-`))
}

/** Opens `file` for a child process to write both its output streams to: the `stdio` of a spawn, and the descriptor to close after it. */
export function stdioToFile(file) {
  const fd = openSync(file, 'w')
  return { stdio: ['inherit', fd, fd], close: () => closeSync(fd) }
}

/** The lines `err` prints for a failed run whose output is in `file`: where the whole text is, the failing lines, and what was left out. */
export function failureReport(file, maxLines) {
  let text = ''
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    return [`(no output was written to ${file})`]
  }
  const { lines, omitted } = failureLines(text, maxLines)
  return [
    `full output: ${file}`,
    ...lines,
    ...(omitted > 0 ? [`… ${omitted} more line(s) in the file (run with --verbose to see everything)`] : [])
  ]
}
