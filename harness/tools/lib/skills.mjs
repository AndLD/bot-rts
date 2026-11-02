// The managed files of the neutral procedures (design §6.3 and §8.1): one packaged skill per procedure and per selected agent runtime that packages them
// (`procedure-packaging` role), and the block of the entry file that lists the procedures for every agent, with or without such a runtime: "to <trigger>,
// follow harness/core/procedures/<name>.md". Both are generated, so `harness check generated` fails on a stale one and a sync restores it.
import { entryFile } from './entry.mjs'
import { listProcedures, renderProcedure } from './procedures.mjs'
import { ADAPTER_RUNTIMES } from './runtimes.mjs'
import { relativeTo } from './render.mjs'

export const PROCEDURES_BLOCK = 'procedures'
const CORE_PROCEDURES = 'harness/core/procedures'

const selectedRuntimes = (profile) =>
  (profile.adapters?.runtimes ?? []).map((entry) => (typeof entry === 'string' ? entry : entry.adapter))

// The trigger as a phrase after "To …": the description without its opening "Use when"
const phrase = (description) => description.replace(/^Use when\s+/i, '').replace(/\.$/, '')

/**
 * The skill generators: for each runtime of the framework that packages procedures, and each procedure, the file the runtime wants it in.
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
            selectedRuntimes(profile).includes(runtime) && profile.documents
              ? packaging.skillPath(procedure)
              : undefined,
          render: ({ profile }) =>
            packaging.packageProcedure(procedure, renderProcedure(procedure, profile, packaging.skillPath(procedure)))
        }))
      : []
  })
}

/** The rows of the procedures block, written relative to the entry file. */
export function renderProceduresBlock(profile, procedures = listProcedures()) {
  const entry = entryFile(profile)
  const rows = procedures.map(
    ({ name, description }) =>
      `| ${phrase(description)} | [\`${CORE_PROCEDURES}/${name}.md\`](${relativeTo(entry, `${CORE_PROCEDURES}/${name}.md`)}) |`
  )
  return ['| When | Follow the procedure |', '| ---- | -------------------- |', ...rows].join('\n')
}

/** The managed block of the entry file (generators.mjs). */
export const proceduresBlock = {
  id: 'procedures',
  block: PROCEDURES_BLOCK,
  path: (profile) => (profile.documents ? entryFile(profile) : undefined),
  render: ({ profile }) => renderProceduresBlock(profile)
}
