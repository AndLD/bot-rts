// The managed blocks that an agent-runtime adapter keeps in files of the project (design §6.3, role "managed-blocks"): for the Cursor preset, the block of
// `.cursorignore` that lists `access.denyRead`. One generator per runtime (generators.mjs); the sync adds the block at the end of the file when the file
// lacks it, and rewrites it when it is there, so the project's own lines are never touched.
import { ADAPTER_RUNTIMES } from './runtimes.mjs'

const selectedRuntimes = (profile) =>
  (profile.adapters?.runtimes ?? []).map((entry) => (typeof entry === 'string' ? entry : entry.adapter))

/**
 * The generators of the runtime adapters that fill the role: each gives the blocks `managedBlocks(profile) → [{ path, block, content }]` of its runtime,
 * for a project that selects it.
 * @param {object} runtimes the loaded runtime adapters (`loadAdapterModules('runtime')`)
 */
export function runtimeBlockGenerators(runtimes = ADAPTER_RUNTIMES) {
  return Object.entries(runtimes).flatMap(([runtime, adapter]) => {
    const entry = adapter.manifest.roles['managed-blocks']
    const managedBlocks = entry?.module ? adapter.modules[entry.module]?.[entry.export] : undefined
    return managedBlocks
      ? [
          {
            id: `blocks-${runtime}`,
            expand: ({ profile }) =>
              selectedRuntimes(profile).includes(runtime)
                ? managedBlocks(profile).map((item) => ({ ...item, append: true }))
                : []
          }
        ]
      : []
  })
}
