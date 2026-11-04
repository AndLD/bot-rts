// The shell guard of the agent runtime (design §7.3, `guard-shell`): refuses a command that would break the Git rules of the entry file: a commit or a
// push on a protected branch, a push to one, the deletion of a remote branch, `--no-verify` (the owner's), and, on a host that cannot protect its
// branches, a merge while a required check is not green. It looks at the commands that would run, not at text: a protected pattern inside a quoted
// string or a heredoc is data and is allowed.
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const SHELLS = new Set(['bash', 'sh', 'zsh'])
const WRAPPERS = new Set(['env', 'sudo', 'command', 'exec', 'time', 'nohup', 'nice'])
const SEPARATORS = new Set([';', '&', '|', '(', ')', '\n'])
const GIT_VALUE_OPTIONS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace'])
const NEW_BRANCH_FLAGS = { checkout: ['-b', '-B', '--orphan'], switch: ['-c', '-C', '--create', '--force-create'] }

// The simple commands of a shell command line, each as its words with the quotes removed. Text inside quotes and heredoc bodies is
// data: it never starts a command, so printing `git push origin main` into a file is one command (the printer), not a push. A command
// substitution inside double quotes is not looked into.
export const simpleCommands = (line) => scopedCommands(line).map(({ words }) => words)

