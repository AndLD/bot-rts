// Agent-runtime hook (PostToolUse on Edit and Write): formats the edited file with Prettier, so that the format check of CI never
// fails on it. Input: the hook JSON on stdin. It never blocks: a file Prettier does not handle or cannot parse is left as it is.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const FORMATTED = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.css', '.yml', '.yaml'])
const IGNORED_DIRECTORIES = ['node_modules', '.next', 'ts-built', 'coverage']

// Whether Prettier should format this path
export function isFormatted(path) {
  const parts = path.split('/')
  return FORMATTED.has(extname(path)) && !IGNORED_DIRECTORIES.some((directory) => parts.includes(directory))
}

function main() {
  let input = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk) => (input += chunk))
  process.stdin.on('end', () => {
    try {
      const event = JSON.parse(input)
      const path = event?.tool_input?.file_path
      if (typeof path !== 'string' || !isFormatted(path) || !existsSync(path)) {
        return
      }
      const root = resolve(event.cwd ?? process.cwd())
      execFileSync('npx', ['prettier', '--config', '.prettierrc.json', '--write', path], { cwd: root, stdio: 'ignore' })
    } catch {
      // Formatting is a convenience; the format check of the lint run is the guarantee
    }
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
