import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { profile, protectedBranches, root } from './harness-profile.mjs'

const read = (path) => readFileSync(join(root, path), 'utf8')

test('the protected branches are the production and the integration branch', () => {
  assert.deepEqual(protectedBranches, [profile.branches.production, profile.branches.integration])
})

test('the branch triggers of the CI workflow are the protected branches', () => {
  const workflow = read('.github/workflows/ci.yml')
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
  const workflows = readdirSync(join(root, '.github', 'workflows')).map((name) => `.github/workflows/${name}`)
  const files = [...names.map((name) => `scripts/${name}`), '.githooks/pre-push', ...workflows]
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
    assert.equal(hit, -1, `${file}:${hit + 1} spells out a value of harness-profile.json`)
  }
})

test('no workflow names a branch outside its branch triggers', () => {
  const workflows = readdirSync(join(root, '.github', 'workflows')).map((name) => `.github/workflows/${name}`)
  const branch = new RegExp(`\\b(${protectedBranches.join('|')})\\b`)
  for (const file of workflows) {
    const hit = read(file)
      .split('\n')
      .findIndex((line) => branch.test(line) && !/^\s+branches: \[/.test(line))
    assert.equal(hit, -1, `${file}:${hit + 1} names a protected branch outside a branches trigger`)
  }
})

test('the protection script sends the required checks and the branches of the profile file to the ruleset', () => {
  const dir = mkdtempSync(join(tmpdir(), 'protect-branches-'))
  const sent = join(dir, 'ruleset.json')
  // A stand-in for `gh`: it keeps the body that the script pipes to a POST or a PUT and prints nothing
  writeFileSync(join(dir, 'gh'), `#!/usr/bin/env bash\nif [[ "$*" == *--input* ]]; then cat > '${sent}'; fi\n`)
  chmodSync(join(dir, 'gh'), 0o755)
  execFileSync('bash', [join(root, 'scripts', 'protect-branches.sh')], {
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
    stdio: 'pipe'
  })
  const ruleset = JSON.parse(readFileSync(sent, 'utf8'))
  const checks = ruleset.rules.find((rule) => rule.type === 'required_status_checks').parameters.required_status_checks
  assert.deepEqual(
    checks.map((check) => check.context),
    profile.requiredChecks
  )
  assert.deepEqual(
    ruleset.conditions.ref_name.include,
    protectedBranches.map((branch) => `refs/heads/${branch}`)
  )
})

// The text of a Markdown file without its fenced code blocks, line numbers kept
function outsideFences(text) {
  let fenced = false
  return text.split('\n').map((line) => {
    if (/^\s*```/.test(line)) {
      fenced = !fenced
      return ''
    }
    return fenced ? '' : line
  })
}

test('the engineering, operations and testing documents name the branches by role, not by name', () => {
  const branch = protectedBranches.join('|')
  const named = new RegExp(
    `\`(${branch})\`|origin/(${branch})\\b|\\b(checkout|merge|push|pull|rebase|tag|into|from) (${branch})\\b`
  )
  for (const dir of ['docs/engineering', 'docs/operations', 'docs/testing']) {
    for (const name of readdirSync(join(root, dir)).filter((entry) => entry.endsWith('.md'))) {
      const hit = outsideFences(read(`${dir}/${name}`)).findIndex((line) => named.test(line))
      assert.equal(hit, -1, `${dir}/${name}:${hit + 1} names a protected branch; use its role or a placeholder`)
    }
  }
})