// The same commands with the depth of the parentheses they stand in (`{ words, depth }`): a `cd` inside a subshell ends with it
function scopedCommands(line) {
  const commands = []
  let depth = 0
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
      commands.push({ words, depth })
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
      depth = Math.max(0, depth + (char === '(' ? 1 : char === ')' ? -1 : 0))
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

// The git subcommand with its arguments, and the repository it names (`-C` paths in order, `--git-dir`, `--work-tree`, or the variables
// GIT_DIR and GIT_WORK_TREE); null when the words are not a git command (wrapper words and variable assignments skipped)
function gitCommand(words) {
  let index = 0
  const repo = { dirs: [], gitDir: null, workTree: null }
  while (index < words.length && (/^\w+=/.test(words[index]) || WRAPPERS.has(words[index]))) {
    const variable = words[index].match(/^(GIT_DIR|GIT_WORK_TREE)=(.*)$/)
    if (variable) {
      repo[variable[1] === 'GIT_DIR' ? 'gitDir' : 'workTree'] = variable[2]
    }
    index += 1
  }
  if (words[index] !== 'git') {
    return null
  }
  index += 1
  while (index < words.length && words[index].startsWith('-')) {
    const option = words[index]
    const value = GIT_VALUE_OPTIONS.has(option) ? (words[index + 1] ?? '') : option.split(/=(.*)/s)[1]
    if (option === '-C') {
      repo.dirs.push(value)
    } else if (option.startsWith('--git-dir')) {
      repo.gitDir = value
    } else if (option.startsWith('--work-tree')) {
      repo.workTree = value
    }
    index += GIT_VALUE_OPTIONS.has(option) ? 2 : 1
  }
  return words[index] ? { subcommand: words[index], args: words.slice(index + 1), repo } : null
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

const PROJECT = 'project'

// The directory a path reaches from `dir`, or null when it cannot be told (an unknown directory, a variable, a pattern, `cd -`)
function reach(dir, path) {
  if (dir === null || path === undefined || /[$`*?[{]|^-$/.test(path)) {
    return null
  }
  const expanded = path === '~' || path.startsWith('~/') ? join(homedir(), path.slice(1)) : path
  return resolve(dir, expanded)
}

// The directory after a `cd`, `pushd` or `popd` (null when unknown); other commands leave it
function afterCd(dir, words) {
  if (words[0] === 'popd') {
    return null
  }
  if (words[0] !== 'cd' && words[0] !== 'pushd') {
    return dir
  }
  const operands = words.slice(1).filter((word) => !word.startsWith('-') || word === '-')
  return operands.length ? reach(dir, operands[0]) : words[0] === 'cd' ? homedir() : null
}

/**
 * The message that refuses the command, or null when it is allowed. `branch` is the branch checked out where the command runs; a
 * `git checkout -b` or `git switch -c` earlier in the same command line moves it to the new branch.
 *
 * With `branchOf` and `cwd`, a Git command is judged by the repository it acts on: the directory after the `cd` before it, `-C`, `--git-dir`
 * (`--work-tree` alone and the variables of Git too), not by `branch`. A repository that cannot be resolved (no `branchOf` answer, an unknown
 * directory) is judged as if it were on a protected branch.
 * @param {string} command the shell command line
 * @param {string} branch the branch of the directory the command runs in (`cwd`)
 * @param {{ protectedBranches: string[], merge?: { isMerge: (words: string[]) => boolean, check: (words: string[]) => string | null },
 *   autoMerge?: { isAutoMerge: (words: string[]) => boolean, check: (words: string[]) => string | null },
 *   cwd?: string, branchOf?: (repository: { cwd: string, gitDir: string | null }) => string | null }} options
 *   `merge` is the merge guard of a host that cannot protect its branches: `check` returns the message that refuses the merge, or null;
 *   `autoMerge` is the guard of turning on the host's auto-merge, where an agent may not: `check` returns the message that refuses it, or null;
 *   `branchOf` answers the branch checked out in a repository, or null when the directory is no repository
 */
export function refusal(
  command,
  branch,
  { protectedBranches: PROTECTED, merge, autoMerge, cwd, branchOf } = { protectedBranches: [] }
) {
  return judge(
    command,
    { PROTECTED, merge, autoMerge, cwd, branchOf, branches: new Map([[PROJECT, branch]]) },
    cwd ?? '.'
  )
}

// The repository a git command acts on: its key, a description for the message, and how to read its branch (null: cannot be told)
function repositoryOf({ repo }, dir, { cwd, branchOf }) {
  if (!branchOf) {
    return { key: PROJECT, where: '', read: () => null }
  }
  let at = dir
  for (const path of repo.dirs) {
    at = reach(at, path)
  }
  if (repo.gitDir !== null) {
    const gitDir = reach(at, repo.gitDir)
    return {
      key: `git-dir:${gitDir}`,
      where: gitDir,
      read: () => (gitDir && at ? branchOf({ cwd: at, gitDir }) : null)
    }
  }
  if (repo.workTree !== null || at === null) {
    return { key: `unknown:${repo.workTree}`, where: repo.workTree ?? '', read: () => null }
  }
  return { key: at === cwd ? PROJECT : `dir:${at}`, where: at, read: () => branchOf({ cwd: at, gitDir: null }) }
}

function judge(command, context, startDir) {
  const { PROTECTED, merge, autoMerge, branches } = context
  const protectedBranch = (name) => name === null || PROTECTED.includes(name)
  let dir = startDir
  const scopes = []
  for (const { words, depth } of scopedCommands(command)) {
    while (scopes.length > depth) {
      dir = scopes.pop()
    }
    while (scopes.length < depth) {
      scopes.push(dir)
    }
    const nested = nestedCommand(words)
    const inner = nested === null ? null : judge(nested, context, dir)
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
    if (autoMerge?.isAutoMerge(words)) {
      const message = autoMerge.check(words)
      if (message) {
        return message
      }
    }
    dir = afterCd(dir, words)
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
    const repository = repositoryOf(git, dir, context)
    if (!branches.has(repository.key)) {
      branches.set(repository.key, repository.read())
    }
    const current = branches.get(repository.key)
    if ((git.subcommand === 'commit' || git.subcommand === 'push') && protectedBranch(current)) {
      return current === null
        ? `The branch of the repository this command acts on cannot be told${repository.where ? ` (${repository.where})` : ''}, so it is judged as a protected branch: ` +
            'name the directory with `cd <path>` or `git -C <path>`, and create a branch named by the Git rules of the entry file (branches) before you commit or push.'
        : `You are on ${current}${repository.where ? ` in ${repository.where}` : ''}: create a branch named by the Git rules of the entry file (branches) before you commit or push.`
    }
    const flags = NEW_BRANCH_FLAGS[git.subcommand] ?? []
    const flag = git.args.findIndex((arg) => flags.includes(arg))
    if (flag >= 0 && git.args[flag + 1]) {
      branches.set(repository.key, git.args[flag + 1])
    } else if (flags.length) {
      branches.set(repository.key, operands.find((operand) => PROTECTED.includes(operand)) ?? current)
    }
  }
  return null
}
