// Agent-runtime hook (PreToolUse on Edit and Write): refuses an edit of an environment file. Values go to `.env.example` only
// (AGENTS.md section 1). Input: the hook JSON on stdin. Exit code 2 blocks the call and sends stderr to the agent.
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const ENV_FILE = /^\.env(\..+)?$/

// The message that refuses the edit of `path`, or null when it is allowed
export function refusal(path) {
  const name = basename(path)
  if (ENV_FILE.test(name) && name !== '.env.example') {
    return `${name} holds local values and secrets: never edit it. Add the variable to .env.example and tell the owner (AGENTS.md section 1).`
  }
  return null
}

function main() {
  let input = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk) => (input += chunk))
  process.stdin.on('end', () => {
    let event
    try {
      event = JSON.parse(input)
    } catch {
      return
    }
    const path = event?.tool_input?.file_path
    const message = typeof path === 'string' ? refusal(path) : null
    if (message) {
      process.stderr.write(`${message}\n`)
      process.exit(2)
    }
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
