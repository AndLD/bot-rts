// The Claude Code preset's part of `harness adopt` (design §6.4, role "hook adoption"): a project that has `.claude/settings.json` of its own gets the framework's
// hook entries and read exclusions added to it, and the hook commands that are not the framework's are named, so that the project removes the ones whose job
// the framework now does. Nothing of the project's own is deleted.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inFramework } from '../../../tools/lib/lock.mjs'
import { denyRules, HOOKS, SETTINGS_PATH, settingsFor } from './settings.mjs'

/**
 * The settings of a project with the framework's entries added.
 * @returns {{ files: { path: string, content: string }[], notes: string[] }} no file when the project has no settings file (the scaffold writes it)
 */
export function adoptConfiguration({ root, profile }) {
  const path = join(root, SETTINGS_PATH)
  if (!existsSync(path)) {
    return { files: [], notes: [] }
  }
  const settings = JSON.parse(readFileSync(path, 'utf8'))
  const wanted = settingsFor(profile)
  const hooks = (settings.hooks ??= {})
  const own = inFramework(profile, 'tools/runtime-hooks/')

  for (const { event, matcher } of HOOKS) {
    const entry = wanted.hooks[event].find((item) => (item.matcher ?? undefined) === matcher && item.hooks.length)
    const command = entry.hooks[0].command
    const present = (hooks[event] ??= []).some((item) => (item.hooks ?? []).some((hook) => hook.command === command))
    if (!present) {
      hooks[event].push(entry)
    }
  }
  const deny = new Set((settings.permissions ??= {}).deny ?? [])
  for (const rule of denyRules(profile.access?.denyRead)) {
    deny.add(rule)
  }
  settings.permissions.deny = [...deny]

  const notes = Object.values(hooks)
    .flat()
    .flatMap((item) => item.hooks ?? [])
    .map((hook) => hook.command)
    .filter((command) => typeof command === 'string' && !command.includes(own))
    .map(
      (command) =>
        `${SETTINGS_PATH}: the hook \`${command}\` is the project's own; remove it if the framework's hook does its job.`
    )
  notes.push(
    `${SETTINGS_PATH} is written with two-space indents and one array entry a line: if the project's lint checks formatting, run the project's formatter on it.`
  )
  return { files: [{ path: SETTINGS_PATH, content: `${JSON.stringify(settings, null, 2)}\n` }], notes }
}
