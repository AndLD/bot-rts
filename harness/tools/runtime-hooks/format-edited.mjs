// Runtime hook (PostToolUse on file writes): formats the edited file with the formatter of the stack that owns it, so that the format check never fails on
// it. It never blocks and never downloads a formatter: the stack says how to run its formatter from the project's own installation, or nothing.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { loadProfile } from '../lib/profile.mjs'
import { owns, selectedStacks, stackModule } from '../lib/stacks.mjs'
import { runHook } from './io.mjs'
import { isMain } from '../lib/main-module.mjs'

/** The command that formats `path`, or null: the owning stack's formatter, if it handles the file. */
export function formatCommand(path, { root, profile }) {
  const relativePath = relative(resolve(root), resolve(root, path))
  const stacks = selectedStacks(profile)
  const stack = stacks.find((candidate) => owns(candidate, relativePath, stacks.length))
  const formatter = stack && stackModule(stack, 'formatter')
  return formatter?.formatCommand?.({ path: relativePath, root }) ?? null
}

export function decide(event) {
  if (event.kind !== 'edit-after' || !existsSync(resolve(event.cwd, event.path))) {
    return {}
  }
  const command = formatCommand(event.path, { root: event.cwd, profile: loadProfile(event.cwd) })
  if (command) {
    // Formatting is a convenience; the format check of the gate and of CI is the guarantee
    spawnSync(command.command, command.args, { cwd: event.cwd, stdio: 'ignore' })
  }
  return {}
}

if (isMain(import.meta.url)) {
  await runHook((event) => decide(event), { kind: 'edit-after' })
}
