// `harness review measure` (task 2.3): the measurements of a harness review that a script can decide, which four reviews ran by hand with `wc`, `grep` and
// a loop over the Markdown files: words and normative words in the always-loaded set (M6, M20), the statuses of the rule map (M5), the references that
// break the dependency rule between layers (M3), the files no index reaches (M7) and the highest fan-out of a document (M21). The numbers are printed
// against the budgets of the review bindings. A measurement is evidence, not a verdict: the reviewer judges a hit in context (method, section 4, step 3).
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { entryFile, ruleIds } from './entry.mjs'
import { LAYERS, classify, layerConfig, trackedFiles } from './layers.mjs'
import { VENDOR_DIR } from './lock.mjs'
import { linkTargets } from './markdown.mjs'

// The words that make a statement normative, and the words that make a rule conditional; the lists of the hand-run measurements, so that a number
// compares with the numbers of the earlier reports
export const NORMATIVE_WORDS = /\b(?:must|never|do not|don't|always|only)\b/gi
export const EXCEPTION_WORDS = /\b(?:unless|except|only when|only if|but not|apart from|if .* then)\b/gi

// The estimate of the hand-run measurements: a word is about 1.3 tokens
const TOKENS_PER_WORD = 1.3

// What a layer may reference (method, section 2.1); a reference inside one layer is always allowed
export const MAY_REFERENCE = Object.freeze({
  core: [],
  domain: [],
  adapter: ['core', 'domain'],
  profile: ['core', 'adapter', 'domain'],
  state: LAYERS,
  entry: LAYERS
})

const PROCEDURES_BLOCK = /<!-- harness:begin procedures -->\n([\s\S]*?)\n<!-- harness:end procedures -->/

// How a budget row of the bindings is found for a number: by the words of its row
export const BUDGETS = Object.freeze({
  procedureRows: /rows of the `procedures` block/i,
  procedureWords: /words of the `procedures` block/i,
  words: /words in the always-loaded set/i,
  normative: /normative words/i,
  exception: /exception words/i,
  fanOut: /highest fan-out/i,
  unreachable: /unreachable|orphan/i,
  illegal: /illegal reference|references? that break the dependency rule/i
})

export const countWords = (text) => text.split(/\s+/).filter(Boolean).length
const countMatches = (text, pattern) => (text.match(pattern) ?? []).length
const format = (number) => number.toLocaleString('en-US')
const cells = (line) =>
  line
    .replace(/^\|\s*/, '')
    .replace(/\s*\|\s*$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim())

/** The files the agent runtime loads in every session: the entry file, the files it imports with a line `@path`, and the root files that import the entry file. */
export function alwaysLoaded({ files, read, profile }) {
  const entry = entryFile(profile)
  const set = []
  const add = (path) => {
    if (!set.includes(path) && files.includes(path)) {
      set.push(path)
      for (const [, target] of read(path).matchAll(/^@(\S+)\s*$/gm)) {
        add(posix.normalize(posix.join(posix.dirname(path), target)))
      }
    }
  }
  add(entry)
  for (const path of files.filter((file) => !file.includes('/') && file.endsWith('.md') && file !== entry)) {
    if (new RegExp(`^@${entry.replace(/[.]/g, '\\.')}\\s*$`, 'm').test(read(path))) {
      add(path)
    }
  }
  return set
}

/**
 * M5: the rows of every table with a Status column in the rule-map document, by status, those of the generated block (`harness:begin rule-map`) apart from the
 * hand-written ones, and the rules of the entry file that no row names.
 * @returns {{ hand: Record<string, number>, generated: Record<string, number>, unmapped: string[] }}
 */
export function ruleMapStatuses(text, entryRuleIds = []) {
  const counts = { hand: {}, generated: {} }
  const named = new Set()
  let generated = false
  let header = null
  for (const line of text.split('\n')) {
    generated =
      /<!-- harness:begin rule-map -->/.test(line) || (generated && !/<!-- harness:end rule-map -->/.test(line))
    if (!line.startsWith('|')) {
      // A blank line inside a table does not end it (the rows after it still have their status); a line of text does
      header = line.trim() && !line.startsWith('<!--') ? null : header
      continue
    }
    const row = cells(line)
    if (row.some((cell) => /^status$/i.test(cell))) {
      header = row
    } else if (header && !/^[\s:|-]*$/.test(line)) {
      // The status is the cell under the header; when it is the last column, a `|` inside a code span of an earlier cell cannot move it
      const index = header.findIndex((cell) => /^status$/i.test(cell))
      const cell = index === header.length - 1 ? row[row.length - 1] : row[index]
      const status = /^[a-z]+/.exec((cell ?? '').replace(/[*`]/g, '').toLowerCase())?.[0]
      if (status) {
        const kind = generated ? counts.generated : counts.hand
        kind[status] = (kind[status] ?? 0) + 1
      }
      for (const [, id] of (row[0] ?? '').matchAll(/`([a-z0-9.-]+)`/g)) {
        named.add(id)
      }
    }
  }
  return { ...counts, unmapped: entryRuleIds.filter((id) => !named.has(id)) }
}

/** The tracked file a relative link of `from` reaches (a folder reaches its README), or null. */
export function linkedFile(from, target, tracked) {
  const [path] = target.split('#')
  if (!path) {
    return null
  }
  let resolved
  try {
    resolved = posix.normalize(posix.join(posix.dirname(from), decodeURIComponent(path)))
  } catch {
    return null
  }
  if (resolved.startsWith('../')) {
    return null
  }
  const found = [resolved, posix.join(resolved, 'README.md')].find((candidate) => tracked.has(candidate))
  return found && found !== from ? found : null
}

/** The links between the tracked Markdown files: `{ out, in }`, each a Map from a file to the Set of files it links or is linked from. */
export function referenceGraph({ files, read }) {
  const tracked = new Set(files)
  const out = new Map()
  const incoming = new Map()
  for (const file of files.filter((path) => path.endsWith('.md'))) {
    const targets = new Set(linkTargets(read(file)).map((target) => linkedFile(file, target, tracked)))
    targets.delete(null)
    out.set(file, targets)
    for (const target of targets) {
      incoming.set(target, (incoming.get(target) ?? new Set()).add(file))
    }
  }
  return { out, in: incoming }
}

/** M7: the Markdown files that a walk of the links from `roots` does not reach. A file of a hidden folder is read by the runtime or the host, and the vendored copy is judged at its source. */
export function unreachable({ graph, files, roots }) {
  const reached = new Set()
  const queue = [...roots]
  while (queue.length) {
    const file = queue.pop()
    if (!reached.has(file)) {
      reached.add(file)
      queue.push(...(graph.out.get(file) ?? []))
    }
  }
  return files.filter(
    (file) =>
      file.endsWith('.md') &&
      !reached.has(file) &&
      !file.startsWith(`${VENDOR_DIR}/`) &&
      !file.split('/').some((part) => part.startsWith('.'))
  )
}

/** The highest `count` entries of a graph side, by size and then by path. */
export function highest(map, count = 3) {
  return [...map]
    .map(([file, others]) => ({ file, count: others.size }))
    .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file))
    .slice(0, count)
}

/** M3: the links from one layer to a layer it may not reference, as `{ from, to, fromLayer, toLayer }`. */
export function illegalReferences({ files, read, config }) {
  const { classes } = classify(files, config)
  const partlyCore = new Set([
    ...config.core.filter(({ sections }) => sections).map(({ path }) => path),
    ...(config.blocks ?? []).map(({ path }) => path)
  ])
  const layerOf = (file) => {
    const layers = classes.get(file) ?? []
    if (layers.length === 2 && layers.includes('core') && partlyCore.has(file)) {
      return layers.find((layer) => layer !== 'core')
    }
    return layers.length === 1 ? layers[0] : null
  }
  const tracked = new Set(files)
  const found = []
  for (const file of files.filter((path) => path.endsWith('.md') && classes.has(path))) {
    const fromLayer = layerOf(file)
    const targets = new Set(linkTargets(read(file)).map((target) => linkedFile(file, target, tracked)))
    targets.delete(null)
    for (const target of targets) {
      const toLayer = layerOf(target)
      if (fromLayer && toLayer && fromLayer !== toLayer && !MAY_REFERENCE[fromLayer].includes(toLayer)) {
        found.push({ from: file, to: target, fromLayer, toLayer })
      }
    }
  }
  return found
}

/** The ceilings of the bindings: each number's budget row is the table row whose text matches, and its ceiling the first number of the cell under "Ceiling" or "Budget". */
export function readCeilings(text) {
  const ceilings = {}
  let column = -1
  for (const line of text.split('\n')) {
    if (!line.startsWith('|')) {
      column = -1
      continue
    }
    const row = cells(line)
    const header = row.findIndex((cell) => /^(?:ceiling|budget)$/i.test(cell))
    if (header >= 0) {
      column = header
    } else if (column >= 0 && !/^[\s:|-]*$/.test(line)) {
      const number = /\d[\d,]*/.exec(row[column] ?? '')
      for (const [key, pattern] of Object.entries(BUDGETS)) {
        if (number && pattern.test(row.slice(0, column).join(' ')) && ceilings[key] === undefined) {
          ceilings[key] = Number(number[0].replace(/,/g, ''))
        }
      }
    }
  }
  return ceilings
}

const verdict = (value, ceiling) =>
  ceiling === undefined
    ? ''
    : value <= ceiling
      ? ` (ceiling ${format(ceiling)}: met)`
      : ` (ceiling ${format(ceiling)}: EXCEEDED)`

/**
 * The measurements of the project at `root`.
 * @param {{ root: string, profile: object, files?: string[], read?: (path: string) => string }} options `files` are the tracked files (default: those of Git), `read` reads one
 * @returns {{ lines: string[], exceeded: string[] }}
 */
export function measureReview({
  root,
  profile,
  files = trackedFiles(root),
  read = (path) => readFileSync(join(root, path), 'utf8')
}) {
  const bindingsPath = profile.documents?.harnessBindings
  const ceilings = bindingsPath && files.includes(bindingsPath) ? readCeilings(read(bindingsPath)) : {}
  const exceeded = []
  const lines = []
  const check = (key, value) => {
    if (ceilings[key] !== undefined && value > ceilings[key]) {
      exceeded.push(key)
    }
    return verdict(value, ceilings[key])
  }

  // M6 and M20: the always-loaded set
  const loaded = alwaysLoaded({ files, read, profile })
  const texts = loaded.map(read)
  const words = texts.reduce((sum, text) => sum + countWords(text), 0)
  const entryText = loaded.length ? texts[0] : ''
  const block = PROCEDURES_BLOCK.exec(entryText)?.[1]
  lines.push(
    `M6  always loaded: ${format(words)} words (about ${format(Math.round(words * TOKENS_PER_WORD))} tokens) in ${loaded.map((file, index) => `${file} ${format(countWords(texts[index]))}`).join(' + ') || 'no entry file'}${check('words', words)}`
  )
  if (block !== undefined) {
    const rows = block.split('\n').filter((line) => line.startsWith('|')).length - 2
    lines.push(
      `M6  procedures block of ${loaded[0]}: ${rows} rows${check('procedureRows', rows)}, ${format(countWords(block))} words${check('procedureWords', countWords(block))}`
    )
  }
  const joined = texts.join('\n')
  const normative = countMatches(joined, NORMATIVE_WORDS)
  const exception = countMatches(joined, EXCEPTION_WORDS)
  lines.push(
    `M20 rule load: ${normative} normative words${check('normative', normative)}, ${exception} exception words${check('exception', exception)}, ${ruleIds(joined).length} rules with an id`
  )

  // M5: the statuses of the rule map
  const mapPath = profile.documents?.ruleChecks
  if (mapPath && files.includes(mapPath)) {
    const { hand, generated, unmapped } = ruleMapStatuses(read(mapPath), ruleIds(entryText))
    const describe = (counts, kind) => {
      const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
      const by = Object.entries(counts)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([status, count]) => `${count} ${status}`)
      return `${total} ${kind}${by.length ? ` (${by.join(', ')})` : ''}`
    }
    lines.push(
      `M5  rule map ${mapPath}, rows: ${describe(hand, 'hand-written')}, ${describe(generated, 'generated')}; rules of ${loaded[0]} without a row: ${unmapped.length}${unmapped.length ? ` (${unmapped.join(', ')})` : ''}`
    )
  } else {
    lines.push('M5  rule map: the profile has no `documents.ruleChecks` document')
  }

  // M21 and M7: the references between the Markdown files
  const graph = referenceGraph({ files, read })
  const [top, ...rest] = highest(graph.out)
  if (top) {
    lines.push(
      `M21 highest fan-out: ${top.file} ${top.count}${check('fanOut', top.count)}${rest.length ? `, then ${rest.map(({ file, count }) => `${file} ${count}`).join(', ')}` : ''}`
    )
    const [most] = highest(graph.in, 1)
    lines.push(
      most ? `M21 highest fan-in: ${most.file} ${most.count}` : 'M21 highest fan-in: no document links another'
    )
  }
  const entryLayer = profile.layers?.entry ?? []
  const roots = [
    ...new Set([...loaded, ...files.filter((file) => file === 'README.md' || entryLayer.includes(file))])
  ].filter((file) => files.includes(file))
  const orphans = unreachable({ graph, files, roots })
  lines.push(
    `M7  unreachable from ${roots.join(', ')}: ${orphans.length} Markdown files${check('unreachable', orphans.length)}`,
    ...orphans.map((file) => `      ${file}`)
  )

  // M3: the references against the dependency rule
  const config = layerConfig(root, profile)
  if (config) {
    const illegal = illegalReferences({ files, read, config })
    lines.push(`M3  references against the dependency rule: ${illegal.length}${check('illegal', illegal.length)}`)
    for (const { from, to, fromLayer, toLayer } of illegal) {
      lines.push(`      ${from} (${fromLayer.toUpperCase()}) → ${to} (${toLayer.toUpperCase()})`)
    }
  } else {
    lines.push('M3  dependency rule: the profile file has no `layers` role, so there is no layer map to measure')
  }
  return { lines, exceeded }
}

const git = (root, ...args) => {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

/**
 * `harness review measure`: prints the measurements of the project against the budgets of its bindings; the exit code is 1 when a number is over its ceiling.
 * @returns {{ lines: string[], code: number }}
 */
export function reviewCommand({ words, root, profile, files, read }) {
  if (words[0] !== 'measure' || words.length !== 1) {
    return { lines: ['usage: harness review measure'], code: 1 }
  }
  const { lines, exceeded } = measureReview({ root, profile, files, read })
  const commit = git(root, 'rev-parse', '--short', 'HEAD')
  const dirty = git(root, 'status', '--porcelain') ? ' (with local changes)' : ''
  const head = `Measurements of ${profile.project?.name ?? root}${commit ? ` at ${commit}${dirty}` : ''}, by \`harness review measure\`:`
  return {
    lines: [
      head,
      ...lines,
      exceeded.length
        ? `Over the ceiling of the bindings: ${exceeded.join(', ')}.`
        : 'No number is over a ceiling of the bindings.'
    ],
    code: exceeded.length ? 1 : 0
  }
}
