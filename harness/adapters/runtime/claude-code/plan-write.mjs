// The Claude Code preset's switch for writing the plan's files without a prompt (runtime contract, role "plan-write"): an `Edit(<folder>/**)` rule in
// `permissions.allow` of a settings file, for the folders of the plan, the flows and the logs. A rule of this form lets the runtime's edit and write
// tools and a shell append (`cat >> file`) into the folder without a prompt; a path outside it, and `sed -i`, still prompt.
// The functions read the settings file and return the file to write; the caller writes it (the file system root and the home folder are parameters).
import { existsSync, readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { inFramework } from '../../../tools/lib/lock.mjs'
import { SETTINGS_PATH } from './settings.mjs'

export const LOCAL_SETTINGS_PATH = '.claude/settings.local.json'
export const SCOPES = ['project', 'local', 'user']
// The plan's roles of `paths` whose folders an agent writes in every task: the plan itself, with the phases, the flows, the issues and the backlog
const PLAN_PATHS = ['plan', 'phases', 'flows', 'issues', 'backlog']

const rule = (folder) => `Edit(${folder}/**)`
const clean = (folder) => posix.normalize(String(folder).replace(/\\/g, '/')).replace(/^\.\//, '').replace(/\/+$/, '')
const inside = (path, folder) => path === folder || path.startsWith(`${folder}/`)

/** The folders an agent may never write without a prompt: the settings file's folder, the hooks of the runtime and of Git, and the Git directory. */
export const protectedFolders = (profile) => [
  '.claude',
  '.git',
  inFramework(profile, 'tools/runtime-hooks'),
  inFramework(profile, 'tools/git-hooks')
]

/** The default folders: those of the plan's roles of `paths` that are set, without a folder that lies in another of them. */
export function defaultFolders(profile) {
  const folders = [
    ...new Set(
      PLAN_PATHS.map((role) => profile.paths?.[role])
        .filter(Boolean)
        .map(clean)
    )
  ]
  return folders.filter((folder) => !folders.some((other) => other !== folder && inside(folder, other)))
}

/** The folders, from the request or the default, each refused when it is outside the project or is, holds or lies in a protected folder. */
export function foldersFor(profile, requested) {
  const folders = requested?.length ? [...new Set(requested.map(clean))] : defaultFolders(profile)
  for (const folder of folders) {
    if (
      !folder ||
      folder === '.' ||
      folder.startsWith('/') ||
      folder.split('/').includes('..') ||
      /[*?[\]{}()]/.test(folder)
    ) {
      throw new Error(`"${folder}" is not a folder inside the project`)
    }
    const hit = protectedFolders(profile).find((guarded) => inside(guarded, folder) || inside(folder, guarded))
    if (hit) {
      throw new Error(
        `"${folder}" would let an agent write ${hit} without a prompt (the settings, the hooks and the Git directory are never allowed)`
      )
    }
  }
  return folders
}

function pathOf({ scope, home }) {
  if (scope === 'user') {
    if (!home) throw new Error('the user-wide settings need the home folder')
    return { path: join(home, '.claude', 'settings.json'), relative: false }
  }
  return { path: scope === 'local' ? LOCAL_SETTINGS_PATH : SETTINGS_PATH, relative: true }
}

/**
 * Turns the write permission of the plan's folders on or off, or reports it.
 * @param {{ root: string, profile: object, action: 'on'|'off'|'state', folders?: string[], scope?: 'project'|'local'|'user', home?: string }} request
 * @returns {{ on: boolean, folders: { folder: string, allowed: boolean }[], path: string, files: { path: string, content: string }[], messages: string[] }}
 *   `files` is empty for `state` and when nothing changes; `path` is relative to the root for the project and the local scope, absolute for the user scope
 */
export function planWrite({ root, profile, action, folders, scope = 'project', home }) {
  if (!['on', 'off', 'state'].includes(action)) throw new Error(`"${action}" is not on, off or state`)
  if (!SCOPES.includes(scope)) throw new Error(`"${scope}" is not a scope (${SCOPES.join(', ')})`)
  const wanted = foldersFor(profile, folders)
  const { path, relative } = pathOf({ scope, home })
  const full = relative ? join(root, path) : path
  let settings = {}
  if (existsSync(full)) {
    try {
      settings = JSON.parse(readFileSync(full, 'utf8'))
    } catch (error) {
      throw new Error(`${path} is not valid JSON (${error.message}); fix it first`)
    }
  }
  const allow = settings.permissions?.allow ?? []
  const state = wanted.map((folder) => ({ folder, allowed: allow.includes(rule(folder)) }))
  const on = state.length > 0 && state.every(({ allowed }) => allowed)
  const where =
    scope === 'project'
      ? `${path} (tracked, shared)`
      : scope === 'local'
        ? `${path} (ignored by Git)`
        : `${path} (user-wide)`
  const report = state.map(({ folder, allowed }) => `  ${folder}/: ${allowed ? 'allowed' : 'asks'}`)
  if (action === 'state') {
    return {
      on,
      folders: state,
      path,
      files: [],
      messages: [`Writing the plan's files without a prompt: ${on ? 'on' : 'off'} in ${where}.`, ...report]
    }
  }
  const rules = new Set(wanted.map(rule))
  const next =
    action === 'on'
      ? [...allow, ...[...rules].filter((each) => !allow.includes(each))]
      : allow.filter((each) => !rules.has(each))
  const after = state.map(({ folder }) => ({ folder, allowed: action === 'on' }))
  if (next.length === allow.length && next.every((each, index) => each === allow[index])) {
    return {
      on: action === 'on',
      folders: after,
      path,
      files: [],
      messages: [`Already ${action} in ${where}; nothing changed.`, ...report]
    }
  }
  const permissions = { ...settings.permissions, allow: next }
  if (!next.length) delete permissions.allow
  const content = `${JSON.stringify({ ...settings, permissions }, null, 2)}\n`
  return {
    on: action === 'on',
    folders: after,
    path,
    files: [{ path, content }],
    messages: [
      action === 'on'
        ? `Turned on: an agent writes ${wanted.map((folder) => `${folder}/`).join(', ')} without a prompt (${where}). Turn it off with \`harness plan-write off\`.`
        : `Turned off: an agent asks before it writes ${wanted.map((folder) => `${folder}/`).join(', ')} (${where}).`,
      ...(scope === 'user' ? ['This is the user-wide setting: it reaches every project of this user.'] : []),
      `The file is written with two-space indents and one array entry a line: if the project's lint checks formatting, run the project's formatter on ${path}.`
    ]
  }
}

/** The allow rules of the bootstrap: the plan's folders. */
export const planWriteRules = (profile) => defaultFolders(profile).map(rule)
