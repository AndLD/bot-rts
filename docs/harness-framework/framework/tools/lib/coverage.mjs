// The coverage gate on the neutral coverage summary (design §3.4 and §4.1): `harness coverage check-changed` holds every source file changed by a pull
// request to the gate, and `harness coverage merge` merges the shards of each package that CI uploaded and holds the merged total to the gate. The
// summary is `<package>/coverage/coverage-summary.json` (`total` and one entry per file, each with the metrics `statements`, `branches`,
// `functions` and `lines`); the stack adapter writes it and merges its tool's raw output (`coverage.mjs` of the adapter, role "coverage merge").
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { STACKS, stackOf, stackModule } from './stacks.mjs'

export const SUMMARY_FILE = 'coverage-summary.json'
export const summaryPath = (root, pkg) => join(root, pkg, 'coverage', SUMMARY_FILE)

// The metrics of the gate that a summary entry reports: a stack may measure a subset (design §4.1)
const gated = (gate, entry) => Object.entries(gate).filter(([metric]) => entry[metric])

/** The metrics of `total` that are below the gate, like a test runner's threshold on the whole package. */
export const totalFailures = (total, gate) =>
  gated(gate, total)
    .filter(([metric, threshold]) => total[metric].pct < threshold)
    .map(([metric, threshold]) => `${metric} ${total[metric].pct}% (gate ${threshold}%)`)

/**
 * The changed files below the gate, as `<file>: <metrics>`.
 * @param {{ summary: object, root: string, changed: string[], pkg: string, gate: object }} options
 *   `summary` is the package's summary, whose keys are absolute paths; a changed file missing from it is excluded in the coverage configuration
 * @returns {{ failures: string[], checked: number }}
 */
export function changedFileFailures({ summary, root, changed, pkg, gate }) {
  const covered = new Map(Object.entries(summary).map(([file, data]) => [relative(root, file), data]))
  const failures = []
  let checked = 0

  for (const file of changed.filter((path) => path.startsWith(`${pkg}/`))) {
    const data = covered.get(file)
    if (!data) {
      continue
    }
    checked += 1
    const low = gated(gate, data)
      .filter(([metric, threshold]) => data[metric].pct < threshold)
      .map(([metric, threshold]) => `${metric} ${data[metric].pct}% (gate ${threshold}%)`)
    if (low.length) {
      failures.push(`${file}: ${low.join(', ')}`)
    }
  }
  return { failures, checked }
}

/**
 * `harness coverage check-changed <base> [<package>...]`: the files added or modified since `base` meet the gate.
 * With `skipMissing`, a package without a summary is skipped (the local gate, whose related tests may have found none); without it, a missing
 * summary is a usage error.
 * @returns {{ code: number, messages: string[], problems: string[] }}
 */
export function checkChanged({ root, profile, base, packages, skipMissing = false }) {
  const changed = execFileSync('git', ['diff', '--name-only', '--diff-filter=AM', `${base}...HEAD`], {
    cwd: root,
    encoding: 'utf8'
  })
    .split('\n')
    .filter(Boolean)
  const messages = []
  const failures = []
  let checked = 0

  for (const pkg of packages.length ? packages : (profile.coveragePackages ?? [])) {
    const path = summaryPath(root, pkg)
    if (!existsSync(path)) {
      if (skipMissing) {
        messages.push(`No related tests ran in ${pkg}, so its changed files are judged by CI.`)
        continue
      }
      return { code: 2, messages, problems: [`No coverage summary for ${pkg}; run the tests with coverage first.`] }
    }
    const result = changedFileFailures({
      summary: JSON.parse(readFileSync(path, 'utf8')),
      root,
      changed,
      pkg,
      gate: profile.coverageGate
    })
    checked += result.checked
    failures.push(...result.failures)
  }

  if (failures.length) {
    return { code: 1, messages, problems: [`Changed files below the coverage gate:\n${failures.join('\n')}`] }
  }
  return { code: 0, messages: [...messages, `${checked} changed source files meet the coverage gate.`], problems: [] }
}

