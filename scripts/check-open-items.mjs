// Checks the open-items register of the design (see open-items-lib.mjs): run by `npm run docs:check`.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { openItemProblems } from './open-items-lib.mjs'

const designDir = resolve(import.meta.dirname, '..', 'docs/product-knowledge/game-design')
const files = Object.fromEntries(
  readdirSync(designDir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => [name, readFileSync(join(designDir, name), 'utf8')])
)

const problems = openItemProblems(files)

if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}

console.log(`Checked the open-items register in ${Object.keys(files).length} design files.`)
