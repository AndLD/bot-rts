// The layer map from one source (design §8.2, blocker B7): the layers of the harness (CORE, DOMAIN, ADAPTER, PROFILE, STATE, ENTRY) are
// globs in the `layers` role of the profile file; the tools add what they know (the vendored copy is CORE, the profile file, the lock, the
// profile document and the bindings are PROFILE, the folder of a framework source is outside the map). `harness layers` prints the map,
// the generator writes it into the harness bindings, and `harness check layers` fails on a file that no layer or two layers claim.
import { execFileSync } from 'node:child_process'
import { readLock, VENDOR_DIR, LOCK_FILE } from './lock.mjs'
import { PROFILE_FILE } from './profile.mjs'

export const LAYERS = Object.freeze(['core', 'domain', 'adapter', 'profile', 'state', 'entry'])
export const BLOCK_ID = 'layers'

const escape = (text) => text.replace(/[.+^${}()|[\]\\]/g, '\\$&')

// The regular expression of a glob: a double star crosses folders (followed by a slash it may match no folder at all); a star and a ? stay in one folder level
export function globToRegExp(glob) {
  let source = ''
  for (let index = 0; index < glob.length; index += 1) {
    const rest = glob.slice(index)
    if (rest.startsWith('**/')) {
      source += '(?:.*/)?'
      index += 2
    } else if (rest.startsWith('**')) {
      source += '.*'
      index += 1
    } else if (glob[index] === '*') {
      source += '[^/]*'
    } else if (glob[index] === '?') {
      source += '[^/]'
    } else {
      source += escape(glob[index])
    }
  }
  return new RegExp(`^${source}$`)
}

/** Whether `path` is claimed by `patterns`: a positive pattern matches it and no `!`-pattern does. */
export function claims(patterns, path) {
  const positive = patterns.filter((pattern) => !pattern.startsWith('!'))
  const negative = patterns.filter((pattern) => pattern.startsWith('!')).map((pattern) => pattern.slice(1))
  return (
    positive.some((pattern) => globToRegExp(pattern).test(path)) && !negative.some((p) => globToRegExp(p).test(path))
  )
}

/** The entries of `layers.core`: a path, optionally followed by `sections` and the numbers of the sections that are CORE. */
export function coreEntries(entries = []) {
  return entries.map((entry) => {
    const [path, keyword, ...numbers] = entry.trim().split(/\s+/)
    return { path, sections: keyword === 'sections' ? numbers : null }
  })
}

/**
 * The map in force: the `layers` role plus what the tools know from the profile file and the lock.
 * @returns {{ scope: string[], excluded: string[], layers: Record<string, string[]>, core: { path: string, sections: string[]|null }[] } | null}
 *   null when the project has no `layers` role
 */
export function layerConfig(root, profile) {
  const configured = profile.layers
  if (!configured) {
    return null
  }
  const lock = readLock(root)
  const known = [PROFILE_FILE, LOCK_FILE, profile.paths?.profileDocument, '**/bindings.md'].filter(Boolean)
  const sourceFolder = lock?.source?.type === 'path' ? [`${lock.source.location}/**`] : []

  return {
    scope: configured.scope ?? [],
    excluded: [...(configured.excluded ?? []), ...sourceFolder],
    core: coreEntries(configured.core),
    layers: {
      core: lock ? [`${VENDOR_DIR}/**`] : [],
      domain: configured.domain ?? [],
      adapter: configured.adapter ?? [],
      profile: [...(configured.profile ?? []), ...known],
      state: configured.state ?? [],
      entry: configured.entry ?? []
    }
  }
}

/**
 * Sorts files into layers. A file in the scope of the map that no layer claims, or that two layers claim, is a problem; a core entry with
 * sections is the one allowed overlap (such a file is CORE in those sections and belongs to another layer for the rest).
 * @returns {{ classes: Map<string, string[]>, problems: string[] }}
 */
export function classify(files, config) {
  const classes = new Map()
  const problems = []
  const coreByPath = new Map(config.core.map((entry) => [entry.path, entry]))

  for (const path of files) {
    if (!claims(config.scope, path) || claims(config.excluded, path)) {
      continue
    }
    const layers = LAYERS.filter((layer) =>
      layer === 'core' ? coreByPath.has(path) || claims(config.layers.core, path) : claims(config.layers[layer], path)
    )
    classes.set(path, layers)
    if (layers.length === 0) {
      problems.push(`${path}: belongs to no layer; add it to a layer of \`layers\` in the profile file`)
    } else if (layers.length > 1 && !(layers.includes('core') && coreByPath.get(path)?.sections)) {
      problems.push(`${path}: belongs to ${layers.length} layers (${layers.join(', ')}); a file has exactly one`)
    }
  }
  for (const entry of config.core) {
    if (!files.includes(entry.path)) {
      problems.push(`${entry.path}: listed as CORE in \`layers.core\` but not found`)
    }
  }
  return { classes, problems }
}

/** The tracked files of the project, as repository paths. */
export function trackedFiles(root) {
  return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n')
    .filter(Boolean)
}

/** `harness check layers`: the problems of the map over the tracked files of the project. */
export function checkLayers({ root, profile, files = trackedFiles(root) }) {
  const config = layerConfig(root, profile)
  return config ? classify(files, config).problems : []
}

const code = (items) => items.map((item) => `\`${item}\``)

function describeLayer(layer, config) {
  const patterns = config.layers[layer]
  const positive = patterns.filter((pattern) => !pattern.startsWith('!'))
  const negative = patterns.filter((pattern) => pattern.startsWith('!')).map((pattern) => pattern.slice(1))
  if (layer === 'core') {
    const entries = config.core.map(({ path, sections }) =>
      sections ? `\`${path}\` (sections ${sections.join(', ')})` : `\`${path}\``
    )
    return [...entries, ...code(positive).map((item) => `${item} (the vendored copy)`)].join(', ')
  }
  const text = code(positive).join(', ')
  return negative.length ? `${text}, except ${code(negative).join(', ')}` : text
}

/** The text of the layer map: what `harness layers` prints and what the generator writes into the bindings. */
export function renderLayerMap(config) {
  const rows = LAYERS.map((layer) => `| **${layer.toUpperCase()}** | ${describeLayer(layer, config) || '–'} |`)
  const lines = ['| Layer | Files and sections |', '| ----- | ------------------ |', ...rows]
  lines.push('', `Not in the map: ${code(config.excluded).join(', ') || 'nothing'}.`)
  lines.push(`The map covers the tracked files that match ${code(config.scope).join(', ')}.`)
  return lines.join('\n')
}

/** The managed block of the harness bindings (generators.mjs). */
export const layerMap = {
  id: 'layer-map',
  block: BLOCK_ID,
  path: (profile) => (profile.layers ? profile.documents?.harnessBindings : undefined),
  render: ({ root, profile }) => renderLayerMap(layerConfig(root, profile))
}
