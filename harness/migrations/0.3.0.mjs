// Migration to 0.3.0: the release order moves out of the plan index into a file of its own (task 5.1). A table in the section "Order of development" of the
// index becomes the releases file, the profile file gains `paths.releases`, and the section becomes the generated block; an order written in prose is left
// as it is, with a message that the migration note turns into a required action. A project with no such section, or with the role already, is not changed.
// A project with a layer map of its own gets the releases file in the layer of its plan index (issue I-13).
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { layersForReleases } from '../tools/lib/layer-migration.mjs'
import { loadProfile } from '../tools/lib/profile.mjs'
import { moveReleaseOrder } from '../tools/lib/releases-migration.mjs'

// The releases file, added to the layer map of a project that has one
function addReleasesToLayers({ root, profile }) {
  if (!profile.layers || !profile.paths?.releases) {
    return []
  }
  const path = join(root, profile.paths.profileFile ?? 'harness-profile.json')
  const { text, added, manual } = layersForReleases(readFileSync(path, 'utf8'), profile)
  if (added.length) {
    writeFileSync(path, text)
  }
  return [
    ...added.map((glob) => `Added ${glob} to the layer of the plan index in \`layers\` of the profile file.`),
    ...manual.map(
      (glob) =>
        `Required action: add ${glob} to a layer in \`layers\` of the profile file (the layer of the plan index) by hand; the file could not be edited safely. Check: \`check layers\` exits 0.`
    )
  ]
}

export default ({ root, profile }) => [
  ...moveReleaseOrder({ root, profile }),
  ...addReleasesToLayers({ root, profile: loadProfile(root) })
]
