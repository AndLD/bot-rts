import assert from 'node:assert/strict'
import { test } from 'node:test'
import { portsInUse } from './e2e-lib.mjs'

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
