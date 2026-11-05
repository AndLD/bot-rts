// The executors of Claude Code (the runtime contract, role `executors`): how an orchestrator of a flow starts a worker with a model and an effort, continues
// it with a next prompt, fetches its full final report and reads its context. A `session` worker runs in the Claude desktop app (a session the orchestrator
// starts, which the owner can open and steer, with the hooks and the CI monitoring of a session) or on the command line (`claude -p`, continued with
// `--resume`); a `subagent` runs in the orchestrator's process, gets no CI wake-ups and cannot report its context. Each operation lists its means, the
// desktop app first. The prompt goes where the slot `<prompt>` is; the tools of the framework fill it.

const SLOT = '<prompt>'
const APP = 'the Claude desktop app'
const CLI = 'the command line'

// The prompt cache of Claude Code lives an hour on a subscription and five minutes with an API key; a flow that runs on an API key sets
// `reuseLimits.cacheMinutes` to 5.
const CACHE_MINUTES = 60

/** A model as the runtime names it: `Sonnet 5.5` is `claude-sonnet-5-5`; a full id stays as it is. */
export function modelId(model) {
  if (!model) return null
  const words = model.trim().toLowerCase()
  if (/^claude-[a-z0-9-]+$/.test(words)) return words
  return `claude-${words.replace(/[\s.]+/g, '-')}`
}

/** The alias of the model family, as the subagent tool takes it (`sonnet`, `opus`, `haiku`, `fable`). */
export const modelAlias = (model) =>
  model
    ? model
        .trim()
        .toLowerCase()
        .split(/[\s-]+/)[0]
        .replace(/^claude$/, '') || null
    : null

const defined = (object) =>
  Object.fromEntries(Object.entries(object).filter(([, value]) => value !== null && value !== undefined))
const cliModel = ({ model, effort }) => [
  ...(model ? ['--model', modelId(model)] : []),
  ...(effort ? ['--effort', effort] : [])
]
// The permission setting of a flow (`permissions: { mode, allow }`, in this runtime's own words) as the flags of a worker on the command line. A worker started that way
// has no one to answer a prompt, so under the default it is refused every edit and command; the desktop app's sessions run under the app's own permission settings.
// The list of allowed tools is one argument, and it comes before another flag, because the flag takes every word after it.
const cliPermissions = ({ permissions }) => [
  ...(permissions?.mode ? ['--permission-mode', permissions.mode] : []),
  ...(permissions?.allow?.length ? ['--allowedTools', permissions.allow.join(',')] : [])
]
const PERMISSIONS_READS =
  "a worker on the command line is refused every edit and command unless the flow's `permissions` setting allows them (a mode, and tools by name)"
const JSON_ANSWER =
  '`session_id` is the worker, `result` its full final report, and `usage` with `modelUsage.<model>.contextWindow` its context'

const BACKGROUND =
  'A step of a flow of the development plan, handed to you by the orchestrator of the flow (the procedure run-flow). The prompt is the whole brief: follow the entry file and the Git rules it states, stop where it says, and end with the step report it asks for.'

