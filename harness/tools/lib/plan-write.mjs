// `harness plan-write on|off|state`: lets an agent write the plan's files without a prompt of the agent runtime, through the runtime adapter's role
// "plan-write" (runtime contract). Core names no runtime: the first selected runtime that fills the role does the work.
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import { selectedAdapters } from './lock.mjs'

const ACTIONS = ['on', 'off', 'state']

/**
 * @param {{ words: string[], flags?: { folders?: string, scope?: string }, root: string, profile: object, runtimes: object, home?: string }} options
 *   `runtimes` are the runtime adapters present (name → { manifest, modules }); `home` is the user's folder (a seam for tests)
 * @returns {{ lines: string[], code: number }}
 */
export function planWriteCommand({ words, flags = {}, root, profile, runtimes, home = homedir() }) {
  const [action] = words
  if (words.length !== 1 || !ACTIONS.includes(action)) {
    return { lines: ['usage: harness plan-write on|off|state [--folders <a,b>] [--scope project|local|user]'], code: 2 }
  }
  const name = selectedAdapters(profile).runtimes.find((each) => runtimes[each]?.manifest.roles['plan-write']?.module)
  if (!name) {
    return {
      lines: [
        'no selected agent runtime fills the role "plan-write": allow the plan\'s folders in the runtime\'s own permissions'
      ],
      code: 1
    }
  }
  const entry = runtimes[name].manifest.roles['plan-write']
  const result = runtimes[name].modules[entry.module][entry.export]({
    root,
    profile,
    action,
    folders: flags.folders
      ? flags.folders
          .split(',')
          .map((each) => each.trim())
          .filter(Boolean)
      : undefined,
    scope: flags.scope,
    home
  })
  for (const { path, content } of result.files) {
    const full = isAbsolute(path) ? path : join(root, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  return { lines: result.messages, code: 0 }
}
