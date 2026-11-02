import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { isWorkflowFile, readJobNames, readTriggers, workflowFiles } from './workflows.mjs'

const dirs = []
function project(files) {
  const root = mkdtempSync(join(tmpdir(), 'github-workflows-'))
  dirs.push(root)
  mkdirSync(join(root, '.github', 'workflows'), { recursive: true })
  for (const [name, text] of Object.entries(files)) {
    writeFileSync(join(root, '.github', 'workflows', name), text)
  }
  return root
}
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

const CI = `name: CI

on:
  pull_request:
    branches: [dev, 'prod']
  push:
    branches: [dev, prod]

jobs:
  pr-title:
    runs-on: ubuntu-latest
  verify:
    name: "verify"
    needs: [pr-title]
    steps:
      - name: not a job name
  tests:
    name: tests \${{ matrix.shard }}
    runs-on: ubuntu-latest
env:
  OTHER: 1
`

test('the triggers list the branches of each event, quotes removed', () => {
  const root = project({ 'ci.yml': CI, 'release.yml': "on:\n  push:\n    tags: ['v*.*.*']\n" })
  assert.deepEqual(readTriggers(root), [
    { file: '.github/workflows/ci.yml', event: 'pull_request', branches: ['dev', 'prod'] },
    { file: '.github/workflows/ci.yml', event: 'push', branches: ['dev', 'prod'] }
  ])
})

test('the job names are the name of a job or its key, and steps are not jobs', () => {
  const root = project({ 'ci.yml': CI })
  assert.deepEqual(
    readJobNames(root).map(({ id, name }) => [id, name]),
    [
      ['pr-title', 'pr-title'],
      ['verify', 'verify'],
      ['tests', 'tests ${{ matrix.shard }}']
    ]
  )
})

test('workflow files are the yml files of the workflows folder, and a project without it has none', () => {
  const root = project({ 'ci.yml': CI, 'notes.txt': 'x' })
  assert.deepEqual(workflowFiles(root), ['.github/workflows/ci.yml'])
  assert.deepEqual(workflowFiles(mkdtempSync(join(tmpdir(), 'github-none-'))), [])
  assert.ok(isWorkflowFile('.github/workflows/ci.yml'))
  assert.ok(!isWorkflowFile('.github/actions/install/action.yml') && !isWorkflowFile('docs/ci.yml'))
})
