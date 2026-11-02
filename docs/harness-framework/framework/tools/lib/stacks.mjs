// The stack adapters of the project (design §4.1) as the tools use them: the ones the profile selects with the folders each owns, the stack that owns a
// folder or a file, and the module that fills a role. The adapters present in this copy of the framework are loaded once, when this module is imported.
import { loadAdapterModules } from './adapters.mjs'
import { folderOf } from './profile.mjs'

export const STACKS = await loadAdapterModules('stack')

/**
 * The stacks the profile selects, as `{ name, folders, adapter }`; `folders` is empty for a project with one stack that owns everything.
 * An adapter that this copy of the framework does not have has no `adapter` (the profile check and the sync name it).
 */
export function selectedStacks(profile, stacks = STACKS) {
  return (profile.adapters?.stacks ?? []).map((entry) => {
    const name = typeof entry === 'string' ? entry : entry.adapter
    const folders = typeof entry === 'object' && Array.isArray(entry.packages) ? entry.packages.map(folderOf) : []
    return { name, folders, adapter: stacks[name] }
  })
}

const inside = (folder, path) => path === folder || path.startsWith(`${folder}/`)

/** Whether a stack owns a path: a lone stack without folders owns everything; otherwise the path is inside one of its folders. */
export const owns = (stack, path, stackCount) =>
  stack.folders.length === 0 ? stackCount === 1 : stack.folders.some((folder) => inside(folder, path))

/** The stack that owns a package folder (or any path), or undefined. */
export function stackOf(path, profile, stacks = STACKS) {
  const selected = selectedStacks(profile, stacks)
  return selected.find((stack) => owns(stack, path, selected.length))
}

/** The module of a stack that fills `role`, or undefined when the role is empty or the adapter is missing. */
export function stackModule(stack, role) {
  const entry = stack.adapter?.manifest.roles[role]
  return entry?.module ? stack.adapter.modules[entry.module] : undefined
}
