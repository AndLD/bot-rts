// Keeps the product knowledge (docs/product-knowledge) free of stack terms, plan task ids and implementation paths: those belong in
// the engineering documents, the operations guide, the testing guide and the plan. The stack terms are `terms.stack` of the profile file.
// A file may keep a term when it is part of the product: the exceptions are listed here and in the harness bindings.
const EXCLUDED = [/^archived-docs\//, /^CHANGELOG\.md$/, /^game-design\/(20-open-questions|21-backlog)\.md$/]

// Terms a file may use because they are part of the product it describes
const ALLOWED_TERMS = {
  'game-design/10-the-script-api.md': ['typescript'], // players write scripts in TypeScript
  'integrations/API.md': ['socket.io'], // the realtime transport of the public API
  'integrations/MCP.md': ['npm'] // how to build and start the MCP server
}

const PLAN_REFERENCE = /\b(?:Plan|[Tt]asks?) \d+\.\d+|\bPhase \d+\b|\(tasks? \d/
const IMPLEMENTATION_PATH = /\b(?:api|client)\/src\/|\.(?:int\.)?test\.tsx?\b|module-catalog/

const withoutCode = (text) => text.replace(/^```[\s\S]*?^```/gm, (block) => block.replace(/[^\n]/g, ''))

// `files` maps a path relative to docs/product-knowledge to its text
export function productKnowledgeProblems(files, terms) {
  const stack = new RegExp(terms.stack, 'i')
  const problems = []

  for (const [path, text] of Object.entries(files)) {
    if (EXCLUDED.some((pattern) => pattern.test(path))) {
      continue
    }
    const allowed = ALLOWED_TERMS[path] ?? []
    // The stack words may sit inside commands in a code block of a file that is allowed to show them
    const scanned = allowed.length ? text : withoutCode(text)

    scanned.split('\n').forEach((line, index) => {
      const where = `${path}:${index + 1}`
      const term = line.match(stack)?.[0]
      if (term && !allowed.includes(term.toLowerCase())) {
        problems.push(`${where}: the stack term "${term}" does not belong in the product knowledge`)
      }
      if (PLAN_REFERENCE.test(line)) {
        problems.push(`${where}: a plan task or phase reference; the plan tracks the build status`)
      }
      if (IMPLEMENTATION_PATH.test(line)) {
        problems.push(`${where}: a code path or test file; implementation notes live in the engineering documents`)
      }
    })
  }

  return problems
}
