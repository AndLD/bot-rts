// The steps of `harness adopt` (design §6.4) that look at a project's own files: the managed blocks of its entry file, its Git hooks, and its scripts. Each
// reports and changes only what it must: a project's file is never deleted, and a script that the framework replaces is named, not removed.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { entryFile } from './entry.mjs'
import { generators } from './generators.mjs'
import { inFramework } from './lock.mjs'
import { markers } from './managed.mjs'

/**
 * The scripts that the framework's commands replace, by their path in a project that copied the first harness: a path pattern and what does its job now.
 * The names are those of the repository the framework was extracted from, which every copy kept.
 */
export const REPLACED_SCRIPTS = Object.freeze([
  [/^scripts\/check-markdown-links\.mjs$/, '`harness check links`'],
  [/^scripts\/(?:check-core-leaks|core-leaks-lib(?:\.test)?)\.mjs$/, '`harness check core`'],
  [/^scripts\/plan-summary(?:-lib(?:\.test)?)?\.mjs$/, '`harness plan summary`'],
  [/^scripts\/plan-log(?:-lib(?:\.test)?)?\.mjs$/, '`harness plan log`'],
  [/^scripts\/release(?:-lib(?:\.test)?)?\.mjs$/, '`harness release`'],
  [/^scripts\/check-changelog-fragments\.mjs$/, '`harness check changelog`'],
  [
    /^scripts\/(?:check-open-items|check-glossary|check-product-knowledge|open-items-lib|glossary-lib|product-knowledge-lib)(?:\.test)?\.mjs$/,
    '`harness check product-knowledge`'
  ],
  [/^scripts\/local-gate(?:-lib(?:\.test)?)?\.mjs$/, '`harness gate`'],
  [
    /^scripts\/(?:merge-coverage(?:-lib)?|check-changed-coverage)(?:\.test)?\.mjs$/,
    '`harness coverage merge` and `harness coverage check-changed`'
  ],
  [/^scripts\/hook-guard-bash(?:\.test)?\.mjs$/, 'the runtime hook `guard-shell`'],
  [/^scripts\/hook-guard-edit(?:\.test)?\.mjs$/, 'the runtime hook `guard-edit`'],
  [/^scripts\/hook-session-start(?:\.test)?\.mjs$/, 'the runtime hook `session-start`'],
  [/^scripts\/hook-format-edited(?:\.test)?\.mjs$/, 'the runtime hook `format-edited`'],
  [
    /^scripts\/harness-profile(?:\.test)?\.(?:mjs|json)$/,
    'the profile file at the root and `harness check profile` and `harness check values`'
  ],
  [/^scripts\/coverage-threshold\.json$/, 'the role `coverageGate` of the profile file'],
  [/^scripts\/protect-branches\.sh$/, '`harness host protect`'],
  [/^\.githooks\/pre-commit$/, 'the Git hook `pre-commit` of the framework'],
  [/^\.githooks\/pre-push$/, 'the Git hook `pre-push` of the framework']
])

// Names that many modules export and that say nothing about what a module does
const COMMON_EXPORTS = new Set(['default', 'main', 'run'])
const EXPORT = /^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm

/** The names a module exports (declarations only), without the names that say nothing. */
export function exportedNames(text) {
  return new Set([...text.matchAll(EXPORT)].map((match) => match[1]).filter((name) => !COMMON_EXPORTS.has(name)))
}

const walkModules = (dir, relative = '') =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? walkModules(join(dir, entry.name), posix.join(relative, entry.name))
          : entry.name.endsWith('.mjs') && !entry.name.endsWith('.test.mjs')
            ? [posix.join(relative, entry.name)]
            : []
      )
    : []

/** The framework's modules and what each exports: `{ 'lib/links.mjs': Set }`, from the `tools/` of a framework tree. */
export function frameworkExports(frameworkTools) {
  return Object.fromEntries(
    walkModules(frameworkTools).map((path) => [path, exportedNames(readFileSync(join(frameworkTools, path), 'utf8'))])
  )
}

