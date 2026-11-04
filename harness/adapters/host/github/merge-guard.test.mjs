import assert from 'node:assert/strict'
import { test } from 'node:test'
import { simpleCommands } from '../../../tools/lib/guard.mjs'
import { checkAutoMerge, checkMerge, isAutoMerge, isMerge, mergeTarget } from './merge-guard.mjs'

const words = (line) => simpleCommands(line)[0]
const checks =
  (list, status = 0) =>
  () => ({ status, stdout: JSON.stringify(list), stderr: '' })

test('a gh pr merge is recognised through variables and wrappers, and other gh commands are not', () => {
  assert.ok(isMerge(words('gh pr merge 12 --squash')))
  assert.ok(isMerge(words('GH_TOKEN=x gh pr merge')))
  assert.ok(isMerge(words('env sudo gh pr merge 12')))
  assert.ok(!isMerge(words('gh pr view 12')))
  assert.ok(!isMerge(words('gh pr checks 12')))
  assert.ok(!isMerge(words('git merge feature/x')))
})

test('the pull request is the first operand that is not the value of an option', () => {
  assert.equal(mergeTarget(words('gh pr merge 12 --squash')), '12')
  assert.equal(mergeTarget(words('gh pr merge --squash --subject "a title" --body x 12')), '12')
  assert.equal(mergeTarget(words('gh pr merge -R owner/name feature/x')), 'feature/x')
  assert.equal(mergeTarget(words('gh pr merge --squash')), undefined)
})

test('a merge passes when every required check passed or was skipped, and is refused otherwise, naming the checks', () => {
  const required = ['verify', 'pr-title']
  const run = (list) => checkMerge({ words: words('gh pr merge 12'), requiredChecks: required, cli: checks(list) })
  assert.equal(
    run([
      { name: 'verify', bucket: 'pass' },
      { name: 'pr-title', bucket: 'skipping' },
      { name: 'docker', bucket: 'fail' }
    ]),
    null
  )
  assert.match(
    run([
      { name: 'verify', bucket: 'fail' },
      { name: 'pr-title', bucket: 'pass' }
    ]),
    /No merge while a required check is not green: verify \(fail\)/
  )
  assert.match(run([{ name: 'verify', bucket: 'pending' }]), /verify \(pending\), pr-title \(not reported\)/)
})

test('the checks of the pull request are asked for by its number; pending checks make gh exit 8, which is not a failure to read them', () => {
  const calls = []
  const gh = (args) => (calls.push(args), { status: 8, stdout: '[{"name":"verify","bucket":"pending"}]', stderr: '' })
  assert.match(
    checkMerge({ words: words('gh pr merge 12'), requiredChecks: ['verify'], cli: gh }),
    /verify \(pending\)/
  )
  assert.deepEqual(calls[0], ['pr', 'checks', '12', '--json', 'name,bucket'])
  checkMerge({ words: words('gh pr merge'), requiredChecks: [], cli: gh })
  assert.deepEqual(calls[1], ['pr', 'checks', '--json', 'name,bucket'])
})

test('checks that cannot be read refuse the merge: the guard does not guess', () => {
  const unreadable = checkMerge({
    words: words('gh pr merge 12'),
    requiredChecks: ['verify'],
    cli: () => ({ status: 1, stdout: '', stderr: 'no network' })
  })
  assert.match(unreadable, /Cannot read the checks of 12, so the merge is refused/)
  assert.match(
    checkMerge({
      words: words('gh pr merge'),
      requiredChecks: [],
      cli: () => ({ status: 0, stdout: 'garbage', stderr: '' })
    }),
    /Cannot read the checks of this pull request/
  )
})

const BRANCHES = { production: 'main', integration: 'develop' }
const pull =
  (baseRefName, headRefName, status = 0) =>
  () => ({
    status,
    stdout: JSON.stringify({ baseRefName, headRefName }),
    stderr: ''
  })
const autoMerge = (line, cli, enabled = true) =>
  checkAutoMerge({ words: words(line), branches: BRANCHES, enabled, cli })

test('only a gh pr merge with --auto turns on auto-merge', () => {
  assert.ok(isAutoMerge(words('gh pr merge 12 --auto --squash')))
  assert.ok(isAutoMerge(words('GH_TOKEN=x gh pr merge --auto')))
  assert.ok(!isAutoMerge(words('gh pr merge 12 --squash')))
  assert.ok(!isAutoMerge(words('gh pr view 12 --auto')))
})

test('auto-merge is allowed on a task pull request into the integration branch, and nowhere else', () => {
  assert.equal(autoMerge('gh pr merge 12 --auto --squash', pull('develop', 'feature/3.1-x')), null)
  assert.equal(autoMerge('gh pr merge --auto --squash', pull('develop', 'docs/plan')), null)
  assert.match(autoMerge('gh pr merge 12 --auto', pull('main', 'release/0.1.2')), /production branch/)
  assert.match(autoMerge('gh pr merge 12 --auto', pull('main', 'feature/x')), /only on a pull request into develop/i)
  assert.match(autoMerge('gh pr merge 12 --auto', pull('develop', 'release/0.1.2')), /never on a release or hotfix/i)
  assert.match(autoMerge('gh pr merge 12 --auto', pull('develop', 'hotfix/1.0.1')), /never on a release or hotfix/i)
  assert.match(autoMerge('gh pr merge 12 --auto', pull('feature/3.17-x', 'feature/3.18-y')), /retargeted to develop/)
})

test('auto-merge is refused where the profile turns it off, and where the pull request cannot be read', () => {
  assert.match(autoMerge('gh pr merge 12 --auto', pull('develop', 'feature/x'), false), /`host.autoMerge` is false/)
  assert.match(autoMerge('gh pr merge 12 --auto', pull('develop', 'feature/x', 1)), /Cannot read the base of 12/)
  assert.match(
    autoMerge('gh pr merge --auto', () => ({ status: 0, stdout: 'nope', stderr: '' })),
    /Cannot read the base/
  )
})
