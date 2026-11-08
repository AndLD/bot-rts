// The Claude Code preset's role "settings-audit" (runtime contract): the checks of the security review that read `.claude/settings.json`, and `.claude/settings.local.json`
// when it is there (the local file is the owner's, not committed, and settings merge, so a rule there counts as much): the `Read(...)` deny rules of `access.denyRead`
// are in the shared file (S1-015), no setting turns the permission checks or the hooks off (S4-001, S4-010), and no allow rule is broad (S4-002, S4-023). The
// settings are read as data; nothing is run.
import { existsSync, readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { LOCAL_SETTINGS_PATH, protectedFolders } from './plan-write.mjs'
import { SETTINGS_PATH, denyRules } from './settings.mjs'

// A command that runs whatever its argument says, so a rule that allows it with any argument allows everything: interpreters, package runners, wrappers, fetchers
const OPEN_ENDED = new Set([
  'node',
  'nodejs',
  'deno',
  'bun',
  'python',
  'python3',
  'ruby',
  'perl',
  'php',
  'bash',
  'sh',
  'zsh',
  'fish',
  'eval',
  'exec',
  'source',
  'npx',
  'pnpx',
  'bunx',
  'uvx',
  'pipx',
  'xargs',
  'env',
  'sudo',
  'su',
  'ssh',
  'scp',
  'curl',
  'wget',
  'nc',
  'ncat',
  'osascript'
])
// A command whose wildcard form destroys or changes ownership
const DESTRUCTIVE = new Set([
  'rm',
  'rmdir',
  'dd',
  'shred',
  'mkfs',
  'chmod',
  'chown',
  'truncate',
  'kill',
  'killall',
  'pkill'
])
const FILE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

const rulePattern = /^([\w]+)(?:\((.*)\))?$/s
const wildcard = /[*?[\]{}]/
const clean = (path) => posix.normalize(path.replace(/\\/g, '/')).replace(/^\.\//, '')
const inside = (path, folder) => path === folder || path.startsWith(`${folder}/`)

/** Why an `Edit`-style rule allows too much, or null: the path must be in a named folder of the project, and not in a protected one. */
function broadPath(spec, profile) {
  if (spec === undefined || spec === '') return 'allows every path'
  if (/^[/~]/.test(spec) || spec.split('/').includes('..')) return 'allows a path outside the project'
  const path = clean(spec)
  const folder = path.split('/')[0]
  if (wildcard.test(folder) || !path.includes('/')) return 'is not limited to a named folder of the project'
  const guarded = protectedFolders(profile).find(
    (each) => inside(path.replace(/\/\*\*$/, ''), each) || inside(each, path.replace(/\/\*\*$/, ''))
  )
  return guarded ? `reaches ${guarded}, which holds the settings, the hooks or the Git directory` : null
}

/** Why a `Bash` rule allows too much, or null. */
function broadCommand(spec) {
  if (spec === undefined || /^(?:\*+|:\*)?$/.test(spec.trim())) return 'allows every command'
  const [command, ...rest] = spec.trim().replace(/:\*$/, ' *').split(/\s+/)
  if (wildcard.test(command)) return 'starts with a wildcard, so it allows any command'
  const open = rest.length === 0 || rest[0].startsWith('*')
  const name = command.split('/').pop()
  if (OPEN_ENDED.has(name) && open)
    return `allows \`${name}\` with any argument, and it runs whatever the argument says`
  if (DESTRUCTIVE.has(name) && rest.some((word) => wildcard.test(word))) return `allows \`${name}\` with a wildcard`
  return null
}

/** The problems of the allow rules of a settings object. */
export function broadRules({ allow = [] }, profile, path = SETTINGS_PATH) {
  const accepted = new Set(profile.security?.allowedRules ?? [])
  return allow.flatMap((rule) => {
    if (accepted.has(rule)) return []
    const match = rulePattern.exec(String(rule).trim())
    if (!match) return []
    const [, tool, spec] = match
    const reason = FILE_TOOLS.has(tool) ? broadPath(spec, profile) : tool === 'Bash' ? broadCommand(spec) : null
    return reason ? [{ probe: 'S4-002', text: `${path}: the allow rule \`${rule}\` ${reason}` }] : []
  })
}

/**
 * The problems of the settings of a project: the committed file, then the owner's local file when it is there.
 * @param {{ root: string, profile: object }} options
 * @returns {{ probe: string, text: string }[]}
 */
export function auditSettings({ root, profile }) {
  return [...auditSharedSettings({ root, profile }), ...auditLocalSettings({ root, profile })]
}

function auditSharedSettings({ root, profile }) {
  const path = join(root, SETTINGS_PATH)
  if (!existsSync(path)) {
    return [
      {
        probe: 'S1-015',
        text: `${SETTINGS_PATH}: the file is not there, so no deny rule keeps the agent from the files of access.denyRead`
      }
    ]
  }
  let settings
  try {
    settings = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return [{ probe: 'S1-015', text: `${SETTINGS_PATH}: not valid JSON` }]
  }
  const problems = []
  const deny = new Set(settings.permissions?.deny ?? [])
  for (const rule of denyRules(profile.access?.denyRead)) {
    if (!deny.has(rule)) {
      problems.push({
        probe: 'S1-015',
        text: `${SETTINGS_PATH}: permissions.deny lacks ${rule}, the deny rule of access.denyRead`
      })
    }
  }
  return [...problems, ...switchedOff(settings, SETTINGS_PATH), ...broadRules(settings.permissions ?? {}, profile)]
}

// The settings that turn the permission checks or the hooks off, in the file at `path`
function switchedOff(settings, path) {
  const problems = []
  if (
    settings.permissions?.defaultMode === 'bypassPermissions' ||
    settings.skipDangerousModePermissionPrompt === true
  ) {
    problems.push({
      probe: 'S4-001',
      text: `${path}: the settings turn the permission checks off (bypassPermissions)`
    })
  }
  if (settings.disableAllHooks === true) {
    problems.push({
      probe: 'S4-010',
      text: `${path}: disableAllHooks is on, so the hooks that hold the rules do not run`
    })
  }
  return problems
}

/**
 * The problems of the local settings of the owner (S4-001, S4-002, S4-010, S4-023), which are not committed and which Claude Code merges with the shared file:
 * nothing when the file is not there.
 * @param {{ root: string, profile: object }} options
 * @returns {{ probe: string, text: string }[]}
 */
function auditLocalSettings({ root, profile }) {
  const path = join(root, LOCAL_SETTINGS_PATH)
  if (!existsSync(path)) return []
  let settings
  try {
    settings = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return [{ probe: 'S4-002', text: `${LOCAL_SETTINGS_PATH}: not valid JSON, so its rules could not be read` }]
  }
  return [
    ...switchedOff(settings, LOCAL_SETTINGS_PATH),
    ...broadRules(settings.permissions ?? {}, profile, LOCAL_SETTINGS_PATH)
  ]
}
