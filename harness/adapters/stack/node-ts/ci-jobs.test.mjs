import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { checkValues } from '../../../tools/lib/values.mjs'
import { renderWorkflow } from '../../host/github/templates.mjs'
import { readJobNames } from '../../host/github/workflows.mjs'
import { ciJobs } from './ci-jobs.mjs'

const profile = {
  adapters: { stacks: ['node-ts'], host: 'github' },
  branches: { production: 'main', integration: 'develop' },
  requiredChecks: ['verify', 'pr-title'],
  coveragePackages: ['api', 'web'],
  commands: { lint: 'npm run lint', typecheck: 'npm run typecheck', docsCheck: 'npm run docs:check' },
  release: { versionFiles: ['package.json'] },
  checks: { roleOnlyPaths: ['.github/workflows/*'] }
}
const dirs = []
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

test('the stack gives a static job and a coverage job per package, whose artifacts the aggregator merges', () => {
  const { ids, yaml } = ciJobs(profile)
  assert.deepEqual(ids, ['static', 'api', 'web'])
  assert.match(yaml, /^ {2}api:\n {4}name: api tests\n {4}needs: changes\n/m)
  assert.match(yaml, /name: coverage-web-1-of-1\n\s+path: web\/coverage\/coverage-final\.json/)
  assert.match(yaml, /- run: npm run lint\n\s+- run: npm run typecheck\n\s+- run: npm run docs:check/)
})

test('the jobs of the stack and the frame of the host make one workflow that passes `harness check values`', () => {
  const { ids, yaml } = ciJobs(profile)
  const frame = renderWorkflow('ci.yml', profile, { jobs: ids })
  const marker = frame.indexOf('  # The jobs of the stack adapter')
  const workflow = `${frame.slice(0, marker)}${yaml}\n${frame.slice(marker)}`
  const root = mkdtempSync(join(tmpdir(), 'ci-jobs-'))
  dirs.push(root)
  mkdirSync(join(root, '.github', 'workflows'), { recursive: true })
  writeFileSync(join(root, '.github', 'workflows', 'ci.yml'), workflow)
  assert.deepEqual(
    readJobNames(root).map(({ id }) => id),
    ['pr-title', 'changes', 'static', 'api', 'web', 'verify']
  )
  assert.deepEqual(checkValues({ root, profile, files: ['.github/workflows/ci.yml'] }).problems, [])
  assert.match(workflow, /needs: \[changes, static, api, web\]/)
  assert.match(workflow, /harness\.mjs coverage merge coverage-artifacts/)
})

test('among several stacks the static job is named after the stack, runs its own commands, and the coverage jobs are those of its own packages', () => {
  const profile = {
    commands: { lint: 'run-lint', docsCheck: 'run-docs' },
    coveragePackages: ['api', 'web']
  }
  const many = { stacks: 2, name: 'node-ts', packages: ['web'], commands: { lint: 'npm run lint' } }
  const first = ciJobs(profile, { ...many, first: true })
  assert.deepEqual(first.ids, ['static-node-ts', 'web'])
  assert.match(first.yaml, /^ {2}static-node-ts:\n {4}name: static checks \(node-ts\)\n/m)
  assert.ok(first.yaml.includes('- run: npm run lint') && first.yaml.includes('- run: run-docs'))
  assert.equal(first.yaml.includes('run-lint'), false, "the stack runs its own lint command, not the first stack's")
  assert.equal(ciJobs(profile, { ...many, first: false }).yaml.includes('run-docs'), false)
  assert.deepEqual(ciJobs(profile).ids, ['static', 'api', 'web'], 'a project with one stack is as it was')
})
