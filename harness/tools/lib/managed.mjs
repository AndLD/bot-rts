// Managed blocks (design §6.3): a generated region inside a file that the project otherwise owns, such as the layer map in the harness
// bindings. The region sits between two marker comments, and the lock keeps the hash of the region alone, so the text around it is free.
import { sha256 } from './tree.mjs'

export const markers = (id) => ({ start: `<!-- harness:begin ${id} -->`, end: `<!-- harness:end ${id} -->` })

function locate(text, id) {
  const { start, end } = markers(id)
  const from = text.indexOf(start)
  const to = text.indexOf(end)
  if (from === -1 || to === -1 || to < from || text.indexOf(start, from + 1) !== -1) {
    return null
  }
  return { from: from + start.length, to }
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

/** The hash the lock keeps of a block: the SHA-256 of its content. */
export const hashBlock = (content) => sha256(content)
