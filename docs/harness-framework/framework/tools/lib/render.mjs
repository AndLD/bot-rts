// The template engine of the generated documents (design §7.2): `profile/roles.md` is a Markdown template whose placeholders are filled from
// the profile file. It has four constructs, all resolved against a context object:
//   {{a.b}}         the value at a dotted path (an array is joined with ", "; an object is an error)
//   {{link:a.b}}    a Markdown link to the path that the value names, written relative to the generated document
//   {{rel:a.b}}     that relative path alone
//   {{#if a.b}} … {{/if}} and {{#each a.b}} … {{/each}}    blocks, each tag alone on its line; inside `each`, the fields of the item come first
// A line with a placeholder that has no value is left out, so an optional role needs no block of its own. A value may hold placeholders too
// (prose that cites another role); they are resolved against the same context.
import { posix } from 'node:path'

const PLACEHOLDER = /\{\{\s*(?:(link|rel):)?([\w.-]+)\s*\}\}/g
const BLOCK_OPEN = /^\s*\{\{#(if|each)\s+([\w.-]+)\s*\}\}\s*$/
const BLOCK_CLOSE = /^\s*\{\{\/(if|each)\}\}\s*$/
const MAX_DEPTH = 5

/** The value at a dotted path of `context`, or undefined. */
export function valueAt(context, path) {
  return path
    .split('.')
    .reduce((node, key) => (node !== null && typeof node === 'object' ? node[key] : undefined), context)
}

const isEmpty = (value) =>
  value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)

/** The path `target` (relative to the repository root) as it is written from the directory of the document at `document`. */
export function relativeTo(document, target) {
  const relative = posix.relative(posix.dirname(document), target)
  return relative.startsWith('.') ? relative : `./${relative}`
}

// The text of one value; a string that holds placeholders is rendered first
function text(value, path, context, options, depth) {
  if (Array.isArray(value)) {
    return value.map((item) => text(item, path, context, options, depth)).join(', ')
  }
  if (value !== null && typeof value === 'object') {
    throw new Error(`the value of "${path}" is a structure, not text: use a block or a more specific path`)
  }
  return typeof value === 'string' ? fill(value, context, options, depth + 1).text : String(value)
}

// One line: its placeholders filled, or `null` when one has no value
function fill(line, context, options, depth = 0) {
  if (depth > MAX_DEPTH) {
    throw new Error(`placeholders nest deeper than ${MAX_DEPTH} levels in "${line.slice(0, 60)}"`)
  }
  let missing = false
  const filled = line.replace(PLACEHOLDER, (_, kind, path) => {
    const value = valueAt(context, path)
    if (isEmpty(value)) {
      missing = true
      return ''
    }
    if (kind) {
      if (typeof value !== 'string') {
        throw new Error(`"${path}" is not a path, so {{${kind}:${path}}} cannot use it`)
      }
      const relative = relativeTo(options.document, value)
      return kind === 'rel' ? relative : `[\`${relative.replace(/^(\.\.\/)+|^\.\//, '')}\`](${relative})`
    }
    return text(value, path, context, options, depth)
  })
  return { text: filled, missing }
}

function renderLines(lines, context, options) {
  const out = []
  for (let index = 0; index < lines.length; index += 1) {
    const open = lines[index].match(BLOCK_OPEN)
    if (!open) {
      if (BLOCK_CLOSE.test(lines[index])) {
        throw new Error(`a closing tag without an opening one: ${lines[index].trim()}`)
      }
      const { text: line, missing } = fill(lines[index], context, options)
      if (!missing) {
        out.push(line)
      }
      continue
    }
    let depth = 1
    let end = index + 1
    for (; end < lines.length && depth > 0; end += 1) {
      depth += BLOCK_OPEN.test(lines[end]) ? 1 : BLOCK_CLOSE.test(lines[end]) ? -1 : 0
    }
    if (depth > 0) {
      throw new Error(`the block "${lines[index].trim()}" is never closed`)
    }
    const body = lines.slice(index + 1, end - 1)
    const [, kind, path] = open
    const value = valueAt(context, path)
    if (kind === 'if' && !isEmpty(value) && value !== false) {
      out.push(...renderLines(body, context, options))
    } else if (kind === 'each' && Array.isArray(value)) {
      for (const item of value) {
        out.push(...renderLines(body, { ...context, ...(typeof item === 'object' ? item : { item }) }, options))
      }
    }
    index = end - 1
  }
  return out
}

/**
 * Renders `template` against `context`.
 * @param {{ document: string }} options `document` is the path of the generated document relative to the repository root
 */
export function render(template, context, options) {
  return renderLines(template.split('\n'), context, options).join('\n')
}

/** The placeholder paths a template uses (for the framework's own consistency test). */
export function placeholderPaths(template) {
  const paths = new Set()
  for (const line of template.split('\n')) {
    const open = line.match(BLOCK_OPEN)
    if (open) {
      paths.add(open[2])
    }
    for (const [, , path] of line.matchAll(PLACEHOLDER)) {
      paths.add(path)
    }
  }
  return [...paths]
}
