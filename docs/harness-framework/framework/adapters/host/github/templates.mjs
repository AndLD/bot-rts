// Renders a workflow template of this adapter. A workflow is full of `${{ … }}` expressions, which the Markdown renderer would take for its own
// placeholders, so a template here marks its values `<%= path %>`; the value at the path of the context is written as it is, a list joined with
// `, `, and a path with no value is an error (a workflow with a hole in it would be wrong silently).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inFramework } from '../../../tools/lib/lock.mjs'

export const TEMPLATES_DIR = join(import.meta.dirname, 'templates')
// The types of the Conventional Commits that the pull-request title check accepts
export const COMMIT_TYPES = 'feat|fix|refactor|test|docs|chore|perf|ci'

const MARK = /<%=\s*([\w.-]+)\s*%>/g

const valueAt = (context, path) => path.split('.').reduce((node, key) => node?.[key], context)

/** The text of `template` with every `<%= path %>` filled from `context`. */
export function renderTemplate(template, context) {
  return template.replace(MARK, (_, path) => {
    const value = valueAt(context, path)
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
      throw new Error(`the workflow template needs a value for "${path}"`)
    }
    return Array.isArray(value) ? value.join(', ') : String(value)
  })
}

/**
 * The context a template is rendered with: the profile file plus what the stack adapter contributes (`jobs`: the ids of its jobs, which the
 * aggregator needs; `checkoutSetup`: nothing yet).
 */
export function templateContext(profile, { jobs = [] } = {}) {
  return {
    ...profile,
    commitTypes: COMMIT_TYPES,
    jobs,
    versionFile: profile.release?.versionFiles?.[0],
    harness: inFramework(profile, 'tools/harness.mjs')
  }
}

/** A workflow template of this adapter, rendered. */
export function renderWorkflow(name, profile, options) {
  return renderTemplate(readFileSync(join(TEMPLATES_DIR, name), 'utf8'), templateContext(profile, options))
}
