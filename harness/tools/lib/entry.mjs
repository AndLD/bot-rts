// The managed blocks of the entry file (design §6.3): its non-negotiables (section 1) and its Git rules (section 7, with the Role binding line)
// are the framework's `core/rules/` templates rendered with the profile file, so the rules have one home and the entry file only routes. Each
// rule carries a stable id (`<!-- rule:<id> -->`), which the rule-to-check map uses.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { placeholderPaths, render, valueAt } from './render.mjs'

export const DEFAULT_ENTRY_FILE = 'AGENTS.md'
export const RULES_DIR = join(import.meta.dirname, '..', '..', 'core', 'rules')

// The block id and the template of each managed block of the entry file
export const ENTRY_BLOCKS = Object.freeze({ 'non-negotiables': 'non-negotiables.md', 'git-rules': 'git.md' })

const RULE_ID = /<!-- rule:([a-z0-9.-]+) -->/g

/** The template of a block without its leading comment, which explains the file and is not part of the block. */
export function rulesTemplate(file, dir = RULES_DIR) {
  return readFileSync(join(dir, file), 'utf8').replace(/^<!--[\s\S]*?-->\n/, '')
}

/** The rule ids of a rendered or template text, in order. */
export const ruleIds = (text) => [...text.matchAll(RULE_ID)].map((match) => match[1])

export const entryFile = (profile) => profile.paths?.entryFile ?? DEFAULT_ENTRY_FILE

/** The roles a template names that the profile leaves empty. */
export const missingRoles = (template, profile) =>
  placeholderPaths(template).filter((path) => [undefined, null, ''].includes(valueAt(profile, path)))

/**
 * The text of a block for `profile`; the links are written relative to the entry file. The renderer leaves out a line whose placeholder has no
 * value, which would drop part of a rule, so a block whose roles are not all filled is an error instead.
 */
export function renderEntryBlock(block, profile, dir = RULES_DIR) {
  const template = rulesTemplate(ENTRY_BLOCKS[block], dir)
  const missing = missingRoles(template, profile)
  if (missing.length > 0) {
    throw new Error(`the block "${block}" of the entry file needs the profile roles ${missing.join(', ')}`)
  }
  return render(template, profile, { document: entryFile(profile) })
}

/** The generators of the registry (generators.mjs): one per block, for a project with a document map, which the rules link. */
export const entryBlocks = Object.keys(ENTRY_BLOCKS).map((block) => ({
  id: `entry-${block}`,
  block,
  path: (profile) => (profile.documents ? entryFile(profile) : undefined),
  render: ({ profile }) => renderEntryBlock(block, profile)
}))
