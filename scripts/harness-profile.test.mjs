import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { lookup, profile, protectedBranches, root } from './harness-profile.mjs'

const CLI = join(root, 'scripts', 'harness-profile.mjs')

test('lookup returns the value at a dotted path and fails on an unknown path', () => {
  const sample = { branches: { integration: 'dev' }, list: ['a', 'b'] }
  assert.equal(lookup(sample, 'branches.integration'), 'dev')
  assert.deepEqual(lookup(sample, 'list'), ['a', 'b'])
  assert.throws(() => lookup(sample, 'branches.missing'), /no value "branches.missing"/)
})

test('the protected branches are the production and the integration branch', () => {
  assert.deepEqual(protectedBranches, [profile.branches.production, profile.branches.integration])
})

test('the command line prints a value, a list one item per line, and fails on an unknown path', () => {
  const get = (path) => execFileSync('node', [CLI, 'get', path], { encoding: 'utf8' })
  assert.equal(get('branches.integration'), `${profile.branches.integration}\n`)
  assert.equal(get('coveragePackages'), `${profile.coveragePackages.join('\n')}\n`)
  assert.throws(() => get('no.such.value'), /Command failed/)
})

test('the branch triggers of the CI workflow are the protected branches', () => {
  const workflow = readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8')
  const triggers = [...workflow.matchAll(/^\s+(pull_request|push):\n\s+branches: \[(.+)\]$/gm)]
  assert.deepEqual(triggers.map((match) => match[1]).sort(), ['pull_request', 'push'])
  for (const [, , branches] of triggers) {
    assert.deepEqual(
      branches
        .split(',')
        .map((branch) => branch.trim())
        .sort(),
      [...protectedBranches].sort()
    )
  }
})

test('no script or hook spells out a branch name, the repository or a plan path of the profile', () => {
  const names = readdirSync(join(root, 'scripts')).filter(
    (name) => /\.(mjs|sh)$/.test(name) && !name.endsWith('.test.mjs')
  )
  const files = [...names.map((name) => `scripts/${name}`), '.githooks/pre-push']
  const literal = new RegExp(
    [
      ...protectedBranches.flatMap((branch) => [
        `origin/${branch}\\b`,
        `refs/heads/${branch}\\b`,
        `['"\`]${branch}['"\`]`
      ]),
      profile.repository.slug,
      profile.paths.plan,
      profile.paths.changelog,
      profile.paths.changelogFragments
    ].join('|')
  )
  for (const file of files) {
    const hit = readFileSync(join(root, file), 'utf8')
      .split('\n')
      .findIndex((line) => literal.test(line) && !line.startsWith('//'))
    assert.equal(hit, -1, `${file}:${hit + 1} spells out a value of scripts/harness-profile.json`)
  }
})
