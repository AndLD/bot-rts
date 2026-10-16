import { TICK_BOUNDS_MS } from '../../engine/application/engine-metrics'
import { HTTP_BOUNDS_SECONDS } from '../../metrics/application/http-metrics'
import { addCounts, emptyCounts, histogramOf, HISTOGRAMS, percentileOf } from './histograms'

const api = histogramOf('api.latencyMs') as (typeof HISTOGRAMS)[number]

describe('the histograms', () => {
  it('have the bounds of the code that fills them', () => {
    expect(histogramOf('engine.tickMs')?.boundsMs).toEqual(TICK_BOUNDS_MS)
    expect(histogramOf('api.latencyMs')?.boundsMs).toEqual(HTTP_BOUNDS_SECONDS.map((seconds) => seconds * 1000))
    expect(histogramOf('nothing')).toBeUndefined()
  })

  it('start with a count of zero per bound and one more for what is above them', () => {
    expect(emptyCounts(api)).toHaveLength(api.boundsMs.length + 1)
    expect(emptyCounts(api).every((count) => count === 0)).toBe(true)
  })

  it('add up bucket by bucket', () => {
    expect(addCounts([1, 2, 3], [10, 20, 30])).toEqual([11, 22, 33])
    expect(addCounts([1, 2, 3], [5])).toEqual([6, 2, 3])
  })
})

describe('percentileOf', () => {
  const counts = (entries: Record<number, number>) => {
    const result = emptyCounts(api)
    for (const [index, count] of Object.entries(entries)) result[Number(index)] = count
    return result
  }

  it('is the upper bound of the bucket where the share is reached', () => {
    // 90 requests up to 5 ms, 10 up to 25 ms
    const mixed = counts({ 0: 90, 2: 10 })

    expect(percentileOf(api, mixed, 0.5)).toBe(5)
    expect(percentileOf(api, mixed, 0.9)).toBe(5)
    expect(percentileOf(api, mixed, 0.95)).toBe(25)
    expect(percentileOf(api, mixed, 0.99)).toBe(25)
  })

  it('is the last bound for what is above it or for a quantile past the end, and null for nothing', () => {
    expect(percentileOf(api, counts({ 0: 4 }), 2)).toBe(30000)
    expect(percentileOf(api, counts({ 12: 4 }), 0.95)).toBe(30000)
    expect(percentileOf(api, emptyCounts(api), 0.95)).toBeNull()
  })

  it('comes from the merged buckets of several nodes, not from the average of their percentiles', () => {
    const quick = counts({ 0: 1000 })
    const slow = counts({ 6: 10 })

    // the 95th percentile of the quick node is 5 ms and of the slow one 500 ms; their average, 252 ms, would be wrong for both
    expect(percentileOf(api, quick, 0.95)).toBe(5)
    expect(percentileOf(api, slow, 0.95)).toBe(500)
    expect(percentileOf(api, addCounts(quick, slow), 0.95)).toBe(5)
    expect(percentileOf(api, addCounts(quick, slow), 0.999)).toBe(500)
  })
})
