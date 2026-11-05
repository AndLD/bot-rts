// The migration of the layer map to the plan layout of 0.2.0 (issue I-3). A project with its own `layers` lists the one-file phases (`<phases>/phase-*.md`) in
// a layer, and its plan now also lives in phase folders (`<phases>/phase-<n>-<slug>/`) and in the issue queue (`<issues>/`), which no layer claims, so
// `check layers` fails on each of their files. This adds the two globs to the layer that claims the one-file phases, only where no layer claims the folders
// already, as lines of the profile file (its formatting stays). Idempotent: a second run finds the folders claimed.
import { claims } from './layers.mjs'

const LAYER_NAMES = ['domain', 'adapter', 'profile', 'state', 'entry']
const quote = (text) => JSON.stringify(text)
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Inserts `glob` as a line after the line of `anchor` in the array of `layer` under `layers`; null when the array is not laid out one entry to a line
function insertAfter(text, layer, anchor, glob) {
  const layers = text.search(/"layers"\s*:/)
  const key = layers < 0 ? null : new RegExp(`"${layer}"\\s*:\\s*\\[`).exec(text.slice(layers))
  if (!key) {
    return null
  }
  const start = layers + key.index
  const end = text.indexOf(']', start)
  const segment = text.slice(start, end)
  const line = new RegExp(`^([ \\t]*)${escape(quote(anchor))}(,?)[ \\t]*$`, 'm').exec(segment)
  if (!line) {
    return null
  }
  const lines = `${line[1]}${quote(anchor)},\n${line[1]}${quote(glob)}${line[2]}`
  const next = text.slice(0, start) + segment.replace(line[0], () => lines) + text.slice(end)
  try {
    JSON.parse(next)
    return next
  } catch {
    return null
  }
}

/**
 * @param {string} text the profile file's text
 * @param {object} profile the profile (`layers`, `paths.phases`, `paths.issues`)
 * @returns {{ text: string, added: string[], manual: string[] }} `added` are the lines written, `manual` the globs that could not be written
 */
export function layersForPlan(text, profile) {
  const configured = profile.layers
  const { phases, issues } = profile.paths ?? {}
  const unchanged = { text, added: [], manual: [] }
  if (!configured || !phases) {
    return unchanged
  }
  const patterns = (layer) => configured[layer] ?? []
  const claimed = (path) => LAYER_NAMES.some((layer) => claims(patterns(layer), path))
  const inScope = (path) => claims(configured.scope ?? [], path) && !claims(configured.excluded ?? [], path)
  const owner = LAYER_NAMES.find((layer) => claims(patterns(layer), `${phases}/phase-1-x.md`))
  if (!owner) {
    return unchanged
  }
  const anchor = patterns(owner).find(
    (pattern) => !pattern.startsWith('!') && claims([pattern], `${phases}/phase-1-x.md`)
  )

  const wanted = [
    [
      `${phases}/phase-*/**`,
      ['README.md', '1.1.md', '1.1.log.md', 'log.md'].map((file) => `${phases}/phase-1-x/${file}`)
    ],
    ...(issues
      ? [
          [
            `${issues}/**`,
            ['README.md', 'I-1.md', 'I-1.log.md', 'archived/README.md'].map((file) => `${issues}/${file}`)
          ]
        ]
      : [])
  ].filter(([, samples]) => samples.some((path) => inScope(path) && !claimed(path)))

  let next = text
  const added = []
  const manual = []
  for (const [glob] of wanted) {
    const edited = insertAfter(next, owner, anchor, glob)
    if (edited) {
      next = edited
      added.push(glob)
    } else {
      manual.push(glob)
    }
  }
  return { text: next, added, manual }
}

/**
 * The releases file (`paths.releases`, migration 0.3.0, issue I-13) joins the layer that claims the plan index, only where no layer claims it already and the
 * file is in the scope of the layer map. Same shape as `layersForPlan`.
 * @returns {{ text: string, added: string[], manual: string[] }}
 */
export function layersForReleases(text, profile) {
  const configured = profile.layers
  const { planIndex, releases } = profile.paths ?? {}
  const unchanged = { text, added: [], manual: [] }
  if (!configured || !planIndex || !releases) {
    return unchanged
  }
  const patterns = (layer) => configured[layer] ?? []
  const inScope = claims(configured.scope ?? [], releases) && !claims(configured.excluded ?? [], releases)
  if (!inScope || LAYER_NAMES.some((layer) => claims(patterns(layer), releases))) {
    return unchanged
  }
  const owner = LAYER_NAMES.find((layer) => claims(patterns(layer), planIndex))
  const anchor = owner && patterns(owner).find((pattern) => !pattern.startsWith('!') && claims([pattern], planIndex))
  if (!anchor) {
    return { text, added: [], manual: [releases] }
  }
  const edited = insertAfter(text, owner, anchor, releases)
  return edited ? { text: edited, added: [releases], manual: [] } : { text, added: [], manual: [releases] }
}
