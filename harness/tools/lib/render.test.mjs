import assert from 'node:assert/strict'
import { test } from 'node:test'
import { placeholderPaths, relativeTo, render, valueAt } from './render.mjs'

const options = { document: 'docs/profile.md' }
const run = (template, context) => render(template, context, options)

test('a placeholder is filled with the value at its dotted path; numbers and lists are written out', () => {
  const context = { a: { b: 'x', n: 97 }, list: ['one', 'two'] }
  assert.equal(run('{{a.b}} {{a.n}} {{list}}', context), 'x 97 one, two')
})

test('a line with a placeholder that has no value is left out, the others stay', () => {
  assert.equal(
    run('keep\n| Role | {{a.missing}} |\nalso {{a.b}}\n| {{empty}} |', { a: { b: 'x' }, empty: '' }),
    'keep\nalso x'
  )
})

test('a value that cites another role is filled in too, and a loop of citations is refused', () => {
  assert.equal(run('{{x}}', { x: 'see {{y.z}}', y: { z: 'there' } }), 'see there')
  assert.throws(() => run('{{x}}', { x: '{{x}}' }), /nest deeper/)
})

test('a structure is not text', () => {
  assert.throws(() => run('{{a}}', { a: { b: 1 } }), /"a" is a structure/)
})

test('link and rel write a path relative to the generated document', () => {
  const context = { doc: { readme: 'README.md', method: 'docs/engineering/method.md', plan: 'docs/plan/README.md' } }
  assert.equal(run('{{rel:doc.readme}}', context), '../README.md')
  assert.equal(run('{{link:doc.readme}}', context), '[`README.md`](../README.md)')
  assert.equal(run('{{link:doc.method}}', context), '[`engineering/method.md`](./engineering/method.md)')
  assert.throws(() => run('{{link:doc}}', { doc: ['a'] }), /not a path/)
  assert.equal(relativeTo('profile.md', 'docs/a.md'), './docs/a.md')
})

test('an if block is kept for a value and dropped for an empty one or a missing one', () => {
  const template = 'before\n{{#if on}}\ninside {{on}}\n{{/if}}\nafter'
  assert.equal(run(template, { on: 'yes' }), 'before\ninside yes\nafter')
  assert.equal(run(template, { on: '' }), 'before\nafter')
  assert.equal(run(template, {}), 'before\nafter')
  assert.equal(run(template, { on: false }), 'before\nafter')
})

test('an each block repeats for every item, with the fields of the item first and the rest of the context behind them', () => {
  const template = '{{#each rows}}\n| {{name}} | {{suffix}} |\n{{/each}}'
  assert.equal(
    run(template, { suffix: 's', rows: [{ name: 'a' }, { name: 'b', suffix: 'own' }] }),
    '| a | s |\n| b | own |'
  )
  assert.equal(run('{{#each rows}}\n{{item}}\n{{/each}}', { rows: ['x', 'y'] }), 'x\ny')
  assert.equal(run(template, { rows: [] }), '')
})

test('blocks nest', () => {
  const template = '{{#each rows}}\n{{#if on}}\n{{name}}\n{{/if}}\n{{/each}}'
  assert.equal(run(template, { rows: [{ name: 'a', on: 1 }, { name: 'b' }, { name: 'c', on: 1 }] }), 'a\nc')
})

test('an unclosed block and a stray closing tag are errors', () => {
  assert.throws(() => run('{{#if a}}\nx', { a: 1 }), /never closed/)
  assert.throws(() => run('x\n{{/if}}', {}), /closing tag without an opening one/)
})

test('valueAt and placeholderPaths read the paths of a context and a template', () => {
  assert.equal(valueAt({ a: { b: 1 } }, 'a.b'), 1)
  assert.equal(valueAt({ a: 1 }, 'a.b.c'), undefined)
  assert.deepEqual(placeholderPaths('{{a.b}} {{link:c.d}}\n{{#if e}}\n{{rel:f}}\n{{/if}}').sort(), [
    'a.b',
    'c.d',
    'e',
    'f'
  ])
})
