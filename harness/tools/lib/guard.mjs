// The shell guard of the agent runtime (design §7.3, `guard-shell`): refuses a command that would break the Git rules of the entry file: a commit or a
// push on a protected branch, a push to one, the deletion of a remote branch, `--no-verify` (the owner's), and, on a host that cannot protect its
// branches, a merge while a required check is not green. It looks at the commands that would run, not at text: a protected pattern inside a quoted
// string or a heredoc is data and is allowed.

const SHELLS = new Set(['bash', 'sh', 'zsh'])
const WRAPPERS = new Set(['env', 'sudo', 'command', 'exec', 'time', 'nohup', 'nice'])
const SEPARATORS = new Set([';', '&', '|', '(', ')', '\n'])
const GIT_VALUE_OPTIONS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace'])
const NEW_BRANCH_FLAGS = { checkout: ['-b', '-B', '--orphan'], switch: ['-c', '-C', '--create', '--force-create'] }

// The simple commands of a shell command line, each as its words with the quotes removed. Text inside quotes and heredoc bodies is
// data: it never starts a command, so printing `git push origin main` into a file is one command (the printer), not a push. A command
// substitution inside double quotes is not looked into.
export function simpleCommands(line) {
  const commands = []
  let words = []
  let word = null
  const heredocs = []

  const endWord = () => {
    if (word !== null) {
      words.push(word)
      word = null
    }
  }
  const endCommand = () => {
    endWord()
    if (words.length) {
      commands.push(words)
    }
    words = []
  }

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '\\') {
      if (line[i + 1] === '\n') {
        endWord()
      } else {
        word = (word ?? '') + (line[i + 1] ?? '')
      }
      i += 1
    } else if (char === "'" || char === '"') {
      const close = line.indexOf(char, i + 1)
      const stop = close < 0 ? line.length : close
      word = (word ?? '') + line.slice(i + 1, stop)
      i = stop
    } else if (char === '<' && line[i + 1] === '<' && line[i + 2] !== '<') {
      const tag = line.slice(i + 2).match(/^-?\s*(['"]?)([\w-]+)\1/)
      if (tag) {
        heredocs.push(tag[2])
        i += 1 + tag[0].length
        endWord()
      }
    } else if (SEPARATORS.has(char)) {
      endCommand()
      if (char === '\n') {
        for (const delimiter of heredocs.splice(0)) {
          const lines = line.slice(i + 1).split('\n')
          const end = lines.findIndex((text) => text.trim() === delimiter)
          i += 1 + lines.slice(0, end < 0 ? lines.length : end + 1).join('\n').length
        }
      }
    } else if (/\s/.test(char)) {
      endWord()
    } else {
      word = (word ?? '') + char
    }
  }
  endCommand()
  return commands
}

// The git subcommand with its arguments, or null when the words are not a git command (wrapper words and variable assignments skipped)
function gitCommand(words) {
  let index = 0
  while (index < words.length && (/^\w+=/.test(words[index]) || WRAPPERS.has(words[index]))) {
    index += 1
  }
  if (words[index] !== 'git') {
    return null
  }
  index += 1
  while (index < words.length && words[index].startsWith('-')) {
    index += GIT_VALUE_OPTIONS.has(words[index]) ? 2 : 1
  }
  return words[index] ? { subcommand: words[index], args: words.slice(index + 1) } : null
}

// The branch a refspec writes to: `HEAD:refs/heads/topic` -> topic, `feature` -> feature, `:old` -> old (a deletion)
function destination(refspec) {
  return refspec
    .replace(/^\+/, '')
    .split(':')
    .at(-1)
    .replace(/^refs\/heads\//, '')
}

// A `gh api` call that deletes a ref
function isRefDeletion(words) {
  const [command, subcommand, ...args] = words
  if (command !== 'gh' || subcommand !== 'api') {
    return false
  }
  const isDelete = args.some(
    (arg, index) =>
      /^-X\s*DELETE$/i.test(arg) ||
      /^--method=DELETE$/i.test(arg) ||
      (/^(?:-X|--method)$/.test(arg) && /^DELETE$/i.test(args[index + 1] ?? ''))
  )
  return isDelete && args.some((arg) => arg.includes('/git/refs/'))
}

// The command line that a shell or `eval` runs from its arguments, or null
function nestedCommand(words) {
  if (words[0] === 'eval') {
    return words.slice(1).join(' ')
  }
  const flag = SHELLS.has(words[0]) ? words.findIndex((word) => /^-[a-z]*c$/.test(word)) : -1
  return flag >= 0 ? (words[flag + 1] ?? '') : null
}

const DELETE_MESSAGE =
  'Never delete a remote branch: branches are kept for history (the Git rules of the entry file, branch retention).'
const NO_VERIFY_MESSAGE =
  "`--no-verify` skips the Git hooks that hold the rules of the entry file. It is the owner's, for an emergency, and is recorded in the log of the task; " +
  'when a hook fails, fix what it reports, or stop and say what blocks the push.'

/**
 * The message that refuses the command, or null when it is allowed. `branch` is the branch checked out where the command runs; a
 * `git checkout -b` or `git switch -c` earlier in the same command line moves it to the new branch.
 * @param {string} command the shell command line
 * @param {string} branch the current branch
 * @param {{ protectedBranches: string[], merge?: { isMerge: (words: string[]) => boolean, check: (words: string[]) => string | null } }} options
 *   `merge` is the merge guard of a host that cannot protect its branches: `check` returns the message that refuses the merge, or null
 */
export function refusal(command, branch, { protectedBranches: PROTECTED, merge } = { protectedBranches: [] }) {
  let current = branch
  for (const words of simpleCommands(command)) {
    const nested = nestedCommand(words)
    const inner = nested === null ? null : refusal(nested, current, { protectedBranches: PROTECTED, merge })
    if (inner) {
      return inner
    }
    if (isRefDeletion(words)) {
      return DELETE_MESSAGE
    }
    if (merge?.isMerge(words)) {
      const message = merge.check(words)
      if (message) {
        return message
      }
    }
    const git = gitCommand(words)
    if (!git) {
      continue
    }
    if (git.subcommand === 'push' && git.args.includes('--no-verify')) {
      return NO_VERIFY_MESSAGE
    }
    if (
      git.subcommand === 'commit' &&
      git.args.some((arg) => arg === '--no-verify' || /^-[a-zA-Z]*n[a-zA-Z]*$/.test(arg))
    ) {
      return NO_VERIFY_MESSAGE
    }
    const operands = git.args.filter((arg) => !arg.startsWith('-'))

    if (git.subcommand === 'push') {
      if (git.args.some((arg) => arg === '--delete' || arg === '-d') || operands.some((arg) => /^\+?:./.test(arg))) {
        return DELETE_MESSAGE
      }
      if (operands.some((arg) => PROTECTED.includes(destination(arg)))) {
        return `Never push to ${PROTECTED.join(' or ')} directly: open a pull request (the Git rules of the entry file).`
      }
    }
    if ((git.subcommand === 'commit' || git.subcommand === 'push') && PROTECTED.includes(current)) {
      return `You are on ${current}: create a branch named by the Git rules of the entry file (branches) before you commit or push.`
    }
    const flags = NEW_BRANCH_FLAGS[git.subcommand] ?? []
    const flag = git.args.findIndex((arg) => flags.includes(arg))
    if (flag >= 0 && git.args[flag + 1]) {
      current = git.args[flag + 1]
    } else if (flags.length) {
      current = operands.find((operand) => PROTECTED.includes(operand)) ?? current
    }
  }
  return null
}
