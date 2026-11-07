// `harness check markers` (issue I-7): no tracked Markdown or JSON file holds the line of a merge conflict that was committed unresolved. A marker is a line that
// starts with 7 or more `<` or `>` characters followed by a space or the end of the line (Git's own are 7, and a merge of merge bases writes more, as 8). The line of
// `=` characters is not a marker alone: a Markdown heading is underlined with it.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { VENDOR_DIR } from './lock.mjs'

const MARKER = /^(?:<{7,}|>{7,})(?: |$)/
const TRACKED = ['*.md', '*.json']

/** The 1-based numbers of the lines of `text` that are conflict markers. */
export function markerLines(text) {
  return text.split('\n').flatMap((line, index) => (MARKER.test(line) ? [index + 1] : []))
}

/** The check: `{ problems, message }` for the tracked Markdown and JSON files of `root`, the vendored copy aside. */
export function checkMarkers({ root }) {
  const files = execFileSync('git', ['ls-files', ...TRACKED], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter((file) => file && !file.startsWith(`${VENDOR_DIR}/`))
  const problems = []
  for (const file of files) {
    let text
    try {
      text = readFileSync(join(root, file), 'utf8')
    } catch {
      continue // listed by Git and deleted in the working tree
    }
    const lines = markerLines(text)
    if (lines.length) {
      problems.push(
        `${file}: merge conflict marker at line ${lines.join(', ')}: resolve the conflict and remove the markers`
      )
    }
  }
  return { problems, message: `Checked ${files.length} Markdown and JSON files for merge conflict markers.` }
}
