// The managed files (design §6.3): files the tools generate in the project from the vendored tree and the profile file, and check by
// regenerating them. Each generator is `{ id, path(profile) → the file's path, render({ root, profile }) → its text }`, or, for a block inside a file the project owns,
// the same with `block: <id>` (managed.mjs): the text is then only the content of the block. The build tasks add
// them: the rule-map rows (17.11) and the packaged skills (17.12).
import { entryBlocks } from './entry.mjs'
import { layerMap } from './layers.mjs'
import { profileDocument } from './profile-document.mjs'

export const generators = [profileDocument, layerMap, ...entryBlocks]
