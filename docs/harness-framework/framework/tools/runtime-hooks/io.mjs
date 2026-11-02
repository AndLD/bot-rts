// The input and output of the runtime hooks (design §4.2 and §7.3): one place that reads the event of either runtime and answers in its form, so
// the hook scripts do not know which runtime called them. Claude Code is recognised by default; Cursor by the `cursor_version` field of its events
// (native mode: `.cursor/hooks.json`; compat mode: Cursor runs the Claude Code hooks and sends Claude Code's own form, with `cursor_version`).
//
// An event is `{ runtime, kind, command?, path?, cwd }`, where `kind` is `shell` (a shell command about to run), `edit-before` (a file about to be
// written), `edit-after` (a file written) or `session-start`. A result is `{ block?: string, context?: string }`.

const SHELL_TOOLS = new Set(['Bash', 'Shell'])
const WRITE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit'])

/**
 * Parses the standard input of a hook; null when it is not an event this module understands. A hook script knows what it is for, so `expected` (its
 * kind) fills in an event that does not name itself; a session start needs no input at all.
 */
export function readEvent(input, expected) {
  let raw
  try {
    raw = JSON.parse(input)
  } catch {
    raw = expected === 'session-start' ? {} : null
  }
  if (raw === null || typeof raw !== 'object') {
    return null
  }
  const runtime = typeof raw.cursor_version === 'string' ? 'cursor' : 'claude-code'
  const name = raw.hook_event_name
  const toolInput = raw.tool_input ?? {}
  const base = { runtime, cwd: raw.cwd ?? raw.workspace_roots?.[0] ?? process.cwd(), name }

  if (name === undefined && expected) {
    const toolInput0 = raw.tool_input ?? {}
    const command0 = raw.command ?? toolInput0.command
    const path0 = raw.file_path ?? toolInput0.file_path
    if (expected === 'shell') return typeof command0 === 'string' ? { ...base, kind: 'shell', command: command0 } : null
    if (expected === 'session-start') return { ...base, kind: 'session-start' }
    return typeof path0 === 'string' ? { ...base, kind: expected, path: path0 } : null
  }
  if (name === 'SessionStart' || name === 'sessionStart') {
    return { ...base, kind: 'session-start' }
  }
  if (
    name === 'beforeShellExecution' ||
    (name === 'preToolUse' && SHELL_TOOLS.has(raw.tool_name)) ||
    (name === 'PreToolUse' && SHELL_TOOLS.has(raw.tool_name))
  ) {
    const command = raw.command ?? toolInput.command
    return typeof command === 'string' ? { ...base, kind: 'shell', command } : null
  }
  if (name === 'afterFileEdit' || (name === 'PostToolUse' && WRITE_TOOLS.has(raw.tool_name))) {
    const path = raw.file_path ?? toolInput.file_path
    return typeof path === 'string' ? { ...base, kind: 'edit-after', path } : null
  }
  if ((name === 'PreToolUse' || name === 'preToolUse') && WRITE_TOOLS.has(raw.tool_name)) {
    const path = toolInput.file_path ?? raw.file_path
    return typeof path === 'string' ? { ...base, kind: 'edit-before', path } : null
  }
  return null
}

/**
 * The answer in the runtime's form.
 * @returns {{ code: number, stdout: string, stderr: string }} the exit code and what to write to standard output and error
 */
export function answer(event, { block, context } = {}) {
  if (event.runtime === 'cursor') {
    if (block) {
      return {
        code: 2,
        stdout: `${JSON.stringify({ permission: 'deny', user_message: block, agent_message: block })}\n`,
        stderr: `${block}\n`
      }
    }
    if (context) {
      return { code: 0, stdout: `${JSON.stringify({ additional_context: context })}\n`, stderr: '' }
    }
    return {
      code: 0,
      stdout:
        event.kind === 'shell' || event.kind === 'edit-before' ? `${JSON.stringify({ permission: 'allow' })}\n` : '',
      stderr: ''
    }
  }
  if (block) {
    return { code: 2, stdout: '', stderr: `${block}\n` }
  }
  return { code: 0, stdout: context ? `${context}\n` : '', stderr: '' }
}

/** Runs a hook of the given `kind`: reads the event from standard input, calls `decide(event) → result`, and answers; a hook never fails the call by crashing. */
export async function runHook(
  decide,
  {
    kind,
    stdin = process.stdin,
    stdout = process.stdout,
    stderr = process.stderr,
    exit = (code) => (process.exitCode = code)
  } = {}
) {
  let input = ''
  stdin.setEncoding('utf8')
  for await (const chunk of stdin) {
    input += chunk
  }
  const event = readEvent(input, kind)
  if (!event) {
    return
  }
  let result
  try {
    result = (await decide(event)) ?? {}
  } catch {
    return // a hook that cannot decide lets the call proceed; the Git hooks and CI still hold the rules
  }
  const { code, stdout: out, stderr: err } = answer(event, result)
  if (out) stdout.write(out)
  if (err) stderr.write(err)
  exit(code)
}
