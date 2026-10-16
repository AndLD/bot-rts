import { InMemoryMetricHistoryRepository } from '../../../tests/fakes/metric-history'
import { emptyCounts, histogramOf } from '../domain/histograms'
import { MetricHistory } from './metric-history'
import { MemoryMetricHistoryStore, PersistentMetricHistoryStore, stepOf } from './metric-history-store'
import { MetricSample } from './ports'

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
const MINUTE = 60_000
const T0 = Date.UTC(2026, 5, 1, 12, 0, 0)
const api = histogramOf('api.latencyMs') as NonNullable<ReturnType<typeof histogramOf>>

const sample = (at: number, values: Record<string, number>, histograms?: MetricSample['histograms']): MetricSample => ({
  at: new Date(at),
  values,
  histograms
})

const counts = (entries: Record<number, number>) => {
  const result = emptyCounts(api)
  for (const [index, count] of Object.entries(entries)) result[Number(index)] = count
  return result
}

function persistent(nodeId: string, repository: InMemoryMetricHistoryRepository, maxUnwritten?: number) {
  return new PersistentMetricHistoryStore(
    new MetricHistory([{ stepMs: 10_000, retentionMs: 7 * 24 * 3_600_000 }]),
    repository,
    nodeId,
    logger,
    maxUnwritten
  )
}

describe('MemoryMetricHistoryStore', () => {
  const store = () =>
    new MemoryMetricHistoryStore(new MetricHistory([{ stepMs: 10_000, retentionMs: 3_600_000 }]), 'host:1')

  it('keeps the history of this node, and has nothing for another', async () => {
    const memory = store()
    await memory.record(sample(T0, { 'engine.up': 1 }))

    expect((await memory.series({ metric: 'engine.up', fromMs: T0 - 1000, toMs: T0 + 1000 })).points).toEqual([[T0, 1]])
    expect(
      (await memory.series({ metric: 'engine.up', fromMs: T0 - 1000, toMs: T0 + 1000, node: 'host:1' })).points
    ).toHaveLength(1)
    expect(await memory.series({ metric: 'engine.up', fromMs: T0 - 1000, toMs: T0 + 1000, node: 'host:2' })).toEqual({
      stepMs: 0,
      points: []
    })
    expect(await memory.nodes()).toEqual(['host:1'])
  })

  it('is retuned like the history it wraps, and has nothing to flush', async () => {
    const memory = store()

    expect(() => memory.retune([3_600_000])).not.toThrow()
    await expect(memory.flush()).resolves.toBeUndefined()
  })
})

describe('stepOf', () => {
  it('widens the step as the range grows', () => {
    const hour = 3_600_000

    expect([1, 6, 24, 24 * 7, 24 * 30].map((hours) => stepOf(hours * hour))).toEqual([
      MINUTE,
      MINUTE,
      5 * MINUTE,
      30 * MINUTE,
      120 * MINUTE
    ])
  })
})

