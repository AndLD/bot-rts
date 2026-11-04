// The neutral procedures (design §8.1, B6): `core/procedures/<name>.md`, steps an agent follows for a recurring piece of work. Each has frontmatter (`name`,
// `description` — the trigger: when to use it —, `invocation`: `auto`, or `explicit` only for a procedure that an agent must not start on its own judgment (design §8.1), and optional `paths` and `when`) and a body that names roles of the profile file and
// commands as `{{commands.lint}}`. An agent-runtime adapter packages them for its runtime (a skill, for Claude Code); a project without such a runtime reads
// them from the reading map of its entry file. The body is rendered with the profile file, and a role it needs that the profile lacks is an error.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, valueAt } from './render.mjs'

export const PROCEDURES_DIR = join(import.meta.dirname, '..', '..', 'core', 'procedures')
export const INVOCATIONS = Object.freeze(['auto', 'explicit'])
const NAME = /^[a-z][a-z0-9-]*$/

/** The procedure in `text`: `{ name, description, invocation, paths?, body }`. Fails on a malformed or incomplete header. */
export function parseProcedure(text, file = 'a procedure') {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) {
    throw new Error(`${file}: a procedure starts with a frontmatter block between two --- lines`)
  }
  const header = Object.fromEntries(
    match[1].split('\n').map((line) => {
      const at = line.indexOf(':')
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()]
    })
  )
  for (const key of ['name', 'description', 'invocation']) {
    if (!header[key]) {
      throw new Error(`${file}: the frontmatter needs "${key}"`)
    }
  }
  if (!NAME.test(header.name)) {
    throw new Error(`${file}: the name "${header.name}" must be lowercase words joined by hyphens`)
  }
  if (!INVOCATIONS.includes(header.invocation)) {
    throw new Error(`${file}: invocation must be ${INVOCATIONS.join(' or ')}, not "${header.invocation}"`)
  }
  return {
    name: header.name,
    description: header.description,
    invocation: header.invocation,
    ...(header.paths ? { paths: header.paths.split(',').map((glob) => glob.trim()) } : {}),
    ...(header.when ? { when: header.when } : {}),
    body: match[2].replace(/^\n+/, '')
  }
}

/**
 * Whether a procedure applies to a project: one with a `when` (a role of the profile file, such as `reports.intake`) applies only when the role is set and
 * is not `off`, so that a project that does not use the switch carries no skill and no row of the reading map for it.
 */
export function procedureApplies(procedure, profile) {
  if (!procedure.when) {
    return true
  }
  const value = valueAt(profile, procedure.when)
  return value !== undefined && value !== null && value !== '' && value !== false && value !== 'off'
}

/** The procedures of a folder, sorted by name; the file name is the procedure's name. */
export function listProcedures(dir = PROCEDURES_DIR) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((file) => {
      const procedure = parseProcedure(readFileSync(join(dir, file), 'utf8'), file)
      if (`${procedure.name}.md` !== file) {
        throw new Error(`${file}: the name "${procedure.name}" must be the name of the file`)
      }
      return procedure
    })
}

/**
 * The procedures of the project's own (`paths.procedures`, task 4.1): files of the same format in a folder of the project, each with `source`, its path from the
 * project's root. A project without the role, or whose folder does not exist yet, has none.
 */
export function listProjectProcedures(root, profile) {
  const folder = profile.paths?.procedures
  if (!folder || !existsSync(join(root, folder))) {
    return []
  }
  return listProcedures(join(root, folder)).map((procedure) => ({
    ...procedure,
    source: `${folder.replace(/\/+$/, '')}/${procedure.name}.md`
  }))
}

/**
 * The procedures of the framework and then those of the project. A name that both have is an error: a skill and a row of the reading map name one procedure,
 * so the project's own would hide the framework's or the other way round.
 */
export function listAllProcedures(root, profile, framework = listProcedures()) {
  const own = listProjectProcedures(root, profile)
  const taken = new Set(framework.map(({ name }) => name))
  const clash = own.filter(({ name }) => taken.has(name)).map(({ name }) => name)
  if (clash.length) {
    throw new Error(
      `${profile.paths.procedures}: the procedure ${clash.map((name) => `"${name}"`).join(', ')} has the name of a procedure of the framework; rename the file and its name`
    )
  }
  return [...framework, ...own]
}

// The roles a body needs outside its if and unless blocks (a role inside one is optional: the block is left out without it)
function neededRoles(body) {
  const roles = new Set()
  let depth = 0
  for (const line of body.split('\n')) {
    if (/^\s*\{\{#(?:if|unless)\s/.test(line)) depth += 1
    else if (/^\s*\{\{\/(?:if|unless)\}\}/.test(line)) depth -= 1
    else if (depth === 0) {
      for (const [, , path] of line.matchAll(/\{\{\s*(?:(link|rel):)?([\w.-]+)\s*\}\}/g)) roles.add(path)
    }
  }
  return [...roles]
}

/** The body of a procedure rendered for `profile`; `document` is the path of the file it is written into (its links are relative to it). */
export function renderProcedure(procedure, profile, document) {
  const missing = neededRoles(procedure.body).filter((path) => [undefined, null, ''].includes(valueAt(profile, path)))
  if (missing.length) {
    throw new Error(`the procedure "${procedure.name}" needs the profile roles ${missing.join(', ')}`)
  }
  return render(procedure.body, profile, { document })
}
