#!/usr/bin/env node
// The `harness` command line (design §7.1). The build tasks add commands; this version holds:
//   harness init [--name <n>] [--repository <owner/name>] [--stack <a,b>] [--runtime <a,b>] [--host <h>] [--set <role>=<value>]…
//                [--detached [--reason <why>]] [--non-interactive] [--from <folder or Git URL> [--to <version>]] [--force]
//                                                                fill the profile file (asking what no flag answers), then bootstrap
//   harness bootstrap [--non-interactive] [--detached] [--from …] [--force]   the engine on the profile file as it is (design §6.1)
//   harness template <dir> [--from <folder or Git URL> --to <version>]         build the template repository into an empty folder
//   harness sync [--from <folder or Git URL>] [--to <version>]   take the framework into harness/ and rewrite harness.lock.json
//   harness sync --local                                          regenerate the managed files only, without fetching
//   harness diff                                                  the local change of harness/ against the locked version or the fork point
//   harness override <path> --reason <why> --issue <link>         accept one edited vendored file until the next sync
//   harness detach --reason <why>                                 the project takes the copy over; no more versions
//   harness profile get <role>                                    print a value of the profile file (a list one item per line)
//   harness layers                                                print the layer map
//   harness check <name>                                          one check: vendored, generated, profile, adapters, values, layers, links, paths, core,
//                                                                 plan, changelog, product-knowledge
//   harness check all                                             every check, then the project's own (`checks.project`)
//   harness plan summary [--check]                                write (or compare) the summary of the plan index
//   harness plan log <phase> [ref]                                the implementation log of a phase from the merged pull requests
//   harness release [--dry-run]                                   prepare a release on its branch: versions and changelog
//   harness release notes <version>                               the changelog section of a version, for the host's release
//   harness ci changes <base> <head>                              whether a change needs the code checks (`code=true|false`)
//   harness gate [--dry-run]                                      the local gate of a push (the refs on standard input): the checks its files need
//   harness guard pre-commit | pre-push                           the Git guards of the protected branches (run by the Git hooks)
//   harness coverage check-changed [--skip-missing] <base> [<package>...]   the files changed since <base> meet the coverage gate
//   harness coverage merge <artifacts> [--out <dir>] [<package>...]         merge the coverage shards of CI and hold the total to the gate
//   harness host protect [--repo <owner/name>]                    set the protection of the production and the integration branch on the host
//   harness adapter test <path> [--only <pattern>]                run the conformance suite of its axis on the adapter folder at <path>
// `--root <dir>` runs on another project (default: the Git top level of the working directory).
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ciChanges } from './lib/changes.mjs'
import { release, releaseNotes } from './lib/changelog.mjs'
import { bootstrap, buildTemplate } from './lib/bootstrap.mjs'
import { CHECKS, checkAll, report, runCheck } from './lib/checks.mjs'
import { checkChanged, mergeShards } from './lib/coverage.mjs'
import { guardCommit, guardPush } from './lib/git-guards.mjs'
import { init } from './lib/init.mjs'
import { readStdin, runGate } from './lib/gate.mjs'
import { protectHost } from './lib/host.mjs'
import { layerConfig, renderLayerMap } from './lib/layers.mjs'
import { planLog, planSummary } from './lib/plan.mjs'
import { loadProfile, lookup } from './lib/profile.mjs'
import { detach, diff, override, sync } from './lib/vendor.mjs'

const USAGE = `usage: harness <command>
  init [--name <n>] [--repository <owner/name>] [--stack <a,b>] [--runtime <a,b>] [--host <h>] [--set <role>=<value>]
       [--detached [--reason <why>]] [--non-interactive] [--from <folder or Git URL> [--to <version>]] [--force]
  bootstrap [--non-interactive] [--detached [--reason <why>]] [--from <folder or Git URL> [--to <version>]] [--force]
  template <dir> [--from <folder or Git URL> [--to <version>]]
  sync [--from <folder or Git URL>] [--to <version>]
  sync --local
  diff
  override <path> --reason <why> --issue <link>
  detach --reason <why>
  profile get <role>
  layers
  check <${Object.keys(CHECKS).join('|')}|all>
  plan summary [--check]
  plan log <phase> [ref]
  release [--dry-run]
  release notes <version>
  ci changes <base> <head>
  gate [--dry-run]
  guard pre-commit|pre-push
  coverage check-changed [--skip-missing] <base> [<package>...]
  coverage merge <artifacts> [--out <dir>] [<package>...]
  host protect [--repo <owner/name>]
  adapter test <path> [--only <pattern>]`

const FLAGS_WITH_VALUE = new Set([
  '--from',
  '--to',
  '--reason',
  '--issue',
  '--root',
  '--repo',
  '--out',
  '--name',
  '--repository',
  '--stack',
  '--runtime',
  '--host',
  '--only'
])
// Flags that may be given several times; their values are collected in a list
const REPEATED_FLAGS = new Set(['--set'])
const BOOLEAN_FLAGS = new Set([
  '--local',
  '--check',
  '--dry-run',
  '--skip-missing',
  '--detached',
  '--non-interactive',
  '--force'
])