/**
 * Which of a project's scripts the framework replaces, and which are the project's own checks.
 * - by name: a path of `REPLACED_SCRIPTS`;
 * - by exports: a script that exports the same names as a module of the framework (two or more, or its only one), so a copy that was renamed is found too;
 * - a project check: a remaining script `scripts/check-*.mjs`, which stays and runs in `harness check all` (`checks.project`).
 * @param {{ root: string, tracked?: string[], exports: Record<string, Set<string>> }} options `tracked` are the project's files (default: the Git index)
 * @returns {{ replaced: { path: string, by: string }[], checks: string[] }}
 */
export function analyzeScripts({ root, tracked = trackedPaths(root), exports }) {
  const replaced = []
  const checks = []
  for (const path of tracked.filter((file) => /^(?:scripts|\.githooks)\//.test(file))) {
    const byName = REPLACED_SCRIPTS.find(([pattern]) => pattern.test(path))
    if (byName) {
      replaced.push({ path, by: byName[1] })
      continue
    }
    if (!/^scripts\/[^/]+\.mjs$/.test(path) || path.endsWith('.test.mjs') || !existsSync(join(root, path))) {
      continue
    }
    const own = exportedNames(readFileSync(join(root, path), 'utf8'))
    const twin = Object.entries(exports).find(([, names]) => {
      const shared = [...own].filter((name) => names.has(name))
      return shared.length > 0 && shared.length >= Math.min(2, own.size)
    })
    if (twin) {
      replaced.push({ path, by: `the exports of \`${posix.join('tools', twin[0])}\`` })
    } else if (/^scripts\/check-[^/]+\.mjs$/.test(path)) {
      checks.push(`node ${path}`)
    }
  }
  return { replaced, checks }
}

/** The files Git tracks in `root`, or the files on disk below `scripts/` and `.githooks/` when it is not a repository. */
export function trackedPaths(root) {
  try {
    return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n')
      .filter(Boolean)
  } catch {
    return ['scripts', '.githooks'].flatMap((dir) =>
      existsSync(join(root, dir))
        ? readdirSync(join(root, dir), { withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => posix.join(dir, entry.name))
        : []
    )
  }
}

/**
 * Adds the managed blocks that the entry file lacks (the markers, empty: the sync fills them), at its end under one heading, so that a project's own
 * text of the same rules stays where it is and the project removes the duplicates in its own pull request. A block that is there already is left alone.
 * @returns {{ added: string[], path: string | null }}
 */
export function ensureManagedBlocks(root, profile) {
  const path = entryFile(profile)
  const full = join(root, path)
  const blocks = generators.filter((generator) => generator.block && generator.path(profile) === path)
  if (!existsSync(full) || blocks.length === 0) {
    return { added: [], path: existsSync(full) ? path : null }
  }
  const text = readFileSync(full, 'utf8')
  const missing = blocks.filter(({ block }) => !text.includes(markers(block).start))
  if (missing.length === 0) {
    return { added: [], path }
  }
  const section = [
    '',
    '## Rules managed by the framework',
    '',
    'These blocks are written by `harness sync`; edit the profile file, not the blocks. A rule of your own text above that says the same is a duplicate: remove it when you have read the block.',
    '',
    ...missing.flatMap(({ block }) => [markers(block).start, markers(block).end, ''])
  ].join('\n')
  writeFileSync(full, `${text.replace(/\n*$/, '\n')}${section}`)
  return { added: missing.map(({ block }) => block), path }
}

/**
 * Points `core.hooksPath` at the framework's Git hooks. Nothing is committed: an existing repository has its own history and branches.
 * @returns {string[]} what it did
 */
export function adoptGit(root, profile) {
  const hooks = inFramework(profile, 'tools/git-hooks')
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  let before = ''
  try {
    git('rev-parse', '--show-toplevel')
  } catch {
    return [
      `${root} is not a Git repository, so the Git hooks were not installed: run \`git config core.hooksPath ${hooks}\` in it.`
    ]
  }
  try {
    before = git('config', '--get', 'core.hooksPath')
  } catch {
    // no hooks path yet
  }
  git('config', 'core.hooksPath', hooks)
  return [
    before && before !== hooks
      ? `Pointed the Git hooks at ${hooks} (core.hooksPath was ${before}).`
      : `Pointed the Git hooks at ${hooks} (core.hooksPath).`
  ]
}
