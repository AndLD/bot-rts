// The managed files of the neutral procedures (design §6.3 and §8.1): one packaged skill per procedure and per selected agent runtime that packages them
// (`procedure-packaging` role), and the block of the entry file that lists the procedures for every agent, with or without such a runtime: "to <trigger>,
// follow harness/core/procedures/<name>.md". Both are generated, so `harness check generated` fails on a stale one and a sync restores it.
import { entryFile } from './entry.mjs'
import { inFramework } from './lock.mjs'
import {
  listAllProcedures,
  listProcedures,
  listProjectProcedures,
  procedureApplies,
  renderProcedure
} from './procedures.mjs'
import { ADAPTER_RUNTIMES } from './runtimes.mjs'
import { relativeTo } from './render.mjs'

export const PROCEDURES_BLOCK = 'procedures'

const selectedRuntimes = (profile) =>
  (profile.adapters?.runtimes ?? []).map((entry) => (typeof entry === 'string' ? entry : entry.adapter))

// The trigger as a phrase after "To …": the description without its opening "Use when"
const phrase = (description) => description.replace(/^Use when\s+/i, '').replace(/\.$/, '')

/**
 * The skill generators: for each runtime of the framework that packages procedures, and each procedure, the file the runtime wants it in (a runtime may
 * want none for a profile: `skillPath` then returns undefined, as Cursor does when Claude Code's skills serve it).
 * @param {object} runtimes the loaded runtime adapters (`loadAdapterModules('runtime')`)
 */
export function skillGenerators(runtimes = ADAPTER_RUNTIMES, procedures = listProcedures()) {
  return Object.entries(runtimes).flatMap(([runtime, adapter]) => {
    const entry = adapter.manifest.roles['procedure-packaging']
    const packaging = entry?.module ? adapter.modules[entry.module] : null
    return packaging
      ? procedures.map((procedure) => ({
          id: `skill-${runtime}-${procedure.name}`,
          path: (profile) =>
            selectedRuntimes(profile).includes(runtime) && profile.documents && procedureApplies(procedure, profile)
              ? packaging.skillPath(procedure, profile)
              : undefined,
          render: ({ profile }) =>
            packaging.packageProcedure(
              procedure,
              renderProcedure(procedure, profile, packaging.skillPath(procedure, profile))
            )
        }))
      : []
  })
}

/**
 * The skills of the project's own procedures (`paths.procedures`, task 4.1): a procedure is known only from the project's files, so one generator gives all
 * the files of the selected runtimes, whole files and not blocks.
 * @param {object} runtimes the loaded runtime adapters (`loadAdapterModules('runtime')`)
 */
export function projectSkillGenerator(runtimes = ADAPTER_RUNTIMES) {
  return {
    id: 'skills-project',
    expand: ({ root, profile }) => {
      if (!profile.documents) {
        return []
      }
      return Object.entries(runtimes).flatMap(([runtime, adapter]) => {
        const entry = adapter.manifest.roles['procedure-packaging']
        const packaging = entry?.module ? adapter.modules[entry.module] : null
        if (!packaging || !selectedRuntimes(profile).includes(runtime)) {
          return []
        }
        return listProjectProcedures(root, profile)
          .filter((procedure) => procedureApplies(procedure, profile))
          .flatMap((procedure) => {
            const path = packaging.skillPath(procedure, profile)
            return path
              ? [{ path, content: packaging.packageProcedure(procedure, renderProcedure(procedure, profile, path)) }]
              : []
          })
      })
    }
  }
}

/**
 * The skill files of the procedures that do not apply to the profile (their `when` switch is off) in the runtimes the project selected. A sync run by the
 * tools of an older version writes a skill for every procedure of the tree, so the migration removes these.
 */
export function inapplicableSkillPaths(profile, runtimes = ADAPTER_RUNTIMES, procedures = listProcedures()) {
  return Object.entries(runtimes).flatMap(([runtime, adapter]) => {
    const entry = adapter.manifest.roles['procedure-packaging']
    const packaging = entry?.module ? adapter.modules[entry.module] : null
    if (!packaging || !selectedRuntimes(profile).includes(runtime)) {
      return []
    }
    return procedures
      .filter((procedure) => !procedureApplies(procedure, profile))
      .map((procedure) => packaging.skillPath(procedure, profile))
      .filter(Boolean)
  })
}

/** The rows of the procedures block, written relative to the entry file. */
export function renderProceduresBlock(profile, procedures = listProcedures()) {
  const entry = entryFile(profile)
  const rows = procedures
    .filter((procedure) => procedureApplies(procedure, profile))
    .map(({ name, description, source }) => {
      const path = source ?? inFramework(profile, `core/procedures/${name}.md`)
      return `| ${phrase(description)} | [\`${path}\`](${relativeTo(entry, path)}) |`
    })
  return ['| When | Follow the procedure |', '| ---- | -------------------- |', ...rows].join('\n')
}

/** The managed block of the entry file (generators.mjs). */
export const proceduresBlock = {
  id: 'procedures',
  block: PROCEDURES_BLOCK,
  path: (profile) => (profile.documents ? entryFile(profile) : undefined),
  render: ({ root, profile }) => renderProceduresBlock(profile, listAllProcedures(root, profile))
}
