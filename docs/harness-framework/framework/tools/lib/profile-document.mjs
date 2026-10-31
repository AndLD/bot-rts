// The generated profile document (design §7.2): `profile/roles.md` rendered with the profile file. The values that the document derives
// from several roles (the adapters in prose, the coverage gate, the required checks with their notes) are computed here.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from './render.mjs'

export const ROLES_PATH = join(import.meta.dirname, '..', '..', 'profile', 'roles.md')

const names = (entries) => (entries ?? []).map((entry) => (typeof entry === 'string' ? entry : entry?.adapter))
const sentence = (parts) =>
  parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : (parts[0] ?? '')

/** The values that the document derives from the roles of the profile file. */
export function derivedValues(profile) {
  const adapters = profile.adapters ?? {}
  const selected = [
    ...names(adapters.stacks).map((name) => `\`${name}\` (stack)`),
    ...names(adapters.runtimes).map((name) => `\`${name}\` (agent runtime)`),
    ...(adapters.host ? [`\`${adapters.host}\` (host)`] : [])
  ]

  const gate = profile.coverageGate
  let coverageGate
  if (gate) {
    const { statements, branches, functions, lines } = gate
    coverageGate =
      new Set([statements, branches, functions, lines]).size === 1
        ? `${statements} % of statements, branches, functions and lines`
        : `${statements} % of statements, ${branches} % of branches, ${functions} % of functions, ${lines} % of lines`
  }

  const notes = profile.requiredCheckNotes ?? {}
  const requiredChecks = (profile.requiredChecks ?? [])
    .map((name) => (notes[name] ? `\`${name}\` (${notes[name]})` : `\`${name}\``))
    .join(', ')

  const complexity = profile.plan?.complexity
  const markers = (map) =>
    Object.entries(map ?? {})
      .map(([marker, text]) => `\`${marker}\` ${text}`)
      .join('; ')

  return {
    adapters: sentence(selected),
    coverageGate,
    requiredChecks,
    complexityScale: markers(complexity?.scale),
    complexityModels: markers(complexity?.models)
  }
}

/** The text of the profile document for `profile` (with the defaults of the schema applied). */
export function renderProfileDocument(profile, template = readFileSync(ROLES_PATH, 'utf8')) {
  const document = profile.paths?.profileDocument
  if (!document) {
    throw new Error('the profile file has no paths.profileDocument, so there is nowhere to write the profile document')
  }
  return render(template, { ...profile, derived: derivedValues(profile) }, { document })
}

/** The managed file of the registry (generators.mjs). */
export const profileDocument = {
  id: 'profile-document',
  path: (profile) => profile.paths?.profileDocument,
  render: ({ profile }) => renderProfileDocument(profile)
}
