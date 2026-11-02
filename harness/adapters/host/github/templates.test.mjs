import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { checkValues } from '../../../tools/lib/values.mjs'
import { renderTemplate, renderWorkflow } from './templates.mjs'
import { readJobNames, readTriggers } from './workflows.mjs'

const profile = {
  adapters: { stacks: ['x'], host: 'github' },
  branches: { production: 'prod', integration: 'dev' },
  requiredChecks: ['verify', 'pr-title'],
  coveragePackages: ['alpha', 'beta'],
  release: { versionFiles: ['package.json'] },
  checks: { roleOnlyPaths: ['.github/workflows/*'] }
}

const dirs = []
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

function rendered(options) {
  const root = mkdtempSync(join(tmpdir(), 'github-templates-'))
  dirs.push(root)
  mkdirSync(join(root, '.github', 'workflows'), { recursive: true })
  writeFileSync(join(root, '.github', 'workflows', 'ci.yml'), renderWorkflow('ci.yml', profile, options))
  writeFileSync(join(root, '.github', 'workflows', 'release.yml'), renderWorkflow('release.yml', profile))
  return root
}

test('a value is written as it is, a list joined, and a missing value is an error', () => {
  assert.equal(renderTemplate('a <%= x.y %> b <%= list %>', { x: { y: 1 }, list: ['p', 'q'] }), 'a 1 b p, q')
  assert.throws(() => renderTemplate('<%= nothing.here %>', {}), /needs a value for "nothing\.here"/)
})

test('the CI template triggers on the protected branches and defines the required checks of the profile', () => {
  const root = rendered({ jobs: ['static', 'tests'] })
  assert.deepEqual(
    readTriggers(root).map(({ event, branches }) => [event, branches]),
    [
      ['pull_request', ['dev', 'prod']],
      ['push', ['dev', 'prod']]
    ]
  )
  const jobs = readJobNames(root).map(({ name }) => name)
  for (const check of profile.requiredChecks) {
    assert.ok(jobs.includes(check), check)
  }
})

test('the rendered workflows pass `harness check values`: no branch outside a trigger, no literal list of the coverage packages', () => {
  const root = rendered({ jobs: ['static', 'tests'] })
  const files = ['.github/workflows/ci.yml', '.github/workflows/release.yml']
  assert.deepEqual(checkValues({ root, profile, files }).problems, [])
})

test('the aggregator needs the jobs of the stack, and the template refuses a render without them', () => {
  const ci = renderWorkflow('ci.yml', profile, { jobs: ['static', 'tests'] })
  assert.match(ci, /needs: \[changes, static, tests\]/)
  assert.throws(() => renderWorkflow('ci.yml', profile), /needs a value for "jobs"/)
})

test('the pull-request title check takes the commit types, and the release reads the version file of the profile', () => {
  assert.match(
    renderWorkflow('ci.yml', profile, { jobs: ['t'] }),
    /\^\(feat\|fix\|refactor\|test\|docs\|chore\|perf\|ci\)/
  )
  assert.match(renderWorkflow('release.yml', profile), /require\('\.\/package\.json'\)/)
})
