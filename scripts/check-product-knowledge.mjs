// Checks docs/product-knowledge for stack terms, plan task ids and implementation paths (see product-knowledge-lib.mjs): run by
// `npm run docs:check`.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { productKnowledgeProblems } from './product-knowledge-lib.mjs'

const root = resolve(import.meta.dirname, '..')
const base = 'docs/product-knowledge'
const listed = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', `${base}/*.md`, `${base}/**/*.md`],
  {
    cwd: root,
    encoding: 'utf8'
  }
)
const paths = [...new Set(listed.split('\n').filter(Boolean))]
const files = Object.fromEntries(
  paths.map((path) => [path.slice(base.length + 1), readFileSync(join(root, path), 'utf8')])
)

const problems = productKnowledgeProblems(files, readFileSync(join(root, 'docs/profile.md'), 'utf8'))

if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}

console.log(`Checked the product knowledge in ${paths.length} files.`)
