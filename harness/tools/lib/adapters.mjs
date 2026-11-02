// The adapters of the framework (design §4): their manifests, held to the contract of their axis (`profile/manifest.schema.json`, whose `x-roles`
// is the machine form of core/contracts/<axis>.md), and the host adapter's modules, which the checks load by the role they fill. A selected
// adapter whose folder holds no manifest yet is skipped by the check, so a project can select an adapter before the framework ships it.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validate } from './profile.mjs'

export const AXES = Object.freeze(['stack', 'runtime', 'host'])
export const ADAPTERS_DIR = join(import.meta.dirname, '..', '..', 'adapters')
export const MANIFEST_SCHEMA_PATH = join(import.meta.dirname, '..', '..', 'profile', 'manifest.schema.json')

export const readManifestSchema = (path = MANIFEST_SCHEMA_PATH) => JSON.parse(readFileSync(path, 'utf8'))

/** The adapters of a framework tree: `{ axis, name, dir, manifest }` for every folder with a `manifest.json` (the `_skeleton` folders are templates). */
export function listAdapters(adaptersDir = ADAPTERS_DIR) {
  return AXES.flatMap((axis) => {
    const axisDir = join(adaptersDir, axis)
    if (!existsSync(axisDir)) {
      return []
    }
    return readdirSync(axisDir, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() && !entry.name.startsWith('_') && existsSync(join(axisDir, entry.name, 'manifest.json'))
      )
      .map((entry) => {
        const dir = join(axisDir, entry.name)
        return { axis, name: entry.name, dir, manifest: JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) }
      })
  })
}

/**
 * The problems of one adapter against the contract of its axis; each is prefixed with the adapter. The structure, the folder name, the roles
 * (required ones filled, no unknown ones), and that the files and modules a role names exist and export what it says.
 */
export function manifestProblems({ axis, name, dir, manifest }, schema = readManifestSchema()) {
  const where = `adapters/${axis}/${name}/manifest.json`
  const problems = validate(schema, manifest).map((problem) => `${where}: ${problem}`)
  if (problems.length) {
    return problems
  }
  if (manifest.axis !== axis || manifest.name !== name) {
    problems.push(`${where}: declares ${manifest.axis}/${manifest.name}, but sits in the folder ${axis}/${name}`)
  }
  try {
    new RegExp(manifest.terms, 'i')
  } catch (error) {
    problems.push(`${where}: terms is not a regular expression (${error.message})`)
  }
  const contract = schema['x-roles'][manifest.axis]
  for (const [role, kind] of Object.entries(contract)) {
    if (!manifest.roles[role] && (kind === 'required' || kind === 'logic')) {
      problems.push(`${where}: the ${kind} role "${role}" of the ${manifest.axis} contract is not filled`)
    }
  }
  for (const [role, entry] of Object.entries(manifest.roles)) {
    const kind = contract[role]
    if (!kind) {
      problems.push(`${where}: "${role}" is not a role of the ${manifest.axis} contract`)
    }
    if (kind?.startsWith('logic') && !(entry.module && entry.export)) {
      problems.push(`${where}: the logic role "${role}" needs a module and an export`)
    }
    for (const file of [entry.file, entry.module].filter(Boolean)) {
      if (!existsSync(join(dir, file))) {
        problems.push(`${where}: role "${role}" names ${file}, which the adapter does not have`)
      }
    }
  }
  for (const file of manifest.templates ?? []) {
    if (!existsSync(join(dir, file))) {
      problems.push(`${where}: lists the template ${file}, which the adapter does not have`)
    }
  }
  return problems
}

/** The problems of every adapter in `adaptersDir`, and the adapters. */
export function checkAdapters(adaptersDir = ADAPTERS_DIR) {
  const adapters = listAdapters(adaptersDir)
  return { adapters, problems: adapters.flatMap((adapter) => manifestProblems(adapter)) }
}

/** The term patterns of every adapter in `adaptersDir`, which the CORE scan joins with the term lists of the profile file. */
export function adapterTerms(adaptersDir = ADAPTERS_DIR) {
  return listAdapters(adaptersDir).map(({ axis, name, manifest }) => ({
    source: `${axis} adapter ${name}`,
    pattern: manifest.terms
  }))
}

/** The host adapter modules by host name, loaded once: `{ github: { workflows, protect, … } }`, from the `logic` roles of the manifests. */
export async function loadHostAdapters(adaptersDir = ADAPTERS_DIR) {
  const hosts = {}
  for (const { axis, name, dir, manifest } of listAdapters(adaptersDir)) {
    if (axis !== 'host') {
      continue
    }
    const modules = {}
    for (const entry of Object.values(manifest.roles)) {
      if (entry.module && !modules[entry.module]) {
        modules[entry.module] = await import(join(dir, entry.module))
      }
    }
    hosts[name] = { manifest, modules }
  }
  return hosts
}
