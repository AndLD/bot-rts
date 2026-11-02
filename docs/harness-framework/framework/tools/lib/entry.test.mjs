import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { ENTRY_BLOCKS, entryBlocks, missingRoles, renderEntryBlock, ruleIds, rulesTemplate } from './entry.mjs'
import { readSchema } from './profile.mjs'
import { placeholderPaths } from './render.mjs'

const profile = () => ({
  branches: { integration: 'dev', production: 'prod' },
  plan: { openEndedPhaseNumber: 9 },
  repository: { host: 'SomeHost' },
  host: { protection: true },
  paths: { profileDocument: 'docs/profile.md' },
  documents: { rules: 'AGENTS.md', method: 'harness/core/method/method.md', stack: 'docs/stack.md' }
})

// The rule ids are stable: the rule-to-check map cites them, so a removed or renamed id is a change of the framework, made on purpose
const IDS = {
  'non-negotiables': ['nn.change', 'nn.tests', 'nn.coverage', 'nn.typed', 'nn.clean', 'nn.secrets'],
  'git-rules': [
    'git.branches',
    'git.merge',
    'git.retention',
    'git.local-delete',
    'git.protection',
    'git.admin-bypass',
    'git.commit-format',
    'git.small-prs',
    'git.no-direct-commit',
    'git.green-checks',
    'agent.branch-first',
    'agent.routine-push',
    'agent.plan-approval',
    'agent.plan-related',
    'agent.claim',
    'agent.open-pr',
    'agent.ask-merge',
    'agent.no-rewrite',
    'agent.no-auto-merge',
    'agent.ci-fixes'
  ]
}

const rules = mkdtempSync(join(tmpdir(), 'harness-rules-'))
after(() => rmSync(rules, { recursive: true, force: true }))

test('each block carries its rule ids, once each and in a stable order', () => {
  for (const [block, file] of Object.entries(ENTRY_BLOCKS)) {
    assert.deepEqual(ruleIds(rulesTemplate(file)), IDS[block], block)
  }
  const all = Object.values(IDS).flat()
  assert.equal(new Set(all).size, all.length)
})

test('every placeholder of the rule templates is a role of the schema', () => {
  const properties = readSchema().properties
  const known = (path) => {
    const [head, ...rest] = path.split('.')
    return Boolean(rest.reduce((node, key) => node?.properties?.[key], properties[head]))
  }
  for (const file of Object.values(ENTRY_BLOCKS)) {
    assert.deepEqual(
      placeholderPaths(rulesTemplate(file)).filter((path) => !known(path)),
      [],
      file
    )
  }
})

test('the rules use the neutral wordings, and their only values are on the Role binding line', () => {
  const text = Object.keys(ENTRY_BLOCKS)
    .map((block) => renderEntryBlock(block, profile()))
    .join('\n')
  assert.match(text, /No new untyped public boundaries \(the stack's lint rule names them\)/)
  assert.match(text, /no debug printing left in committed code \(use the logger\)/)
  assert.doesNotMatch(text, /`any`|console\.log/)

  const valued = text.split('\n').filter((line) => /\bdev\b|\bprod\b|SomeHost|Phase 9/.test(line))
  assert.equal(valued.length, 1)
  assert.match(
    valued[0],
    /^\*\*Role binding\.\*\*.*the integration branch is `dev`, the production branch is `prod`, the open-ended phase is Phase 9, the repository host is SomeHost; every other value/
  )
})

test('the links are written relative to the entry file', () => {
  const atRoot = renderEntryBlock('non-negotiables', profile())
  assert.match(atRoot, /\[method §1\]\(\.\/harness\/core\/method\/method\.md#1-principles\)/)
  assert.match(atRoot, /\[profile\]\(\.\/docs\/profile\.md#2-quality-gates\)/)

  const nested = { ...profile(), paths: { profileDocument: 'docs/profile.md', entryFile: 'docs/agents/AGENTS.md' } }
  assert.match(renderEntryBlock('git-rules', nested), /\[stack §6\]\(\.\.\/stack\.md#6-agent-runtime\)/)
})

test('a role the profile lacks is an error naming it, so no line of a rule is left out', () => {
  const lacking = profile()
  delete lacking.documents.stack
  assert.deepEqual(missingRoles(rulesTemplate(ENTRY_BLOCKS['git-rules']), lacking), ['documents.stack'])
  assert.throws(
    () => renderEntryBlock('git-rules', lacking),
    /the block "git-rules" of the entry file needs the profile roles documents\.stack/
  )
})

test('the protection rule names the ruleset when the host enforces it, and the hooks when it cannot', () => {
  const protectedHost = renderEntryBlock('git-rules', profile())
  assert.match(protectedHost, /harness host protect/)
  assert.match(protectedHost, /rule:git\.admin-bypass/)

  const unprotected = renderEntryBlock('git-rules', { ...profile(), host: { protection: false } })
  assert.doesNotMatch(unprotected, /harness host protect|rule:git\.admin-bypass/)
  assert.match(unprotected, /cannot enforce this/)
  assert.match(unprotected, /rule:git\.protection/)
})

test('a template is read without its leading comment, from the folder given', () => {
  mkdirSync(join(rules, 'r'), { recursive: true })
  writeFileSync(join(rules, 'r', 'x.md'), '<!-- what this file is -->\nA rule. <!-- rule:x.one -->\n')
  assert.equal(rulesTemplate('x.md', join(rules, 'r')), 'A rule. <!-- rule:x.one -->\n')
  assert.deepEqual(ruleIds(rulesTemplate('x.md', join(rules, 'r'))), ['x.one'])
})

test('one generator per block, writing into the entry file of a project with a document map', () => {
  assert.deepEqual(
    entryBlocks.map(({ id, block }) => [id, block]),
    [
      ['entry-non-negotiables', 'non-negotiables'],
      ['entry-git-rules', 'git-rules']
    ]
  )
  assert.equal(entryBlocks[0].path(profile()), 'AGENTS.md')
  assert.equal(entryBlocks[0].path({ ...profile(), paths: { entryFile: 'RULES.md' } }), 'RULES.md')
  assert.equal(entryBlocks[0].path({}), undefined)
  assert.equal(entryBlocks[1].render({ profile: profile() }), renderEntryBlock('git-rules', profile()))
})
