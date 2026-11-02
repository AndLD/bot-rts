// The Claude Code preset's files of a new project (design §6.3, role "scaffold-files"): `CLAUDE.md`, which imports the entry file, and
// `.claude/settings.json` with the hook entries and the read exclusions (settings.mjs). Written once by the bootstrap; `harness check scaffold`
// then holds the invariants of the settings.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SETTINGS_PATH, settingsFor } from './settings.mjs'

const POINTER = join(import.meta.dirname, 'templates', 'CLAUDE.md')
const TEMPLATE_ENTRY = 'AGENTS.md'

/** The files, `{ path, content }`, or `{ path, lines }` for a file that several adapters add lines to. */
export function scaffoldFiles(profile) {
  const entry = profile.paths?.entryFile ?? TEMPLATE_ENTRY
  return [
    { path: 'CLAUDE.md', content: readFileSync(POINTER, 'utf8').replace(`@${TEMPLATE_ENTRY}`, `@${entry}`) },
    { path: SETTINGS_PATH, content: `${JSON.stringify(settingsFor(profile), null, 2)}\n` },
    { path: '.gitignore', lines: ['.claude/settings.local.json'] }
  ]
}
