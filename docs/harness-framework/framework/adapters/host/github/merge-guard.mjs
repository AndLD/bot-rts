// The GitHub host adapter's merge guard (design §4.3, role "merge guard"), for a repository whose host cannot protect its branches
// (`host.protection: false`): nothing on the host refuses a merge while a required check is red, so the shell guard of the agent runtime does.
import { runGh } from './protect.mjs'

// Options of `gh pr merge` that take a value, so that the value is not taken for the pull request
const VALUE_OPTIONS = new Set([
  '-b',
  '--body',
  '-F',
  '--body-file',
  '-t',
  '--subject',
  '-A',
  '--author-email',
  '-R',
  '--repo',
  '--match-head-commit'
])
const WRAPPERS = new Set(['env', 'sudo', 'command', 'exec', 'time', 'nohup', 'nice'])

// The words of the command after wrapper words and variable assignments
function commandWords(words) {
  let index = 0
  while (index < words.length && (/^\w+=/.test(words[index]) || WRAPPERS.has(words[index]))) {
    index += 1
  }
  return words.slice(index)
}

/** Whether the words of a simple command are `gh pr merge …`. */
export function isMerge(words) {
  const [command, group, action] = commandWords(words)
  return command === 'gh' && group === 'pr' && action === 'merge'
}

/** The pull request a `gh pr merge` names (a number, a URL or a branch), or undefined for the one of the current branch. */
export function mergeTarget(words) {
  const args = commandWords(words).slice(3)
  for (let index = 0; index < args.length; index += 1) {
    if (VALUE_OPTIONS.has(args[index])) {
      index += 1
    } else if (!args[index].startsWith('-')) {
      return args[index]
    }
  }
  return undefined
}

/**
 * The message that refuses a merge, or null when every required check of the pull request passed (or was skipped for a documentation-only change).
 * A pull request whose checks cannot be read is refused: the guard does not guess.
 */
export function checkMerge({ words, cwd, requiredChecks, gh = (args) => runGh(args, undefined, cwd) }) {
  const target = mergeTarget(words)
  const answer = gh(['pr', 'checks', ...(target ? [target] : []), '--json', 'name,bucket'])
  let checks
  try {
    checks = JSON.parse(answer.stdout || '[]')
  } catch {
    checks = null
  }
  if (!Array.isArray(checks) || (answer.status !== 0 && answer.status !== 8)) {
    return `Cannot read the checks of ${target ?? 'this pull request'}, so the merge is refused: this repository's host cannot protect its branches, and no merge goes through while a required check is not green.`
  }
  const bucketOf = new Map(checks.map(({ name, bucket }) => [name, bucket]))
  const notGreen = requiredChecks.filter((name) => !['pass', 'skipping'].includes(bucketOf.get(name)))
  return notGreen.length
    ? `No merge while a required check is not green: ${notGreen.map((name) => `${name} (${bucketOf.get(name) ?? 'not reported'})`).join(', ')}. This repository's host cannot protect its branches, so this guard does.`
    : null
}
