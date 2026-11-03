// `harness check scaffold` (design §2 and §6.3): files the project owns but whose invariants the framework holds. For now: the stack's ignore
// files must exclude the vendored framework (`harness/`), which a formatter or a linter would otherwise rewrite (design §4.1, role "ignore files");
// and the agent runtime's configuration holds the hook entries and the read exclusions of `access.denyRead` (its adapter's `scaffoldProblems`).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { frameworkDir } from './lock.mjs'
import { ADAPTER_RUNTIMES } from './runtimes.mjs'
import { selectedStacks, STACKS } from './stacks.mjs'

// Whether a line of an ignore file excludes `folder`: the folder itself, with or without a slash, or everything below it
const excludes = (line, folder) =>
  [folder, `${folder}/`, `/${folder}`, `/${folder}/`, `${folder}/**`, `${folder}/*`].includes(line.trim())

const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Whether the text of an ignore file excludes `folder`: a line that names it, or, for a file in which a tool excludes paths with a setting of its own
 * (`extend-exclude = ["harness"]` in a TOML file), a line that matches the `pattern` of the manifest, whose `<folder>` stands for the folder.
 */
export function excludesFolder(text, folder, pattern) {
  return pattern
    ? new RegExp(pattern.replaceAll('<folder>', escaped(folder)), 'm').test(text)
    : text.split('\n').some((line) => excludes(line, folder))
}

/**
 * The problems of the ignore files of the selected stacks. An adapter without a manifest here, or without the role, adds none.
 * @returns {string[]}
 */
export function scaffoldProblems({ root, profile, stacks = STACKS, runtimes = ADAPTER_RUNTIMES }) {
  const dir = frameworkDir(profile)
  // In the framework's own repository (`.`) nothing is vendored, so there is nothing for the formatter to exclude
  const own = dir === '.'
  if (!own && !existsSync(join(root, dir))) {
    return []
  }
  const problems = []
  for (const name of (profile.adapters?.runtimes ?? []).map((entry) =>
    typeof entry === 'string' ? entry : entry.adapter
  )) {
    const check = runtimes[name]?.modules[runtimes[name].manifest.roles['hook-configuration']?.module]?.scaffoldProblems
    problems.push(...(check?.({ root, profile }) ?? []))
  }
  for (const stack of selectedStacks(profile, stacks)) {
    const files = stack.adapter?.manifest.roles['ignore-files']?.files ?? []
    for (const { path, optional, pattern, example } of files) {
      const full = join(root, path)
      if (!existsSync(full)) {
        if (!optional) {
          problems.push(
            `${path}: the ${stack.name} stack expects this ignore file, and it is missing; it must exclude ${dir}/`
          )
        }
        continue
      }
      if (!own && !excludesFolder(readFileSync(full, 'utf8'), dir, pattern)) {
        problems.push(
          `${path}: does not exclude ${dir}/, which the formatter and the linters would rewrite; add the line "${example?.replaceAll('<folder>', dir) ?? `${dir}/`}"`
        )
      }
    }
  }
  return problems
}

export function checkScaffold(context) {
  return {
    problems: scaffoldProblems(context),
    message: 'Checked the ignore files of the stacks and the configuration of the agent runtimes.'
  }
}
