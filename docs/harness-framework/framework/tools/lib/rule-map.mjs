// The core rows of the rule-to-check map (design §4.4 and §6.3), generated from what the framework and the selected adapters declare: where each
// rule of the entry file is caught: early (the agent runtime, before the action), local (a Git hook) or remote (the host and CI). A rule that nothing
// declares is judgment, and one that is held only in part (`partial`) is "partly". The map follows the project: a host that cannot protect its branches (`host.protection: false`) has no remote holder for the
// protection rules, and the merge guard of the runtime turns on. The block is written into the rule-map document of the project (`documents.ruleChecks`).
import { listAdapters } from './adapters.mjs'
import { ENTRY_BLOCKS, RULES_DIR, rulesTemplate } from './entry.mjs'
import { selectedAdapters } from './lock.mjs'

export const BLOCK_ID = 'rule-map'

// The Git hooks of the framework (tools/git-hooks) hold these rules locally in every project
export const GIT_HOOK_RULES = Object.freeze([
  {
    rule: 'git.no-direct-commit',
    when: 'local',
    by: '`pre-commit` refuses a commit on a protected branch (the root commit of a new repository passes)'
  },
  { rule: 'agent.branch-first', when: 'local', by: '`pre-commit` refuses a commit on a protected branch' },
  { rule: 'git.protection', when: 'local', by: '`pre-push` refuses a push to a protected branch' },
  { rule: 'git.retention', when: 'local', by: '`pre-push` refuses the deletion of a remote branch' }
])

const ITEM_START = /^\s*(?:[-*] |\d+\. |#{1,6} |\*\*)/
const ID_COMMENT = /<!-- rule:[a-z0-9.-]+ -->/

// The text of the rule whose id is on `lines[index]`: the lines of its item (back to the start of the item, forward to the start of the next), as one sentence
function ruleText(lines, index) {
  let start = index
  while (start > 0 && lines[start].trim() && !ITEM_START.test(lines[start])) {
    start -= 1
  }
  let end = index
  while (
    end + 1 < lines.length &&
    lines[end + 1].trim() &&
    !ITEM_START.test(lines[end + 1]) &&
    !ID_COMMENT.test(lines[end + 1])
  ) {
    end += 1
  }
  const text = lines
    .slice(start, end + 1)
    .join(' ')
    .replace(/<!--.*?-->/g, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*`]/g, '')
    .replace(/^\s*(?:[-] |\d+\. )/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 150 ? `${text.slice(0, 147)}…` : text
}

/** The rules of the entry file with their text: `{ id, text }` in the order of the templates. */
export function coreRules(dir = RULES_DIR) {
  const rules = []
  for (const file of Object.values(ENTRY_BLOCKS)) {
    const lines = rulesTemplate(file, dir).split('\n')
    lines.forEach((line, index) => {
      for (const [, id] of line.matchAll(/<!-- rule:([a-z0-9.-]+) -->/g)) {
        rules.push({ id, text: ruleText(lines, index) })
      }
    })
  }
  return rules
}

/** The declarations that apply to a profile: the Git hooks, and the `enforces` of the selected adapters, filtered by the protection of the host. */
export function declarations(profile, adaptersDir) {
  const selected = selectedAdapters(profile)
  const protectedHost = profile.host?.protection !== false
  const fromAdapters = listAdapters(adaptersDir)
    .filter(({ axis, name }) => (axis === 'host' ? selected.host === name : selected[`${axis}s`].includes(name)))
    .flatMap(({ manifest }) => manifest.enforces ?? [])
  return [...GIT_HOOK_RULES, ...fromAdapters].filter(
    ({ condition }) => !condition || (condition === 'host-protected') === protectedHost
  )
}

/** The Markdown of the core rows. */
export function renderRuleMap(profile, { adaptersDir, rulesDir } = {}) {
  const found = declarations(profile, adaptersDir)
  const cell = (id, when) =>
    found
      .filter(({ rule, when: at }) => rule === id && at === when)
      .map(({ by }) => by)
      .join('; ') || '–'
  const rows = coreRules(rulesDir).map(({ id, text }) => {
    const cells = ['early', 'local', 'remote'].map((when) => cell(id, when))
    const holders = found.filter(({ rule }) => rule === id)
    const status = holders.length === 0 ? 'judgment' : holders.every(({ partial }) => partial) ? 'partly' : 'enforced'
    return `| \`${id}\` | ${text} | ${cells.join(' | ')} | ${status} |`
  })
  const note =
    profile.host?.protection === false
      ? 'The host cannot protect its branches here (`host.protection` is off), so the protection rules have no remote holder; the Git hooks and the merge guard of the runtime hold them.'
      : 'The host enforces the protection rules with the ruleset that `harness host protect` sets.'
  return [
    '| Rule | Text | Early (agent runtime) | Local (Git hooks, gate) | Remote (host, CI) | Status |',
    '| ---- | ---- | --------------------- | ----------------------- | ----------------- | ------ |',
    ...rows,
    '',
    note
  ].join('\n')
}

/** The managed block of the rule-map document (generators.mjs). */
export const ruleMap = {
  id: 'rule-map',
  block: BLOCK_ID,
  path: (profile) =>
    profile.documents?.ruleChecks && profile.documents?.method ? profile.documents.ruleChecks : undefined,
  render: ({ profile }) => renderRuleMap(profile)
}