// The shards of a package are uploaded as `coverage-<package>-<index>-of-<count>`; this reads the name back
export function parseArtifactName(name) {
  const match = /^coverage-([\w-]+?)-(\d+)-of-(\d+)$/.exec(name)
  return match ? { pkg: match[1], index: Number(match[2]), count: Number(match[3]) } : null
}

/** The shards of `pkg` among the artifact names, in order. Throws when a shard of the set is missing or the sets disagree. */
export function shardsOf(pkg, names) {
  const found = names.map(parseArtifactName).filter((entry) => entry && entry.pkg === pkg)

  if (!found.length) {
    throw new Error(`No coverage artifact for ${pkg}`)
  }
  const [{ count }] = found
  const indexes = found.map((entry) => entry.index).sort((a, b) => a - b)
  const expected = Array.from({ length: count }, (_, i) => i + 1)

  if (found.some((entry) => entry.count !== count) || indexes.join() !== expected.join()) {
    throw new Error(`The coverage of ${pkg} is incomplete: found shards ${indexes.join(', ')} of ${count}`)
  }
  return found.map((entry) => `coverage-${pkg}-${entry.index}-of-${entry.count}`)
}

/**
 * `harness coverage merge <artifacts-dir> [--out <dir>] [<package>...]`: merges the shards of each package with the coverage-merge role of the
 * stack that owns it, writes the merged files and the summary below `<out>/<package>/coverage/` (default: the project root, where one run of the
 * tests would write them, so `check-changed` reads the merged result), and holds each total to the gate.
 * @returns {{ code: number, messages: string[], problems: string[] }} code 1 below the gate, 2 on missing or inconsistent shards
 */
export function mergeShards({ root, profile, artifacts, out = root, packages, stacks = STACKS }) {
  const targets = packages.length ? packages : (profile.coveragePackages ?? [])
  if (targets.length === 0) {
    // A project with no coverage package uploads no shard, so the folder of the downloaded artifacts may not exist either
    return {
      code: 0,
      messages: ['No coverage packages in the profile file, so there is no coverage to merge.'],
      problems: []
    }
  }
  const names = readdirSync(artifacts)
  const messages = []
  const failures = []

  for (const pkg of targets) {
    const stack = stackOf(pkg, profile, stacks)
    const merger = stack && stackModule(stack, 'coverage-merge')
    if (!merger) {
      return { code: 2, messages, problems: [`${pkg}: no stack adapter fills the coverage-merge role for it`] }
    }
    try {
      const shards = shardsOf(pkg, names)
      const merged = merger.merge(
        shards.map((shard) => JSON.parse(readFileSync(join(artifacts, shard, merger.SHARD_FILE), 'utf8')))
      )
      const dir = join(out, pkg, 'coverage')
      mkdirSync(dir, { recursive: true })
      for (const [file, content] of Object.entries(merged.artifacts)) {
        writeFileSync(join(dir, file), JSON.stringify(content))
      }
      writeFileSync(join(dir, SUMMARY_FILE), JSON.stringify(merged.summary))

      const { total } = merged.summary
      const counts = gated(profile.coverageGate, total)
        .map(([metric]) => `${metric} ${total[metric].covered}/${total[metric].total} (${total[metric].pct}%)`)
        .join(', ')
      messages.push(
        `${pkg}: ${shards.length} shard(s) merged, ${Object.keys(merged.summary).length - 1} files; ${counts}`
      )
      const low = totalFailures(total, profile.coverageGate)
      if (low.length) {
        failures.push(`${pkg}: ${low.join(', ')}`)
      }
    } catch (error) {
      return {
        code: 2,
        messages,
        problems: [
          error.message.startsWith(pkg) || error.message.includes(pkg) ? error.message : `${pkg}: ${error.message}`
        ]
      }
    }
  }

  if (failures.length) {
    return { code: 1, messages, problems: [`Coverage below the gate:\n${failures.join('\n')}`] }
  }
  return { code: 0, messages, problems: [] }
}
