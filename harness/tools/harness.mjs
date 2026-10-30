#!/usr/bin/env node
// The `harness` command line (design §7.1). This version holds the vendoring commands of task 17.4 and the profile commands of 17.5; the
// build tasks add the others.
//   harness sync [--from <folder or Git URL>] [--to <version>]   take the framework into harness/ and rewrite harness.lock.json
//   harness sync --local                                          regenerate the managed files only, without fetching
//   harness check vendored                                        harness/, the managed files and the profile file against the lock
//   harness diff                                                  the local change of harness/ against the locked version or the fork point
//   harness override <path> --reason <why> --issue <link>         accept one edited vendored file until the next sync
//   harness detach --reason <why>                                 the project takes the copy over; no more versions
//   harness profile get <role>                                    print a value of the profile file (a list one item per line)
//   harness check profile                                         the profile file against the schema
// `--root <dir>` runs on another project (default: the Git top level of the working directory).
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { checkProfile, loadProfile, lookup } from './lib/profile.mjs'
import { checkVendored, detach, diff, override, sync } from './lib/vendor.mjs'

const USAGE = `usage: harness <command>
  sync [--from <folder or Git URL>] [--to <version>]
  sync --local
  check vendored
  check profile
  profile get <role>
  diff
  override <path> --reason <why> --issue <link>
  detach --reason <why>`

const FLAGS_WITH_VALUE = new Set(['--from', '--to', '--reason', '--issue', '--root'])

export function parseArgs(argv) {
  const words = []
  const flags = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (FLAGS_WITH_VALUE.has(arg)) {
      if (index + 1 >= argv.length) {
        throw new Error(`${arg} needs a value`)
      }
      flags[arg.slice(2)] = argv[index + 1]
      index += 1
    } else if (arg === '--local') {
      flags.local = true
    } else if (arg.startsWith('--')) {
      throw new Error(`unknown option ${arg}`)
    } else {
      words.push(arg)
    }
  }
  return { words, flags }
}

function projectRoot(flag) {
  if (flag) {
    return resolve(flag)
  }
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
  } catch {
    return process.cwd()
  }
}

/** Runs one command; returns the exit code (0 done, 1 a check failed or the command was refused, 2 a usage error). */
export function run(argv, { out = console.log, err = console.error } = {}) {
  let parsed
  try {
    parsed = parseArgs(argv)
  } catch (error) {
    err(`harness: ${error.message}\n${USAGE}`)
    return 2
  }
  const { words, flags } = parsed
  const root = projectRoot(flags.root)
  const command = words.join(' ')

  try {
    if (command === 'sync') {
      sync({ root, from: flags.from, to: flags.to, local: flags.local }).messages.forEach((line) => out(line))
      return 0
    }
    if (command === 'check vendored') {
      const { problems, notes } = checkVendored({ root })
      notes.forEach((line) => out(line))
      problems.forEach((line) => err(`harness check vendored: ${line}`))
      if (!problems.length) {
        out('Checked the vendored framework, the managed files and the profile file against harness.lock.json.')
      }
      return problems.length ? 1 : 0
    }
    if (command === 'check profile') {
      const problems = checkProfile(root)
      problems.forEach((line) => err(`harness check profile: ${line}`))
      if (!problems.length) {
        out('Checked the profile file against the schema.')
      }
      return problems.length ? 1 : 0
    }
    if (words[0] === 'profile' && words[1] === 'get' && words.length === 3) {
      const value = lookup(loadProfile(root), words[2])
      out(
        Array.isArray(value)
          ? value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join('\n')
          : value
      )
      return 0
    }
    if (command === 'diff') {
      out(diff({ root }))
      return 0
    }
    if (words[0] === 'override' && words.length === 2) {
      override({ root, path: words[1], reason: flags.reason, issue: flags.issue }).messages.forEach((line) => out(line))
      return 0
    }
    if (command === 'detach') {
      detach({ root, reason: flags.reason }).messages.forEach((line) => out(line))
      return 0
    }
  } catch (error) {
    err(`harness ${command}: ${error.message}`)
    return 1
  }

  err(`harness: unknown command "${command}"\n${USAGE}`)
  return 2
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  process.exitCode = run(process.argv.slice(2))
}
