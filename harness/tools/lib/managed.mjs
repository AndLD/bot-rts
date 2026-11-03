// Managed blocks (design §6.3): a generated region inside a file that the project otherwise owns, such as the layer map in the harness
// bindings. The region sits between two marker comments, and the lock keeps the hash of the region alone, so the text around it is free.
// The markers are HTML comments, or `#` lines in a file of patterns (an ignore file), where an HTML comment would be a pattern; a file's markers say which.
import { sha256 } from './tree.mjs'

export const markers = (id) => ({ start: `<!-- harness:begin ${id} -->`, end: `<!-- harness:end ${id} -->` })
export const hashMarkers = (id) => ({ start: `# harness:begin ${id}`, end: `# harness:end ${id}` })

function locate(text, id) {
  for (const { start, end } of [markers(id), hashMarkers(id)]) {
    const from = text.indexOf(start)
    const to = text.indexOf(end)
    if (from !== -1 && to !== -1 && to >= from && text.indexOf(start, from + 1) === -1) {
      return { from: from + start.length, to }
    }
  }
  return null
}

/** The content between the markers of block `id` (without the line breaks next to them), or null when the markers are missing or doubled. */
export function extractBlock(text, id) {
  const place = locate(text, id)
  return place ? text.slice(place.from, place.to).replace(/^\n/, '').replace(/\n$/, '') : null
}

/** `text` with the content of block `id` replaced by `content`; fails when the file lacks the markers, so a block is never added by guesswork. */
export function replaceBlock(text, id, content) {
  const place = locate(text, id)
  if (!place) {
    const { start, end } = markers(id)
    throw new Error(`the markers ${start} and ${end} are missing, or doubled`)
  }
  return `${text.slice(0, place.from)}\n${content}\n${text.slice(place.to)}`
}

/**
 * `text` with block `id` added at its end, between `#` markers: for a file of patterns that the project owns and that has no such block yet (its own
 * lines stay as they are). A file that has the markers is refused; `replaceBlock` is the way to change a block.
 */
export function appendBlock(text, id, content) {
  if (locate(text, id)) {
    throw new Error(`the block ${id} is there already`)
  }
  const { start, end } = hashMarkers(id)
  const lines = [start, ...(content ? [content] : []), end]
  return `${text.replace(/\n*$/, text ? '\n\n' : '')}${lines.join('\n')}\n`
}

/** The hash the lock keeps of a block: the SHA-256 of its content. */
export const hashBlock = (content) => sha256(content)
