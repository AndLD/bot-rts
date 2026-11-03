import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { answer, readEvent, runHook } from './io.mjs'

// The samples are the adapters' own (their conformance suites replay them); the Cursor ones are written from its documentation
const SAMPLES = {
  'claude-code': join(import.meta.dirname, '..', '..', 'adapters', 'runtime', 'claude-code', 'events'),
  cursor: join(import.meta.dirname, '..', '..', 'adapters', 'runtime', 'cursor', 'events')
}
const sample = (runtime, name) => readFileSync(join(SAMPLES[runtime], name), 'utf8')

test('the events of Claude Code are read by what they do', () => {
  assert.deepEqual(readEvent(sample('claude-code', 'bash-push-main.json')), {
    runtime: 'claude-code',
    kind: 'shell',
    command: 'git push origin main',
    cwd: '/project',
    name: 'PreToolUse'
  })
  assert.equal(readEvent(sample('claude-code', 'write-env.json')).kind, 'edit-before')
  assert.equal(readEvent(sample('claude-code', 'write-env.json')).path, '/project/api/.env')
  assert.equal(readEvent(sample('claude-code', 'after-edit.json')).kind, 'edit-after')
  assert.equal(readEvent(sample('claude-code', 'session-start.json')).kind, 'session-start')
})

test('the events of Cursor, native and compat, are read as the same kinds, and recognised by cursor_version', () => {
  const shell = readEvent(sample('cursor', 'before-shell-push-main.json'))
  assert.deepEqual(
    [shell.runtime, shell.kind, shell.command, shell.cwd],
    ['cursor', 'shell', 'git push origin main', '/project']
  )
  assert.deepEqual(
    ['edit-before', '/project/api/.env'],
    [
      readEvent(sample('cursor', 'pre-tool-write-env.json')).kind,
      readEvent(sample('cursor', 'pre-tool-write-env.json')).path
    ]
  )
  assert.equal(readEvent(sample('cursor', 'after-file-edit.json')).kind, 'edit-after')
  assert.equal(readEvent(sample('cursor', 'session-start.json')).kind, 'session-start')
  const compat = readEvent(sample('cursor', 'compat-bash-push-main.json'))
  assert.deepEqual([compat.runtime, compat.kind, compat.command], ['cursor', 'shell', 'git push origin main'])
})

test('an event that is not for a hook is nothing, and a hook script fills in an event that does not name itself', () => {
  assert.equal(readEvent('not json'), null)
  assert.equal(readEvent('[]'), null)
  assert.equal(readEvent(JSON.stringify({ hook_event_name: 'Stop' })), null)
  assert.equal(
    readEvent(JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: '/x' } })),
    null
  )
  assert.deepEqual(readEvent(JSON.stringify({ tool_input: { command: 'ls' }, cwd: '/p' }), 'shell').command, 'ls')
  assert.equal(readEvent(JSON.stringify({ tool_input: { file_path: '/p/a.ts' } }), 'edit-before').path, '/p/a.ts')
  assert.equal(readEvent(JSON.stringify({ tool_input: {} }), 'shell'), null)
  assert.equal(readEvent('', 'session-start').kind, 'session-start', 'a session start needs no input')
})

test('Claude Code is answered with an exit code and stderr, and its context goes to standard output', () => {
  const event = { runtime: 'claude-code', kind: 'shell' }
  assert.deepEqual(answer(event, { block: 'No.' }), { code: 2, stdout: '', stderr: 'No.\n' })
  assert.deepEqual(answer(event, {}), { code: 0, stdout: '', stderr: '' })
  assert.deepEqual(answer({ runtime: 'claude-code', kind: 'session-start' }, { context: 'Branch: x' }), {
    code: 0,
    stdout: 'Branch: x\n',
    stderr: ''
  })
})

test('Cursor is answered in JSON: permission deny with the message, additional_context for a session start, allow otherwise', () => {
  const denied = answer({ runtime: 'cursor', kind: 'shell' }, { block: 'No.' })
  assert.equal(denied.code, 2)
  assert.deepEqual(JSON.parse(denied.stdout), { permission: 'deny', user_message: 'No.', agent_message: 'No.' })
  assert.deepEqual(JSON.parse(answer({ runtime: 'cursor', kind: 'session-start' }, { context: 'Branch: x' }).stdout), {
    additional_context: 'Branch: x'
  })
  assert.deepEqual(JSON.parse(answer({ runtime: 'cursor', kind: 'shell' }, {}).stdout), { permission: 'allow' })
  assert.equal(answer({ runtime: 'cursor', kind: 'edit-after' }, {}).stdout, '')
})

// A hook run with a fake standard input and output
async function run(decide, input, kind = 'shell') {
  const out = []
  const err = []
  let code = 0
  const stdin = (async function* () {
    yield input
  })()
  stdin.setEncoding = () => {}
  await runHook(decide, {
    kind,
    stdin,
    stdout: { write: (text) => out.push(text) },
    stderr: { write: (text) => err.push(text) },
    exit: (value) => (code = value)
  })
  return { code, out: out.join(''), err: err.join('') }
}

test('runHook answers, and a hook that throws or cannot read its event lets the call proceed', async () => {
  const refused = await run(() => ({ block: 'No.' }), sample('claude-code', 'bash-ls.json'))
  assert.deepEqual([refused.code, refused.err], [2, 'No.\n'])
  assert.deepEqual(
    await run(
      () => {
        throw new Error('boom')
      },
      sample('claude-code', 'bash-ls.json')
    ),
    { code: 0, out: '', err: '' }
  )
  assert.deepEqual(await run(() => ({ block: 'No.' }), 'not json'), { code: 0, out: '', err: '' })
})
