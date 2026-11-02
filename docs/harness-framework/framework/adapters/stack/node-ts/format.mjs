// The node-ts stack's formatter (design §4.1, role "formatter"): how to format one edited file with Prettier from the project's own installation
// (`--no-install`, never downloaded), and which files it handles. Used by the format hook of the agent runtime.
import { extname } from 'node:path'

const FORMATTED = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.css', '.yml', '.yaml'])
const IGNORED_DIRECTORIES = ['node_modules', '.next', 'ts-built', 'coverage', 'dist']

/** Whether Prettier should format this path (relative to the project root). */
export function isFormatted(path) {
  return FORMATTED.has(extname(path)) && !path.split('/').some((part) => IGNORED_DIRECTORIES.includes(part))
}

/** The command that formats `path`, or null when the stack does not format it. */
export function formatCommand({ path }) {
  return isFormatted(path) ? { command: 'npx', args: ['--no-install', 'prettier', '--write', path] } : null
}
