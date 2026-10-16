import { createTestDatabase, TestDatabase } from '../../../tests/integration/test-database'
import { PrismaMetricHistoryRepository } from './prisma-metric-history.repository'

let database: TestDatabase
let repository: PrismaMetricHistoryRepository

const MINUTE = 60_000
const T0 = Date.UTC(2026, 5, 1, 12, 0, 0)
const minute = (offset: number) => new Date(T0 + offset * MINUTE)

beforeAll(async () => {
  database = await createTestDatabase()
  repository = new PrismaMetricHistoryRepository(database.client)
})
beforeEach(() => database.reset())
afterAll(() => database.drop())

describe('PrismaMetricHistoryRepository', () => {
  it('writes a minute once: a repeated write changes nothing', async () => {
    const row = { node: 'a', minute: minute(0), metric: 'm', sum: 10, count: 2 }

    await repository.saveMinutes([row])
    await repository.saveMinutes([row, { ...row, minute: minute(1) }])

    expect(await database.client.metricMinute.count()).toBe(2)
    expect((await database.client.metricMinute.findFirstOrThrow({ where: { minute: minute(0) } })).sum).toBe(10)
  })

  it('merges the minutes of the nodes into steps: sums and counts, so that an average is weighted', async () => {
    await repository.saveMinutes([
      { node: 'a', minute: minute(0), metric: 'm', sum: 10, count: 1 },
      { node: 'b', minute: minute(0), metric: 'm', sum: 60, count: 5 },
      { node: 'a', minute: minute(1), metric: 'm', sum: 20, count: 2 },
      { node: 'a', minute: minute(7), metric: 'm', sum: 8, count: 1 },
      { node: 'a', minute: minute(0), metric: 'other', sum: 999, count: 1 }
    ])
    const range = [T0 - MINUTE, T0 + 10 * MINUTE] as const

    expect(await repository.readMinutes('m', ...range, MINUTE)).toEqual([
      { at: T0, sum: 70, count: 6 },
      { at: T0 + MINUTE, sum: 20, count: 2 },
      { at: T0 + 7 * MINUTE, sum: 8, count: 1 }
    ])
    expect(await repository.readMinutes('m', ...range, 5 * MINUTE)).toEqual([
      { at: Math.floor(T0 / (5 * MINUTE)) * 5 * MINUTE, sum: 90, count: 8 },
      { at: Math.floor((T0 + 7 * MINUTE) / (5 * MINUTE)) * 5 * MINUTE, sum: 8, count: 1 }
    ])
    expect(await repository.readMinutes('m', ...range, 5 * MINUTE, 'b')).toEqual([
      { at: Math.floor(T0 / (5 * MINUTE)) * 5 * MINUTE, sum: 60, count: 5 }
    ])
    expect(await repository.readMinutes('m', T0 + 100 * MINUTE, T0 + 200 * MINUTE, MINUTE)).toEqual([])
  })

  it('writes and reads the distributions of the minutes, per node, with the slowest observation', async () => {
    const row = {
      node: 'a',
      minute: minute(0),
      histogram: 'api.latencyMs',
      counts: [1, 2, 3],
      slowestMs: 40,
      slowestTraceId: 't1'
    }

    await repository.saveHistograms([
      row,
      { ...row, node: 'b', counts: [4, 5, 6], slowestMs: null, slowestTraceId: null }
    ])
    await repository.saveHistograms([row])

    const all = await repository.readHistograms('api.latencyMs', T0 - MINUTE, T0 + MINUTE)
    expect(all).toHaveLength(2)
    expect(all).toContainEqual({ minute: T0, counts: [1, 2, 3], slowestMs: 40, slowestTraceId: 't1' })
    expect(await repository.readHistograms('api.latencyMs', T0 - MINUTE, T0 + MINUTE, 'b')).toEqual([
      { minute: T0, counts: [4, 5, 6], slowestMs: null, slowestTraceId: null }
    ])
    expect(await repository.readHistograms('engine.tickMs', T0 - MINUTE, T0 + MINUTE)).toEqual([])
  })

  it('names the nodes that wrote in a range', async () => {
    await repository.saveMinutes([
      { node: 'b', minute: minute(0), metric: 'm', sum: 1, count: 1 },
      { node: 'a', minute: minute(0), metric: 'm', sum: 1, count: 1 },
      { node: 'a', minute: minute(1), metric: 'm', sum: 1, count: 1 },
      { node: 'c', minute: minute(50), metric: 'm', sum: 1, count: 1 }
    ])

    expect(await repository.nodes(T0 - MINUTE, T0 + 5 * MINUTE)).toEqual(['a', 'b'])
    expect(await repository.nodes(T0 + 40 * MINUTE, T0 + 60 * MINUTE)).toEqual(['c'])
  })
})
