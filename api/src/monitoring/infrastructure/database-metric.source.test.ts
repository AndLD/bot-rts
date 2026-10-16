import { FakeClock } from '../../../tests/fakes/fakes'
import { QueryStats } from '../../persistence/application/query-stats'
import { DatabaseStatsRepository } from '../application/database-stats.repository'
import { DatabaseMetricSource } from './database-metric.source'

const HOUR = 3_600_000

function setup(sizeEveryMs = 5 * 60_000) {
  const clock = new FakeClock()
  const queries = new QueryStats(100, () => clock.now())
  const state = { open: 10, max: 100, total: 1000, largest: 400 }
  const repository: DatabaseStatsRepository = {
    connections: jest.fn(async () => ({ open: state.open, max: state.max })),
    sizes: jest.fn(async () => ({ totalBytes: state.total, largestTableBytes: state.largest }))
  }
  const source = new DatabaseMetricSource(queries, repository, clock, sizeEveryMs)
  const advance = (ms: number) => (clock.current = new Date(clock.current.getTime() + ms))

  return { clock, queries, state, repository, source, advance }
}

describe('DatabaseMetricSource', () => {
  it('reports the connections and the sizes at the first reading, and nothing that needs an earlier one', async () => {
    const { source } = setup()

    const { values, histograms } = await source.read()

    expect(values).toEqual({
      'database.connections': 10,
      'database.connectionsRatio': 0.1,
      'database.sizeBytes': 1000,
      'database.largestTableBytes': 400
    })
    expect(histograms).toBeUndefined()
  })

  it('works out the rate, the slow queries and the percentiles of the period, with the buckets', async () => {
    const { source, queries, advance } = setup()
    await source.read()
    advance(10_000)
    for (const ms of [1, 1, 1, 1, 1, 1, 1, 1, 1, 300]) queries.observe(ms, 'SELECT 1')

    const { values, histograms } = await source.read()

    expect(values).toMatchObject({
      'database.queriesPerSecond': 1,
      'database.slowQueries': 1,
      'database.queryP50Ms': 1,
      'database.queryP95Ms': 500,
      'database.queryP99Ms': 500
    })
    expect(histograms?.['db.queryMs']).toMatchObject({ slowestMs: 300 })
    expect(histograms?.['db.queryMs'].counts.reduce((sum, count) => sum + count, 0)).toBe(10)
  })

  it('keeps no distribution for a period without queries', async () => {
    const { source, advance } = setup()
    await source.read()
    advance(10_000)

    const { values, histograms } = await source.read()

    expect(values['database.queriesPerSecond']).toBe(0)
    expect(histograms).toBeUndefined()
  })

  it('reads the sizes every few minutes only, and tells the growth once an hour has passed', async () => {
    const { source, repository, state, advance } = setup()
    await source.read()
    advance(60_000)
    await source.read()
    expect(repository.sizes).toHaveBeenCalledTimes(1)

    advance(5 * 60_000)
    state.total = 1000 + 100
    expect((await source.read()).values['database.growthBytesPerDay']).toBeUndefined()
    expect(repository.sizes).toHaveBeenCalledTimes(2)

    advance(HOUR)
    state.total = 1000 + 2400
    const { values } = await source.read()
    expect(values['database.sizeBytes']).toBe(3400)
    expect(values['database.growthBytesPerDay']).toBeCloseTo(((3400 - 1000) / (HOUR + 6 * 60_000)) * 24 * HOUR)
  })

  it('has a ratio of zero for a server that reports no maximum', async () => {
    const { source, state } = setup()
    state.max = 0

    expect((await source.read()).values['database.connectionsRatio']).toBe(0)
  })
})
