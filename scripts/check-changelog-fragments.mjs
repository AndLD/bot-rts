// Checks the changelog fragments (docs/product-knowledge/changelog.d): each one starts with a Keep a Changelog kind. Run by
// `npm run docs:check`.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseFragment } from './release-lib.mjs'

const directory = resolve(import.meta.dirname, '..', 'docs/product-knowledge/changelog.d')
const names = readdirSync(directory).filter((name) => name.endsWith('.md') && name !== 'README.md')
const problems = []

for (const name of names) {
  try {
    parseFragment(name, readFileSync(join(directory, name), 'utf8'))
  } catch (error) {
    problems.push(error.message)
  }
}

if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}

console.log(`Checked ${names.length} changelog fragments.`)
