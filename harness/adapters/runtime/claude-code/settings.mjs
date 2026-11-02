// The Claude Code preset's configuration (design §4.2, §4.4 and §7.3): the hook entries of `.claude/settings.json`, which call the vendored runtime hooks,
// and the `Read(...)` deny rules that keep the agent from reading the paths of `access.denyRead`. The bootstrap writes the file once; `harness check
// scaffold` then holds the invariants: every hook entry is present and every deny rule is present.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inFramework } from '../../../tools/lib/lock.mjs'

export const SETTINGS_PATH = '.claude/settings.json'

// The framework's hook entries: the event, the tool matcher, and the script
export const HOOKS = Object.freeze([
  { event: 'SessionStart', script: 'session-start' },
  { event: 'PreToolUse', matcher: 'Bash', script: 'guard-shell' },
  { event: 'PreToolUse', matcher: 'Edit|Write|NotebookEdit', script: 'guard-edit' },
  { event: 'PostToolUse', matcher: 'Edit|Write', script: 'format-edited' }
])

const command = (profile, script) =>
  `node "$CLAUDE_PROJECT_DIR/${inFramework(profile, `tools/runtime-hooks/${script}.mjs`)}"`

/**
 * The `Read(...)` deny rules for gitignore-style patterns: a pattern without a slash matches at any depth, and `!pattern` is a carve-out (an
 * exception such as `.env.example`), written as a rule of its own.
 */
export function denyRules(patterns = []) {
  return patterns.map((pattern) => {
    const negated = pattern.startsWith('!')
    const path = negated ? pattern.slice(1) : pattern
    return `Read(${negated ? '!' : ''}${path.includes('/') ? path : `**/${path}`})`
  })
}

/** The content of `.claude/settings.json` for a profile. */
export function settingsFor(profile) {
  const hooks = {}
  for (const { event, matcher, script } of HOOKS) {
    hooks[event] ??= []
    hooks[event].push({
      ...(matcher ? { matcher } : {}),
      hooks: [{ type: 'command', command: command(profile, script) }]
    })
  }
  return { hooks, permissions: { deny: denyRules(profile.access?.denyRead) } }
}

/** The problems of the settings file of a project: a missing hook entry or deny rule (design §6.3, the scaffold invariants). */
export function scaffoldProblems({ root, profile }) {
  const path = join(root, SETTINGS_PATH)
  if (!existsSync(path)) {
    return [`${SETTINGS_PATH}: missing; the claude-code runtime expects it (the bootstrap writes it)`]
  }
  let settings
  try {
    settings = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    return [`${SETTINGS_PATH}: not valid JSON (${error.message})`]
  }
  const problems = []
  for (const { event, matcher, script } of HOOKS) {
    const entries = (settings.hooks?.[event] ?? []).filter((entry) => (entry.matcher ?? undefined) === matcher)
    const present = entries.some((entry) =>
      (entry.hooks ?? []).some((hook) => hook.command === command(profile, script))
    )
    if (!present) {
      problems.push(
        `${SETTINGS_PATH}: the ${event} hook${matcher ? ` for ${matcher}` : ''} must run ${inFramework(profile, `tools/runtime-hooks/${script}.mjs`)}`
      )
    }
  }
  const deny = new Set(settings.permissions?.deny ?? [])
  for (const rule of denyRules(profile.access?.denyRead)) {
    if (!deny.has(rule)) {
      problems.push(`${SETTINGS_PATH}: permissions.deny lacks ${rule}, the deny rule of access.denyRead`)
    }
  }
  return problems
}
