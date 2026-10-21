import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readdirSync, readFileSync } from 'node:fs'
import { portsInUse, parseShard, specsOfShard } from './e2e-lib.mjs'

test('portsInUse names the ports that a process listens on, in the order given', () => {
  const listening = (port) => (port === 18080 ? [4242] : port === 5173 ? [1, 2] : [])
  assert.deepEqual(portsInUse([18080, 15173, 5173], listening), [18080, 5173])
})

test('portsInUse is empty when every port is free', () => {
  assert.deepEqual(
    portsInUse([18080, 15173], () => []),
    []
  )
})

test('parseShard reads index/count and rejects anything else', () => {
  assert.deepEqual(parseShard('2/4'), { index: 2, count: 4 })
  for (const bad of [undefined, '', '4', '0/4', '5/4', 'a/b', '1/4/2']) {
    assert.throws(() => parseShard(bad), /Bad --shard/)
  }
})

const durations = { 'a.cy.ts': 30, 'b.cy.ts': 20, 'c.cy.ts': 20, 'd.cy.ts': 10, 'e.cy.ts': 10, 'f.cy.ts': 10 }
const specs = Object.keys(durations)
const shardsOf = (list, times, count) =>
  Array.from({ length: count }, (_, i) => specsOfShard(list, times, { index: i + 1, count }))

test('specsOfShard gives every spec to exactly one shard', () => {
  const shards = shardsOf(specs, durations, 3)
  assert.deepEqual(shards.flat().sort(), specs)
})

test('specsOfShard balances the recorded durations', () => {
  const totals = shardsOf(specs, durations, 3).map((shard) => shard.reduce((sum, spec) => sum + durations[spec], 0))
  assert.deepEqual(totals.sort(), [30, 30, 40])
})

test('specsOfShard does not depend on the order of the specs', () => {
  assert.deepEqual(shardsOf([...specs].reverse(), durations, 3), shardsOf(specs, durations, 3))
})

test('specsOfShard counts a spec without a recorded duration as the median, and ignores a recorded spec that is gone', () => {
  const shards = shardsOf([...specs, 'new.cy.ts'], { ...durations, 'gone.cy.ts': 999 }, 3)
  assert.deepEqual(shards.flat().sort(), [...specs, 'new.cy.ts'].sort())
  assert.ok(shards.every((shard) => shard.length >= 2))
})

test('specsOfShard with no recorded durations still splits the specs', () => {
  assert.deepEqual(shardsOf(['x.cy.ts', 'y.cy.ts'], {}, 2), [['x.cy.ts'], ['y.cy.ts']])
})

test('the recorded durations cover the specs of the suite, so the shards are even', () => {
  const recorded = JSON.parse(readFileSync(new URL('./e2e-durations.json', import.meta.url), 'utf8'))
  const present = readdirSync(new URL('../client/cypress/e2e', import.meta.url)).filter((name) =>
    name.endsWith('.cy.ts')
  )
  assert.deepEqual(
    present.filter((spec) => recorded[spec] === undefined),
    [],
    'add the spec to scripts/e2e-durations.json (seconds, from the Cypress summary of a CI run)'
  )
})
