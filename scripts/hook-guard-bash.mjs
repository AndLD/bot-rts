// Agent-runtime hook (PreToolUse on Bash): refuses a git command that would break the Git rules of AGENTS.md section 7: a commit
// or a push on a protected branch, a push to one, and the deletion of a remote branch. Input: the hook JSON on stdin. Exit code 2
// blocks the call and sends stderr to the agent.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { protectedBranches as PROTECTED } from './harness-profile.mjs'

const GIT_COMMIT = /\bgit\s+(?:-C\s+\S+\s+)?commit\b/
const GIT_PUSH = /\bgit\s+(?:-C\s+\S+\s+)?push\b/
const REMOTE_DELETE = /\bgit\s+(?:-C\s+\S+\s+)?push\b[^\n;&|]*(?:--delete\b|\s-d\b|\s\+?:[\w./-]+)/
const API_REF_DELETE = /\bgh\s+api\b[^\n;&|]*(?:-X|--method)\s+DELETE\b[^\n;&|]*\/git\/refs\//i
const PUSH_TO_PROTECTED = new RegExp(
  `\\bgit\\s+(?:-C\\s+\\S+\\s+)?push\\b[^\\n;&|]*(?:\\s|:|refs/heads/)(?:${PROTECTED.join('|')})\\b`
)

// The message that refuses the command, or null when it is allowed. `branch` is the branch checked out where the command runs.
export function refusal(command, branch) {
  if (REMOTE_DELETE.test(command) || API_REF_DELETE.test(command)) {
    return 'Never delete a remote branch: branches are kept for history (AGENTS.md section 7.3).'
  }
  if (PUSH_TO_PROTECTED.test(command)) {
    return `Never push to ${PROTECTED.join(' or ')} directly: open a pull request (AGENTS.md section 7.5).`
  }
  if ((GIT_COMMIT.test(command) || GIT_PUSH.test(command)) && PROTECTED.includes(branch)) {
    return `You are on ${branch}: create a branch named by AGENTS.md section 7.1 before you commit or push.`
  }
  return null
}

function currentBranch(directory) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: directory, encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
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
    const command = event?.tool_input?.command
    if (typeof command !== 'string') {
      return
    }
    const message = refusal(command, currentBranch(event.cwd ?? process.cwd()))
    if (message) {
      process.stderr.write(`${message}\n`)
      process.exit(2)
    }
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