export function parseArgs(argv) {
  const words = []
  const flags = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (FLAGS_WITH_VALUE.has(arg) || REPEATED_FLAGS.has(arg)) {
      if (index + 1 >= argv.length) {
        throw new Error(`${arg} needs a value`)
      }
      const key = arg.slice(2)
      flags[key] = REPEATED_FLAGS.has(arg) ? [...(flags[key] ?? []), argv[index + 1]] : argv[index + 1]
      index += 1
    } else if (BOOLEAN_FLAGS.has(arg)) {
      flags[arg.slice(2).replace(/-(\w)/g, (_, letter) => letter.toUpperCase())] = true
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
export async function run(argv, { out = console.log, err = console.error, input = process.stdin } = {}) {
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
    if (command === 'init' || command === 'bootstrap') {
      const options = { root, flags, input, out, err }
      const { code } =
        command === 'init'
          ? await init(options)
          : await bootstrap({
              root,
              from: flags.from,
              to: flags.to,
              force: flags.force,
              detached: flags.detached,
              reason: flags.reason,
              out,
              err
            })
      return code
    }
    if (words[0] === 'template' && words.length === 2) {
      buildTemplate({ out: resolve(words[1]), from: flags.from, to: flags.to }).messages.forEach((line) => out(line))
      return 0
    }
    if (command === 'sync') {
      sync({ root, from: flags.from, to: flags.to, local: flags.local }).messages.forEach((line) => out(line))
      return 0
    }
    if (command === 'check all') {
      return checkAll({ root, out, err })
    }
    if (words[0] === 'check' && words.length === 2 && CHECKS[words[1]]) {
      return report(words[1], runCheck(words[1], { root, profile: loadProfile(root) }), { out, err })
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
    if (command === 'layers') {
      const config = layerConfig(root, loadProfile(root))
      if (!config) {
        throw new Error('the profile file has no `layers` role')
      }
      out(renderLayerMap(config))
      return 0
    }
    if (words[0] === 'plan' && words[1] === 'summary' && words.length === 2) {
      const { problems, message } = planSummary({ root, profile: loadProfile(root), check: flags.check })
      return report('plan', { problems, messages: [message] }, { out, err })
    }
    if (words[0] === 'plan' && words[1] === 'log' && (words.length === 3 || words.length === 4)) {
      out(planLog({ root, profile: loadProfile(root), phase: words[2], ref: words[3] }))
      return 0
    }
    if (command === 'release') {
      release({ root, profile: loadProfile(root), dryRun: flags.dryRun }).forEach((line) => out(line))
      return 0
    }
    if (words[0] === 'release' && words[1] === 'notes' && words.length === 3) {
      const profile = loadProfile(root)
      out(releaseNotes(readFileSync(join(root, profile.paths.changelog), 'utf8'), words[2]))
      return 0
    }
    if (words[0] === 'ci' && words[1] === 'changes' && words.length === 4) {
      out(ciChanges({ root, profile: loadProfile(root), base: words[2], head: words[3] }).message)
      return 0
    }
    if (words[0] === 'guard' && words.length === 2 && ['pre-commit', 'pre-push'].includes(words[1])) {
      const profile = loadProfile(root)
      const { code, message } =
        words[1] === 'pre-commit' ? guardCommit({ root, profile }) : guardPush({ stdin: readStdin(), profile })
      if (message) {
        err(message)
      }
      return code
    }
    if (command === 'gate') {
      return await runGate({ root, profile: loadProfile(root), stdin: readStdin(), dryRun: flags.dryRun, out, err })
    }
    if (words[0] === 'coverage' && words[1] === 'check-changed' && words.length >= 3) {
      const [base, ...packages] = words.slice(2)
      const { code, messages, problems } = checkChanged({
        root,
        profile: loadProfile(root),
        base,
        packages,
        skipMissing: flags.skipMissing
      })
      messages.forEach((line) => out(line))
      problems.forEach((line) => err(line))
      return code
    }
    if (words[0] === 'coverage' && words[1] === 'merge' && words.length >= 3) {
      const [artifacts, ...packages] = words.slice(2)
      const { code, messages, problems } = mergeShards({
        root,
        profile: loadProfile(root),
        artifacts: resolve(artifacts),
        out: flags.out ? resolve(flags.out) : root,
        packages
      })
      messages.forEach((line) => out(line))
      problems.forEach((line) => err(line))
      return code
    }
    if (command === 'host protect') {
      const { messages, problems } = protectHost({ profile: loadProfile(root), repo: flags.repo })
      return report('host protect', { problems, messages }, { out, err })
    }
    if (words[0] === 'adapter' && words[1] === 'test' && words.length === 3) {
      const { describeRun, runSuite } = await import('./conformance/suite.mjs')
      const { lines, passed } = describeRun(
        await runSuite({ dir: resolve(words[2]), only: flags.only ? new RegExp(flags.only, 'i') : undefined })
      )
      lines.forEach((line) => out(line))
      return passed ? 0 : 1
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
  process.exitCode = await run(process.argv.slice(2))
}
