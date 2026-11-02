import assert from 'node:assert/strict'
import { test } from 'node:test'
import { simpleCommands } from '../../../tools/lib/guard.mjs'
import { checkMerge, isMerge, mergeTarget } from './merge-guard.mjs'

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
  const run = (list) => checkMerge({ words: words('gh pr merge 12'), requiredChecks: required, gh: checks(list) })
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
  assert.match(checkMerge({ words: words('gh pr merge 12'), requiredChecks: ['verify'], gh }), /verify \(pending\)/)
  assert.deepEqual(calls[0], ['pr', 'checks', '12', '--json', 'name,bucket'])
  checkMerge({ words: words('gh pr merge'), requiredChecks: [], gh })
  assert.deepEqual(calls[1], ['pr', 'checks', '--json', 'name,bucket'])
})

test('checks that cannot be read refuse the merge: the guard does not guess', () => {
  const unreadable = checkMerge({
    words: words('gh pr merge 12'),
    requiredChecks: ['verify'],
    gh: () => ({ status: 1, stdout: '', stderr: 'no network' })
  })
  assert.match(unreadable, /Cannot read the checks of 12, so the merge is refused/)
  assert.match(
    checkMerge({
      words: words('gh pr merge'),
      requiredChecks: [],
      gh: () => ({ status: 0, stdout: 'garbage', stderr: '' })
    }),
    /Cannot read the checks of this pull request/
  )
})