const session = {
  means:
    'a session of its own that the orchestrator starts and the owner can open and steer, with the hooks and the CI monitoring of a session',
  wakeups: true,
  cacheMinutes: CACHE_MINUTES,
  start: ({ prompt = SLOT, model, effort, cwd, name, permissions }) => [
    {
      via: APP,
      tool: 'start_session',
      input: defined({
        initiation: 'user_asked',
        context: 'fresh',
        title: name,
        name,
        prompt,
        background: BACKGROUND,
        model: modelId(model),
        effort,
        cwd: cwd && cwd !== '.' ? cwd : null,
        use_worktree: true
      }),
      reads:
        "the `local_…` id of the result is the worker; when it ends its turn the app continues the orchestrator with a note of its first 400 characters. A model above the orchestrator's is lowered to it"
    },
    {
      via: CLI,
      command: [
        'claude',
        '-p',
        ...cliModel({ model, effort }),
        ...cliPermissions({ permissions }),
        '--output-format',
        'json',
        '--name',
        name,
        prompt
      ],
      reads: `run it in the step's repository, in the background (it returns when the step ends); ${PERMISSIONS_READS}; ${JSON_ANSWER}`
    }
  ],
  continue: ({ worker, prompt = SLOT, model, effort, permissions }) => [
    {
      via: APP,
      tool: 'SendMessage',
      input: { to: worker, message: prompt },
      reads: 'the app continues the orchestrator when the worker ends its turn'
    },
    {
      via: CLI,
      command: [
        'claude',
        '-p',
        '--resume',
        worker,
        ...cliModel({ model, effort }),
        ...cliPermissions({ permissions }),
        '--output-format',
        'json',
        prompt
      ],
      reads: JSON_ANSWER
    }
  ],
  report: ({ worker }) => [
    {
      via: APP,
      tool: 'list_events',
      input: { session_id: worker, limit: 6 },
      reads: "the worker's last assistant message is its full step report (the app's note is cut at 400 characters)"
    },
    { via: CLI, from: 'the `result` field of the JSON answer of the last call is the full step report' }
  ],
  context: ({ worker }) => [
    {
      via: APP,
      tool: 'get_usage',
      input: { session_id: worker },
      reads:
        '`context.percentUsed` is the context in percent of its window; "unavailable" (an idle or archived session) counts as not read'
    },
    {
      via: CLI,
      from: 'the context of the last call: `usage.input_tokens` + `usage.cache_read_input_tokens` + `usage.cache_creation_input_tokens`, over `modelUsage.<model>.contextWindow`, in percent'
    }
  ],
  // What a worker on the command line will be allowed, in one line for `harness flow dispatch`
  permissions: ({ permissions }) =>
    permissions?.mode || permissions?.allow?.length
      ? `a worker on the command line runs with ${[permissions.mode ? `the permission mode ${permissions.mode}` : null, permissions.allow?.length ? `these tools allowed: ${permissions.allow.join(', ')}` : null].filter(Boolean).join(' and ')}; a session of the desktop app runs under the app's own permission settings`
      : 'none set (the flow\'s `permissions` setting): a worker on the command line is refused every edit and command, so it reports itself blocked (issue I-11); set `permissions` to `{ "mode": "<a mode of the runtime>", "allow": [<tools by name>] }`; a session of the desktop app runs under the app\'s own permission settings',
  // A desktop app's session runs on the app's account, which it names in `CLAUDE_CODE_USER_EMAIL`; a `claude -p` worker runs on the account of the
  // command line's configuration folder, which `claude auth status` names (with two accounts on one machine, the folders differ).
  account: () => [
    {
      via: APP,
      command: ['printenv', 'CLAUDE_CODE_USER_EMAIL'],
      reads: 'the account of the session, which a worker it starts runs on'
    },
    {
      via: CLI,
      command: ['claude', 'auth', 'status'],
      reads: 'the `email` field: the account a `claude -p` worker runs on'
    }
  ]
}

const subagent = {
  means:
    "a subagent in the orchestrator's own process, for a short step of analysis: its full result comes back, but it gets no CI wake-ups",
  wakeups: false,
  cacheMinutes: CACHE_MINUTES,
  start: ({ prompt = SLOT, model, name }) => [
    {
      via: 'the agent tool',
      tool: 'Agent',
      input: defined({ description: name, prompt, model: modelAlias(model), subagent_type: 'general-purpose' }),
      reads:
        "the subagent's final message is its full step report; its name or id continues it. The tool takes the model family, not the effort"
    }
  ],
  continue: ({ worker, prompt = SLOT }) => [
    {
      via: 'the agent tool',
      tool: 'SendMessage',
      input: { to: worker, message: prompt },
      reads: 'its answer is the full step report'
    }
  ],
  report: () => [{ via: 'the agent tool', from: "the subagent's final message, which the tool returns whole" }],
  context: () => []
}

/** The executors of Claude Code for a project (`profile` is unused: the means are the runtime's own). */
export const executorsFor = () => ({ session, subagent })
