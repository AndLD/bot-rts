// The transcripts of Claude Code (the runtime contract, role `transcripts`): where the sessions of a flow are on this machine, and how to read one into the neutral
// records `harness flow audit` counts. A session the desktop app started is named `local_<id>`; the app keeps a file per session that holds the id of the
// transcript (`cliSessionId`), and the transcript is a `<id>.jsonl` file in a folder of `projects/` (one folder per working directory, so it is looked up in all).
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** The id of a session the command line started: the name of its transcript file. */
const CLI_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const MEANS =
  'the session files of the Claude desktop app (`claude-code-sessions/<account>/<organization>/local_<id>.json`) name the transcript, a JSONL file under `projects/` of the Claude Code configuration folder'

/** The folders searched when the caller names none: the desktop apps' data folders and the configuration folders of the command line. */
export function defaultRoots(home = homedir(), env = process.env) {
  return {
    apps: [join(home, 'Library', 'Application Support', 'Claude'), join(home, '.claude-second')],
    projects: [
      ...(env.CLAUDE_CONFIG_DIR ? [join(env.CLAUDE_CONFIG_DIR, 'projects')] : []),
      join(home, '.claude', 'projects'),
      join(home, '.claude-second-cli', 'projects')
    ]
  }
}

const folders = (dir) => {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory())
  } catch {
    return []
  }
}

/** The path of the file that names the transcript of the app session `id`, in any account and organization folder of the apps' data. */
function sessionFile(apps, id) {
  for (const app of apps)
    for (const account of folders(join(app, 'claude-code-sessions')))
      for (const organization of folders(join(app, 'claude-code-sessions', account.name))) {
        const path = join(app, 'claude-code-sessions', account.name, organization.name, `${id}.json`)
        if (existsSync(path)) return path
      }
  return null
}

/** The path of the transcript `<cliSessionId>.jsonl` in any folder of the `projects` folders. */
function transcriptFile(projects, cliSessionId) {
  for (const root of projects)
    for (const folder of folders(root)) {
      const path = join(root, folder.name, `${cliSessionId}.jsonl`)
      if (existsSync(path)) return path
    }
  return null
}

/** The transcripts of a session that was started on the command line with a name (`claude -p --worktree <name>`): the files of the folder of that worktree. */
function namedFiles(projects, name) {
  const paths = []
  for (const root of projects)
    for (const folder of folders(root))
      if (folder.name.endsWith(`-claude-worktrees-${name}`))
        for (const file of readdirSync(join(root, folder.name)))
          if (file.endsWith('.jsonl')) paths.push(join(root, folder.name, file))
  return paths
}

/**
 * Where the transcripts of the sessions named by `ids` are: an id `local_<id>` is a session of the desktop app, an id that is a UUID is the transcript of a session the command line started (in any folder of `projects/`), any other id is the name of a worktree a worker
 * was started in on the command line (it may have more than one transcript). `roots` replaces the default folders (a test names its own).
 * @returns {{ found: { id: string, path: string }[], missing: string[] }} (an id may be found in several files)
 */
export function locate({ ids, roots = defaultRoots() }) {
  const found = []
  const missing = []
  for (const id of ids) {
    if (CLI_ID.test(id)) {
      const path = transcriptFile(roots.projects, id)
      if (path) found.push({ id, path })
      else missing.push(id)
      continue
    }
    if (!id.startsWith('local_')) {
      const paths = namedFiles(roots.projects, id)
      if (paths.length) found.push(...paths.map((path) => ({ id, path })))
      else missing.push(id)
      continue
    }
    const file = sessionFile(roots.apps, id)
    let cli = null
    try {
      cli = file ? JSON.parse(readFileSync(file, 'utf8')).cliSessionId : null
    } catch {
      cli = null
    }
    const path = cli ? transcriptFile(roots.projects, cli) : null
    if (path) found.push({ id, path })
    else missing.push(id)
  }
  return { found, missing }
}

const textOf = (content) =>
  typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('')
      : ''

/**
 * One transcript in the neutral records: `turns` (one per model answer: its time, the usage the runtime reported or null, the characters it wrote and the
 * tool calls it made) and `results` (one per tool result: the call it answers and its characters). A model answer is written as one line per content
 * block with the same message id and usage, so the lines of one id are one turn.
 * @returns {{ turns: object[], results: object[] }}
 */
export function parse(text) {
  const turns = new Map()
  const results = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    let entry
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }
    const content = entry.message?.content
    if (entry.type === 'assistant' && entry.message?.id) {
      const turn = turns.get(entry.message.id) ?? {
        at: entry.timestamp ?? null,
        usage: null,
        outputChars: 0,
        calls: []
      }
      const usage = entry.message.usage
      if (usage)
        turn.usage = {
          input: usage.input_tokens ?? 0,
          cacheRead: usage.cache_read_input_tokens ?? 0,
          cacheCreate: usage.cache_creation_input_tokens ?? 0,
          output: usage.output_tokens ?? 0
        }
      for (const part of Array.isArray(content) ? content : []) {
        if (part.type === 'text') turn.outputChars += (part.text ?? '').length
        else if (part.type === 'tool_use') {
          turn.outputChars += JSON.stringify(part.input ?? {}).length
          turn.calls.push({
            id: part.id,
            tool: part.name,
            command: typeof part.input?.command === 'string' ? part.input.command : null
          })
        }
      }
      turns.set(entry.message.id, turn)
    } else if (entry.type === 'user' && Array.isArray(content)) {
      for (const part of content)
        if (part?.type === 'tool_result')
          results.push({ at: entry.timestamp ?? null, callId: part.tool_use_id, chars: textOf(part.content).length })
    }
  }
  return { turns: [...turns.values()], results }
}

/** The role `transcripts`: `{ means, locate, parse }`. */
export function transcriptsFor() {
  return { means: MEANS, locate, parse }
}
