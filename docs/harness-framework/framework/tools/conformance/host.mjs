// The checks of a host adapter (design §4.3, §5): the protection request sent to a stand-in command line of the host, the host's files of a new
// project read back by the adapter's own readers, and the merge guard.
//
// conformance.json of a host adapter:
//   mergeCommand   the words of a command that merges a pull request, and otherCommand those of one that does not (for the merge-guard role)
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tempDir } from './fixture.mjs'
import { Skip } from './skip.mjs'

const SLUG = 'acme/conformance'

// A stand-in for the host's command line: answers every call with an empty list, and keeps the calls
function standIn() {
  const calls = []
  const cli = (args, input) => (calls.push({ args, input }), { status: 0, stdout: '[]', stderr: '' })
  return { cli, calls }
}

const moduleOf = async (context, role) => {
  const entry = context.manifest.roles[role]
  assert.ok(entry?.module, `the role ${role} has no module`)
  return (await context.adapter()).modules[entry.module][entry.export]
}

// A stand-in job in the form of the stack adapters' CI jobs, for the host's frame
const JOB = {
  ids: ['static'],
  yaml: [
    '  static:',
    '    name: static checks',
    '    needs: changes',
    "    if: needs.changes.outputs.code == 'true'",
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - run: "true"',
    ''
  ].join('\n')
}

export const hostChecks = [
  {
    name: 'protect: sends the branches and the required checks to the host, and changes nothing when the profile and the host disagree',
    run: async (context) => {
      const detect = await moduleOf(context, 'protection-available')
      const protect = await moduleOf(context, 'branch-protection')
      const profile = context.profile()

      const { cli, calls } = standIn()
      const detected = detect({ slug: SLUG, cli })
      assert.equal(typeof detected.available, 'boolean')
      assert.equal(typeof detected.reason, 'string')
      const askedByDetection = calls.length

      calls.length = 0
      const done = protect({ profile, slug: SLUG, cli })
      assert.deepEqual(done.problems, [])
      const sent = JSON.stringify(calls)
      assert.ok(calls.length > askedByDetection, 'protect sent nothing to the host')
      for (const word of [profile.branches.production, profile.branches.integration, ...profile.requiredChecks]) {
        assert.ok(sent.includes(word), `the request to the host does not mention ${word}`)
      }
      assert.deepEqual(protect({ profile, slug: SLUG, cli: standIn().cli }).problems, [], 'a second run is accepted')

      const disagree = standIn()
      const refused = protect({
        profile: { ...profile, host: { ...profile.host, protection: false } },
        slug: SLUG,
        cli: disagree.cli
      })
      assert.ok(
        refused.problems.length > 0,
        'the profile says there is no protection, the host offers it: that is a problem'
      )
      assert.equal(disagree.calls.length, askedByDetection, 'protect only asked the host; it changed nothing')
    }
  },
  {
    name: 'the host files of a new project: workflows that trigger on both protected branches and have a job for every required check',
    run: async (context) => {
      const entry = context.manifest.roles['scaffold-files']
      if (!entry) {
        throw new Skip('the scaffold-files role is empty')
      }
      const { modules } = await context.adapter()
      const profile = context.profile()
      const files = modules[entry.module][entry.export](profile, { jobs: [JOB] })
      assert.ok(Array.isArray(files) && files.length > 0)

      const root = tempDir('conformance-host-')
      for (const file of files) {
        mkdirSync(dirname(join(root, file.path)), { recursive: true })
        writeFileSync(join(root, file.path), file.content)
      }
      const readers = (role) => modules[context.manifest.roles[role].module]
      const { readTriggers, readJobNames, isWorkflowFile } = readers('values-in-host-files')
      assert.ok(
        files.some((file) => isWorkflowFile(file.path)),
        'no scaffolded file is a workflow file of the host'
      )
      assert.equal(isWorkflowFile('README.md'), false)

      const branches = new Set(readTriggers(root).flatMap((trigger) => trigger.branches))
      for (const branch of [profile.branches.production, profile.branches.integration]) {
        assert.ok(branches.has(branch), `no workflow triggers on ${branch}`)
      }
      const jobs = new Set(readJobNames(root).map((job) => job.name))
      for (const check of profile.requiredChecks) {
        assert.ok(jobs.has(check), `no job reports the required check ${check}`)
      }
    }
  },
  {
    name: 'merge guard: recognises the command that merges a pull request',
    run: async (context) => {
      const entry = context.manifest.roles['merge-guard']
      if (!entry) {
        throw new Skip('the merge-guard role is empty (the host protects its branches)')
      }
      const isMerge = await moduleOf(context, 'merge-guard')
      const { mergeCommand, otherCommand } = context.conformance ?? {}
      assert.ok(mergeCommand && otherCommand, 'conformance.json has no mergeCommand and otherCommand')
      assert.equal(isMerge(mergeCommand), true)
      assert.equal(isMerge(otherCommand), false)
    }
  }
]
