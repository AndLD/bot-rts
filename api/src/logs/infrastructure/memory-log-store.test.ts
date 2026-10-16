import { LogBuffer } from '../../shared/application/log-buffer'
import { MemoryLogStore } from './memory-log-store'

function store() {
  const buffer = new LogBuffer(10)
  const at = (n: number) => new Date(n * 1000)
  buffer.add({ at: at(1), level: 'info', message: 'user u1 deployed bot b1', requestId: 'r1', traceId: 't1' })
  buffer.add({ at: at(2), level: 'warn', message: 'user u2 deployed bot b2', requestId: null, traceId: null })
  buffer.add({ at: at(3), level: 'error', message: 'user u1 lost bot b3', requestId: null, traceId: 't2' })

  return new MemoryLogStore(buffer, 'host:1', 'botrts-api')
}

const page = { limit: 10, offset: 0 }

describe('MemoryLogStore', () => {
  it('returns the newest lines first, with the node and the service, and the capacity of the buffer', async () => {
    const result = await store().search({}, page)

    expect(result.entries.map((entry) => entry.message)).toEqual([
      'user u1 lost bot b3',
      'user u2 deployed bot b2',
      'user u1 deployed bot b1'
    ])
    expect(result.entries[0]).toMatchObject({
      level: 'error',
      traceId: 't2',
      node: 'host:1',
      service: 'botrts-api'
    })
    expect(result).toMatchObject({ total: 3, capacity: 10 })
  })

  it('filters by text, level, request, trace, time, and the ids of a player and a bot', async () => {
    const memory = store()

    expect((await memory.search({ text: 'DEPLOYED' }, page)).total).toBe(2)
    expect((await memory.search({ level: 'warn' }, page)).total).toBe(1)
    expect((await memory.search({ requestId: 'r1' }, page)).entries[0].traceId).toBe('t1')
    expect((await memory.search({ traceId: 't2' }, page)).total).toBe(1)
    expect((await memory.search({ from: new Date(2500) }, page)).total).toBe(1)
    expect((await memory.search({ to: new Date(1500) }, page)).total).toBe(1)
    expect((await memory.search({ userId: 'u1', botId: 'b3' }, page)).total).toBe(1)
    expect((await memory.search({ userId: 'u1' }, { limit: 1, offset: 1 })).entries[0].message).toBe(
      'user u1 deployed bot b1'
    )
  })

  it('knows no other node than itself', async () => {
    const memory = store()

    expect(await memory.nodes()).toEqual([{ id: 'host:1', services: ['botrts-api'] }])
    expect((await memory.search({ node: 'host:1' }, page)).total).toBe(3)
    expect(await memory.search({ node: 'elsewhere:2' }, page)).toEqual({ entries: [], total: 0, capacity: 10 })
  })
})
