import assert from 'node:assert/strict'
import { test } from 'node:test'
import { extractBlock, hashBlock, markers, replaceBlock } from './managed.mjs'

const { start, end } = markers('map')
const file = (content) => `intro\n${start}\n${content}\n${end}\noutro\n`

test('the content of a block is what sits between its markers, without the line breaks next to them', () => {
  assert.equal(extractBlock(file('a\nb'), 'map'), 'a\nb')
  assert.equal(extractBlock(`${start}${end}`, 'map'), '')
  assert.equal(extractBlock('no block here', 'map'), null)
  assert.equal(extractBlock(`${end}\n${start}`, 'map'), null)
  assert.equal(extractBlock(`${start}\n${start}\n${end}`, 'map'), null)
})

test('replacing a block keeps the text around it and can be repeated', () => {
  const once = replaceBlock(file('old'), 'map', 'new\ntext')
  assert.equal(once, file('new\ntext'))
  assert.equal(replaceBlock(once, 'map', 'new\ntext'), once)
  assert.equal(extractBlock(once, 'map'), 'new\ntext')
})

test('a file without the markers is refused, naming them', () => {
  assert.throws(
    () => replaceBlock('plain', 'map', 'x'),
    /<!-- harness:begin map --> and <!-- harness:end map --> are missing/
  )
})

test('the hash of a block is the hash of its content', () => {
  assert.equal(hashBlock('a'), hashBlock('a'))
  assert.notEqual(hashBlock('a'), hashBlock('b'))
})
