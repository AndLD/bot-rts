// `harness check product-knowledge`: the method's DOMAIN rules (design §3.4). The product knowledge names no stack term, plan task or
// implementation path; the specification has one glossary (glossary.mjs) and a register of open items (open-items.mjs). Every file name and
// exception is the project's: `productKnowledge` of the profile file.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { glossaryProblems } from './glossary.mjs'
import { claims } from './layers.mjs'
import { blankFences } from './markdown.mjs'
import { openItemProblems } from './open-items.mjs'
import { walk } from './tree.mjs'

// The plan's own vocabulary (phases and tasks with their ids), which the method keeps out of the product knowledge
const PLAN_REFERENCE = /\b(?:Plan|[Tt]asks?) \d+\.\d+|\bPhase \d+\b|\(tasks? \d/

/**
 * The problems of the product knowledge. `files` maps a path relative to the product-knowledge folder to its text; `terms.stack` is the
 * stack terms of the profile. Options: `excluded` (globs of files that are not scanned: history, the register, the backlog), `allowedTerms`
 * (a path and the stack terms that are part of the product there), `implementationPattern` (a regular expression of the project's code paths).
 */
export function productKnowledgeProblems(
  files,
  terms,
  { excluded = [], allowedTerms = {}, implementationPattern } = {}
) {
  const stack = new RegExp(terms.stack, 'i')
  const implementation = implementationPattern ? new RegExp(implementationPattern) : null
  const problems = []

  for (const [path, text] of Object.entries(files)) {
    if (excluded.length && claims(excluded, path)) {
      continue
    }
    const allowed = (allowedTerms[path] ?? []).map((term) => term.toLowerCase())
    // The stack words may sit inside commands in a code block of a file that is allowed to show them
    const scanned = allowed.length ? text : blankFences(text)

    scanned.split('\n').forEach((line, index) => {
      const where = `${path}:${index + 1}`
      const term = line.match(stack)?.[0]
      if (term && !allowed.includes(term.toLowerCase())) {
        problems.push(`${where}: the stack term "${term}" does not belong in the product knowledge`)
      }
      if (PLAN_REFERENCE.test(line)) {
        problems.push(`${where}: a plan task or phase reference; the plan tracks the build status`)
      }
      if (implementation?.test(line)) {
        problems.push(`${where}: a code path or test file; implementation notes live in the engineering documents`)
      }
    })
  }

  return problems
}

const markdownOf = (dir) =>
  Object.fromEntries(
    readdirSync(dir)
      .filter((name) => name.endsWith('.md'))
      .map((name) => [name, readFileSync(join(dir, name), 'utf8')])
  )

/**
 * `harness check product-knowledge`: the glossary, the register of open items and the scan of the product knowledge.
 * @returns {{ problems: string[], messages: string[] }}
 */
export function checkProductKnowledge({ root, profile }) {
  const knowledge = profile.productKnowledge
  if (!knowledge) {
    return {
      problems: [],
      messages: ['The profile file has no `productKnowledge`, so there is no product knowledge to check.']
    }
  }
  const problems = []
  const messages = []

  const specification = markdownOf(join(root, knowledge.specification))
  const count = Object.keys(specification).length
  problems.push(
    ...openItemProblems(specification, {
      register: knowledge.register,
      backlog: knowledge.backlog,
      backlogSection: knowledge.backlogSection
    }),
    ...glossaryProblems(specification, {
      glossary: knowledge.glossary,
      skipped: [knowledge.register, knowledge.backlog]
    })
  )
  messages.push(
    `Checked the open-items register in ${count} specification files.`,
    `Checked the glossary against ${count} specification files.`
  )

  const paths = walk(join(root, knowledge.root)).filter((path) => path.endsWith('.md'))
  const files = Object.fromEntries(paths.map((path) => [path, readFileSync(join(root, knowledge.root, path), 'utf8')]))
  problems.push(
    ...productKnowledgeProblems(files, profile.terms, {
      excluded: knowledge.excluded,
      allowedTerms: knowledge.allowedTerms,
      implementationPattern: knowledge.implementationPattern
    })
  )
  messages.push(`Checked the product knowledge in ${paths.length} files.`)

  return { problems, messages }
}
