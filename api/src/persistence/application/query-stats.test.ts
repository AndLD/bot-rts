import { QUERY_BOUNDS_MS, QueryStats } from './query-stats'

const at = new Date('2026-10-16T10:00:00Z')

describe('QueryStats', () => {
  it('counts the queries per duration bucket, with one bucket above the last bound', () => {
    const stats = new QueryStats(1000, () => at)

    for (const ms of [0.4, 1, 3, 3, 99, 5000]) stats.observe(ms, 'SELECT 1')

    const { count, buckets, slowCount } = stats.snapshot()
    expect(count).toBe(6)
    expect(buckets).toHaveLength(QUERY_BOUNDS_MS.length + 1)
    expect(buckets.slice(0, 3)).toEqual([2, 0, 2])
    expect(buckets[QUERY_BOUNDS_MS.indexOf(100)]).toBe(1)
    expect(buckets[buckets.length - 1]).toBe(1)
    expect(slowCount).toBe(1)
  })

  it('keeps the newest slow queries, without the rest of a long statement', () => {
    const stats = new QueryStats(100, () => at, 2)

    stats.observe(50, 'SELECT fast')
    stats.observe(150, 'SELECT first')
    stats.observe(900, `SELECT ${'x'.repeat(2000)}`)
    stats.observe(400, 'SELECT third')

    const slow = stats.slowQueries()
    expect(slow.map((query) => [query.durationMs, query.at])).toEqual([
      [400, at],
      [900, at]
    ])
    expect(slow[0].statement).toBe('SELECT third')
    expect(stats.snapshot().slowCount).toBe(3)
    expect(slow[1].statement).toHaveLength(500)
    slow[0].durationMs = 1
    expect(stats.slowQueries()[0].durationMs).toBe(400)
  })
})
