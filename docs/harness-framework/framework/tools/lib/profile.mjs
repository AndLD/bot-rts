// The profile file (`harness-profile.json`, design §7.2): its reader with the defaults of the schema, the lookup that `harness profile get`
// prints, and the validation against the schema (`harness check profile`). The schema is a subset of JSON Schema that this file implements:
// type, enum, pattern, required, properties, additionalProperties, items and minItems, with `default` filled in by the reader.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const PROFILE_FILE = 'harness-profile.json'
export const SCHEMA_PATH = join(import.meta.dirname, '..', '..', 'profile', 'harness-profile.schema.json')

export const readSchema = (path = SCHEMA_PATH) => JSON.parse(readFileSync(path, 'utf8'))

/** The profile file of `root` with the defaults of the schema filled in; `{}` when the project has none. */
export function loadProfile(root, schema = readSchema()) {
  const path = join(root, PROFILE_FILE)
  return existsSync(path) ? withDefaults(schema, JSON.parse(readFileSync(path, 'utf8'))) : {}
}

/** `value` with the `default` of every property of an object schema that it lacks; the input is not changed. */
export function withDefaults(schema, value) {
  if (schema.type !== 'object' || value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value
  }
  const result = { ...value }
  for (const [key, property] of Object.entries(schema.properties ?? {})) {
    if (result[key] === undefined && property.default !== undefined) {
      result[key] = structuredClone(property.default)
    }
    if (result[key] !== undefined) {
      result[key] = withDefaults(property, result[key])
    }
  }
  return result
}

/** The value at a dotted path such as `branches.integration`; an unknown path is an error. */
export function lookup(profile, path) {
  const value = path.split('.').reduce((node, key) => node?.[key], profile)
  if (value === undefined) {
    throw new Error(`The harness profile has no value "${path}"`)
  }
  return value
}

const typeOf = (value) => (Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value)
const matches = (type, value) =>
  type === 'integer' ? Number.isInteger(value) : type === 'number' ? typeof value === 'number' : typeOf(value) === type

/** The problems of `value` against `schema`, each as `<path>: <what is wrong>`; empty when the value is valid. */
export function validate(schema, value, path = '') {
  const where = path || '(the profile file)'
  const problems = []

  if (schema.type && !matches(schema.type, value)) {
    return [`${where}: expected ${schema.type}, found ${typeOf(value)}`]
  }
  if (schema.enum && !schema.enum.includes(value)) {
    problems.push(`${where}: must be one of ${schema.enum.join(', ')}`)
  }
  if (schema.pattern && typeof value === 'string' && !new RegExp(schema.pattern).test(value)) {
    problems.push(`${where}: "${value}" does not match ${schema.pattern}`)
  }
  if (schema.type === 'array') {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      problems.push(`${where}: needs at least ${schema.minItems} item(s)`)
    }
    if (schema.items) {
      value.forEach((item, index) => problems.push(...validate(schema.items, item, `${path}[${index}]`)))
    }
  }
  if (schema.type === 'object') {
    const properties = schema.properties ?? {}
    for (const key of schema.required ?? []) {
      if (value[key] === undefined) {
        problems.push(`${path ? `${path}.` : ''}${key}: required, and missing`)
      }
    }
    for (const [key, item] of Object.entries(value)) {
      const child = path ? `${path}.${key}` : key
      if (properties[key]) {
        problems.push(...validate(properties[key], item, child))
      } else if (schema.additionalProperties === false) {
        problems.push(`${child}: not a role of the schema`)
      } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        problems.push(...validate(schema.additionalProperties, item, child))
      }
    }
  }
  return problems
}

/**
 * `harness check profile`: the profile file of `root` against the schema, and the rules the subset cannot say: a stack entry is a name or an
 * object with an adapter name, and the document the profile document is generated into is not the profile file itself.
 * @returns {string[]} the problems
 */
export function checkProfile(root, schema = readSchema()) {
  const path = join(root, PROFILE_FILE)
  if (!existsSync(path)) {
    return [`${PROFILE_FILE}: the project has no profile file`]
  }
  let parsed
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    return [`${PROFILE_FILE}: not valid JSON (${error.message})`]
  }

  const profile = withDefaults(schema, parsed)
  const problems = validate(schema, profile).map((problem) => `${PROFILE_FILE}: ${problem}`)
  ;(profile.adapters?.stacks ?? []).forEach((entry, index) => {
    const name = typeof entry === 'string' ? entry : entry?.adapter
    if (typeof name !== 'string' || !name) {
      problems.push(`${PROFILE_FILE}: adapters.stacks[${index}]: a stack is a name or an object with an "adapter" name`)
    }
  })
  if (profile.paths?.profileDocument === profile.paths?.profileFile) {
    problems.push(`${PROFILE_FILE}: paths.profileDocument must not be the profile file itself`)
  }
  return problems
}