describe('PersistentMetricHistoryStore', () => {
  it('writes a minute when it is over: the sum and the count of each metric, for this node', async () => {
    const repository = new InMemoryMetricHistoryRepository()
    const store = persistent('host:1', repository)

    await store.record(sample(T0, { 'engine.lastTickMs': 10 }))
    await store.record(sample(T0 + 10_000, { 'engine.lastTickMs': 20 }))
    expect(repository.minutes).toEqual([])
    await store.record(sample(T0 + MINUTE, { 'engine.lastTickMs': 30 }))

    expect(repository.minutes).toEqual([
      { node: 'host:1', minute: new Date(T0), metric: 'engine.lastTickMs', sum: 30, count: 2 }
    ])
  })

  it('writes the open minute on flush, and the histograms of the minute with the slowest observation', async () => {
    const repository = new InMemoryMetricHistoryRepository()
    const store = persistent('host:1', repository)
    await store.record(
      sample(T0, {}, { 'api.latencyMs': { counts: counts({ 0: 5 }), slowestMs: 4, slowestTraceId: 'a'.repeat(32) } })
    )
    await store.record(
      sample(
        T0 + 10_000,
        {},
        { 'api.latencyMs': { counts: counts({ 0: 1, 3: 2 }), slowestMs: 40, slowestTraceId: 'b'.repeat(32) } }
      )
    )
    await store.record(
      sample(T0 + 20_000, {}, { 'api.latencyMs': { counts: counts({}), slowestMs: 3, slowestTraceId: 'c'.repeat(32) } })
    )
    await store.record(
      sample(T0 + 30_000, {}, { 'nothing.known': { counts: [1], slowestMs: null, slowestTraceId: null } })
    )

    await store.flush()
    await store.flush()

    expect(repository.histograms).toEqual([
      {
        node: 'host:1',
        minute: new Date(T0),
        histogram: 'api.latencyMs',
        counts: counts({ 0: 6, 3: 2 }),
        slowestMs: 40,
        slowestTraceId: 'b'.repeat(32)
      }
    ])
  })

  it('keeps a minute that could not be written and writes it with the next one', async () => {
    const repository = new InMemoryMetricHistoryRepository()
    const store = persistent('host:1', repository)
    repository.isDown = true

    await store.record(sample(T0, { 'engine.up': 1 }))
    await store.record(sample(T0 + MINUTE, { 'engine.up': 1 }))
    expect(repository.minutes).toEqual([])
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('database down'))
    repository.isDown = false
    await store.record(sample(T0 + 2 * MINUTE, { 'engine.up': 1 }))

    expect(repository.minutes.map((row) => +row.minute)).toEqual([T0, T0 + MINUTE])
  })

  it('forgets the oldest minutes when the repository stays away for long', async () => {
    const repository = new InMemoryMetricHistoryRepository()
    const store = persistent('host:1', repository, 2)
    repository.isDown = true

    for (let minute = 0; minute < 5; minute++) await store.record(sample(T0 + minute * MINUTE, { 'engine.up': 1 }))
    repository.isDown = false
    await store.flush()

    expect(repository.minutes.map((row) => +row.minute)).toEqual([T0 + 3 * MINUTE, T0 + 4 * MINUTE])
  })

  it('reads the averages of every node together, one node, or the live series of this node', async () => {
    const repository = new InMemoryMetricHistoryRepository()
    const first = persistent('host:1', repository)
    const second = persistent('host:2', repository)
    await first.record(sample(T0, { 'engine.lastTickMs': 10 }))
    await second.record(sample(T0, { 'engine.lastTickMs': 30 }))
    await second.record(sample(T0 + 10_000, { 'engine.lastTickMs': 50 }))
    await first.flush()
    await second.flush()
    const range = { metric: 'engine.lastTickMs', fromMs: T0 - 3_600_000, toMs: T0 + 3_600_000 }

    expect(await first.series(range)).toEqual({ stepMs: MINUTE, points: [[T0, 30]] })
    expect((await first.series({ ...range, node: 'host:1' })).points).toEqual([[T0, 10]])
    expect((await first.series({ ...range, node: 'host:2' })).points).toEqual([[T0, 40]])
    expect(await first.nodes(range.fromMs, range.toMs)).toEqual(['host:1', 'host:2'])
    expect(await first.nodes(T0 + 2 * MINUTE, T0 + 3 * MINUTE)).toEqual(['host:1'])
    // the finest tier of this node: ten-second steps, while its memory reaches back to the start of the range
    const live = await first.series({ metric: 'engine.lastTickMs', fromMs: T0 - 5000, toMs: T0 + 5000, node: 'host:1' })
    expect(live).toEqual({ stepMs: 10_000, points: [[T0, 10]] })
  })

  it('works out a percentile from the merged buckets of every node, not from the percentiles of the nodes', async () => {
    const repository = new InMemoryMetricHistoryRepository()
    const quick = persistent('host:1', repository)
    const slow = persistent('host:2', repository)
    await quick.record(
      sample(
        T0,
        { 'api.latencyP95Ms': 5 },
        { 'api.latencyMs': { counts: counts({ 0: 1000 }), slowestMs: 5, slowestTraceId: null } }
      )
    )
    await slow.record(
      sample(
        T0,
        { 'api.latencyP95Ms': 500 },
        { 'api.latencyMs': { counts: counts({ 6: 10 }), slowestMs: 500, slowestTraceId: null } }
      )
    )
    await quick.flush()
    await slow.flush()
    const range = { metric: 'api.latencyP95Ms', fromMs: T0 - 3_600_000, toMs: T0 + 3_600_000 }

    expect((await quick.series(range)).points).toEqual([[T0, 5]])
    expect((await quick.series({ ...range, node: 'host:2' })).points).toEqual([[T0, 500]])
  })

  it('falls back to the averages of a percentile metric when no distribution was kept, and ignores buckets of another shape', async () => {
    const repository = new InMemoryMetricHistoryRepository()
    const store = persistent('host:1', repository)
    await store.record(sample(T0, { 'api.latencyP95Ms': 25 }))
    await store.flush()
    repository.histograms.push({
      node: 'host:1',
      minute: new Date(T0),
      histogram: 'api.latencyMs',
      counts: [1, 2, 3],
      slowestMs: null,
      slowestTraceId: null
    })
    repository.histograms.push({
      node: 'host:1',
      minute: new Date(T0 + MINUTE),
      histogram: 'api.latencyMs',
      counts: counts({}),
      slowestMs: null,
      slowestTraceId: null
    })

    const series = await store.series({ metric: 'api.latencyP95Ms', fromMs: T0 - 3_600_000, toMs: T0 + 3_600_000 })

    expect(series.points).toEqual([[T0, 25]])
  })

  it('retunes how far back its finest tier reaches', () => {
    expect(() =>
      persistent('host:1', new InMemoryMetricHistoryRepository()).retune([3_600_000, 86_400_000])
    ).not.toThrow()
  })
})
