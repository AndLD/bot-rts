// `harness check scaffold` (design §2 and §6.3): files the project owns but whose invariants the framework holds. For now: the stack's ignore
// files must exclude the vendored framework (`harness/`), which a formatter or a linter would otherwise rewrite (design §4.1, role "ignore files").
// The manifest of the stack names the files and what an exclusion looks like; the agent runtime's invariants follow with its preset.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { VENDOR_DIR } from './lock.mjs'
import { selectedStacks, STACKS } from './stacks.mjs'

// Whether a line of an ignore file excludes `folder`: the folder itself, with or without a slash, or everything below it
const excludes = (line, folder) =>
  [folder, `${folder}/`, `/${folder}`, `/${folder}/`, `${folder}/**`, `${folder}/*`].includes(line.trim())

/**
 * The problems of the ignore files of the selected stacks. An adapter without a manifest here, or without the role, adds none.
 * @returns {string[]}
 */
export function scaffoldProblems({ root, profile, stacks = STACKS }) {
  if (!existsSync(join(root, VENDOR_DIR))) {
    return []
  }
  const problems = []
  for (const stack of selectedStacks(profile, stacks)) {
    const files = stack.adapter?.manifest.roles['ignore-files']?.files ?? []
    for (const { path, optional } of files) {
      const full = join(root, path)
      if (!existsSync(full)) {
        if (!optional) {
          problems.push(
            `${path}: the ${stack.name} stack expects this ignore file, and it is missing; it must exclude ${VENDOR_DIR}/`
          )
        }
        continue
      }
      if (
        !readFileSync(full, 'utf8')
          .split('\n')
          .some((line) => excludes(line, VENDOR_DIR))
      ) {
        problems.push(
          `${path}: does not exclude ${VENDOR_DIR}/, which the formatter and the linters would rewrite; add the line "${VENDOR_DIR}/"`
        )
      }
    }
  }
  return problems
}

export function checkScaffold(context) {
  return {
    problems: scaffoldProblems(context),
    message: 'Checked that the ignore files of the stacks exclude the vendored framework.'
  }
}
