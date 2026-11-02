import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import { checkValues } from '../../../tools/lib/values.mjs'
import { ciJobs } from '../../stack/node-ts/ci-jobs.mjs'
import { scaffoldFiles } from './scaffold.mjs'
import { readJobNames } from './workflows.mjs'

const dirs = []
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

const profile = {
  adapters: { stacks: ['node-ts'], host: 'github' },
  branches: { production: 'main', integration: 'develop' },
  requiredChecks: ['verify', 'pr-title'],
  coveragePackages: ['web'],
  commands: { lint: 'npm run lint', docsCheck: 'npm run docs:check' },
  release: { versionFiles: ['package.json'] }
}

test('the CI workflow puts the jobs of the stacks in place of the comment of the template, and passes `harness check values`', () => {
  const files = scaffoldFiles(profile, { jobs: [ciJobs(profile)] })
  const ci = files.find(({ path }) => path === '.github/workflows/ci.yml').content
  assert.doesNotMatch(ci, /The jobs of the stack adapter/)
  assert.match(ci, /needs: \[changes, static, web\]/)

  const root = mkdtempSync(join(tmpdir(), 'github-scaffold-'))
  dirs.push(root)
  for (const { path, content } of files) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  const ids = readJobNames(root).map(({ id }) => id)
  assert.ok(
    ['pr-title', 'changes', 'static', 'web', 'verify'].every((id) => ids.includes(id)),
    ids.join(', ')
  )
  const tracked = files.map(({ path }) => path)
  assert.deepEqual(checkValues({ root, profile, files: tracked }).problems, [])
  assert.match(files.find(({ path }) => path.endsWith('release.yml')).content, /package\.json/)
})

test('a workflow without the jobs of the stacks is refused, since the aggregator would need nothing', () => {
  assert.throws(() => scaffoldFiles(profile, { jobs: [] }), /needs a value for "jobs"/)
})
