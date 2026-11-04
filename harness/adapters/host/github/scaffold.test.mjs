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

test('the workflow that updates the pull requests waiting on auto-merge is written where the host protects and auto-merge is on, and nowhere else', () => {
  const paths = (host) =>
    scaffoldFiles({ ...profile, host }, { jobs: [ciJobs(profile)] }).map(({ path }) => path.split('/').at(-1))
  assert.ok(paths(undefined).includes('update-branches.yml'), 'by default')
  assert.ok(paths({ protection: true, autoMerge: true }).includes('update-branches.yml'))
  assert.ok(!paths({ protection: false, autoMerge: false }).includes('update-branches.yml'))
  assert.ok(!paths({ protection: true, autoMerge: false }).includes('update-branches.yml'))
  assert.ok(!paths({ protection: false }).includes('update-branches.yml'))

  const files = scaffoldFiles(profile, { jobs: [ciJobs(profile)] })
  const update = files.find(({ path }) => path.endsWith('update-branches.yml')).content
  assert.match(update, /push:\n\s+branches: \[develop, main\]/)
  assert.match(update, /gh pr update-branch "\$number"/)
  assert.match(update, /select\(\.autoMergeRequest != null\)/)
  assert.match(update, /gh workflow run ci\.yml --ref "\$branch"/)
  assert.match(files.find(({ path }) => path.endsWith('ci.yml')).content, /\n {2}workflow_dispatch:\n/)
})
