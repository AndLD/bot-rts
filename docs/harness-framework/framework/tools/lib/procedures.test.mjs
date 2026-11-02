import assert from 'node:assert/strict'
import { test } from 'node:test'
import { listProcedures, parseProcedure, renderProcedure } from './procedures.mjs'

const text = (header, body = 'Step one.\n') => `---\n${header}\n---\n\n${body}`

test('a procedure has a name, the trigger it is for, and how it is invoked', () => {
  const procedure = parseProcedure(
    text('name: do-it\ndescription: Use when doing it.\ninvocation: explicit\npaths: a/**, b/*.md'),
    'do-it.md'
  )
  assert.deepEqual(procedure, {
    name: 'do-it',
    description: 'Use when doing it.',
    invocation: 'explicit',
    paths: ['a/**', 'b/*.md'],
    body: 'Step one.\n'
  })
})

test('a header that is missing, incomplete or wrong fails, naming the file', () => {
  assert.throws(() => parseProcedure('no header', 'x.md'), /x\.md: a procedure starts with a frontmatter block/)
  assert.throws(
    () => parseProcedure(text('name: x\ninvocation: auto'), 'x.md'),
    /x\.md: the frontmatter needs "description"/
  )
  assert.throws(
    () => parseProcedure(text('name: X y\ndescription: d\ninvocation: auto'), 'x.md'),
    /must be lowercase words joined by hyphens/
  )
  assert.throws(
    () => parseProcedure(text('name: x\ndescription: d\ninvocation: sometimes'), 'x.md'),
    /invocation must be auto or explicit, not "sometimes"/
  )
})

test('the procedures of the framework are all well formed, and each is named by its file', () => {
  const procedures = listProcedures()
  assert.deepEqual(
    procedures.map(({ name }) => name),
    ['code-review', 'end-session', 'finish-phase', 'harness-review', 'open-pull-request', 'release', 'start-task']
  )
  for (const { description, body, invocation } of procedures) {
    assert.match(description, /^Use when /)
    assert.ok(body.trim().length > 100 && ['auto', 'explicit'].includes(invocation))
  }
})

const profile = {
  commands: { lint: 'run-lint', dbUp: 'db-up', dbMigrate: 'db-migrate', dbSeed: 'db-seed' },
  documents: { method: 'docs/method.md' }
}
const procedure = parseProcedure(
  text(
    'name: p\ndescription: d\ninvocation: auto',
    'Run `{{commands.lint}}`; see {{rel:documents.method}}.\n{{#if commands.dbUp}}\nThen `{{commands.dbUp}}`.\n{{/if}}\n'
  )
)

test('a body is written with the commands and the links of the profile, relative to the file it goes into', () => {
  assert.equal(
    renderProcedure(procedure, profile, '.claude/skills/p/SKILL.md'),
    'Run `run-lint`; see ../../../docs/method.md.\nThen `db-up`.\n'
  )
})

test('a block of an optional role is left out without it, and a required role that is missing is an error naming the procedure and the role', () => {
  assert.equal(
    renderProcedure(procedure, { ...profile, commands: { lint: 'run-lint' } }, 'x.md'),
    'Run `run-lint`; see docs/method.md.\n'.replace('docs/method.md', './docs/method.md')
  )
  assert.throws(
    () => renderProcedure(procedure, { documents: profile.documents }, 'x.md'),
    /the procedure "p" needs the profile roles commands\.lint/
  )
})
