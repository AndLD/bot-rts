// The machine-readable part of the project profile (docs/profile.md): the values that the harness scripts and hooks need, read from
// scripts/harness-profile.json so that each of them lives once. In a shell script:  node scripts/harness-profile.mjs get <dotted.path>
// (a list is printed one item per line).
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = resolve(import.meta.dirname, '..')

export function readHarnessProfile() {
  return JSON.parse(readFileSync(join(root, 'scripts', 'harness-profile.json'), 'utf8'))
}

// The value at a dotted path such as `branches.integration`; an unknown path is an error
export function lookup(profile, path) {
  const value = path.split('.').reduce((node, key) => node?.[key], profile)
  if (value === undefined) {
    throw new Error(`The harness profile has no value "${path}"`)
  }
  return value
}

export const profile = readHarnessProfile()
export const protectedBranches = [profile.branches.production, profile.branches.integration]

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, path] = process.argv.slice(2)
  if (command !== 'get' || !path) {
    console.error('Usage: node scripts/harness-profile.mjs get <dotted.path>')
    process.exit(2)
  }
  try {
    const value = lookup(profile, path)
    console.log(Array.isArray(value) ? value.join('\n') : value)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
