import { MetricHistory } from './metric-history'

const SEC = 1000
const tiers = [
  { stepMs: 10 * SEC, retentionMs: 50 * SEC },
  { stepMs: 60 * SEC, retentionMs: 600 * SEC }
]

describe('MetricHistory', () => {
  it('returns the samples of the range from the finest tier, oldest first', () => {
    const history = new MetricHistory(tiers)
    for (let i = 0; i < 4; i += 1) {
      history.record(i * 10 * SEC, { a: i, b: i * 2 })
    }

    expect(history.series('a', 0, 100 * SEC)).toEqual({
      stepMs: 10 * SEC,
      points: [
        [0, 0],
        [10 * SEC, 1],
        [20 * SEC, 2],
        [30 * SEC, 3]
      ]
    })
    expect(history.series('a', 10 * SEC, 20 * SEC).points).toEqual([
      [10 * SEC, 1],
      [20 * SEC, 2]
    ])
    expect(history.series('missing', 0, 100 * SEC).points).toEqual([])
  })

  it('keeps only the retention of a tier and falls back to the coarse tier for older ranges', () => {
    const history = new MetricHistory(tiers)
    // 20 samples of 10 s: the fine tier holds the last 5; the coarse tier gets one-minute averages
    for (let i = 0; i < 20; i += 1) {
      history.record(i * 10 * SEC, { a: i })
    }

    const recent = history.series('a', 150 * SEC, 200 * SEC)
    expect(recent.stepMs).toBe(10 * SEC)
    expect(recent.points).toHaveLength(5)

    const old = history.series('a', 0, 200 * SEC)
    expect(old.stepMs).toBe(60 * SEC)
    // minute 0 holds samples 0..5 (average 2.5), minute 1 holds 6..11 (8.5); the open minute is not flushed yet
    expect(old.points.slice(0, 2)).toEqual([
      [0, 2.5],
      [60 * SEC, 8.5]
    ])
  })

  it('uses the fine tier for a range that starts before the process did, until the coarse tier gains a lot more', () => {
    const history = new MetricHistory(tiers)
    history.record(5 * SEC, { a: 1 })

    expect(history.series('a', 0, 100 * SEC)).toEqual({ stepMs: 10 * SEC, points: [[5 * SEC, 1]] })

    // 20 minutes of samples: the fine tier keeps only the last 50 s, the coarse tier reaches back to the start
    for (let i = 0; i < 120; i += 1) {
      history.record(i * 10 * SEC, { a: i })
    }
    expect(history.series('a', 0, 1300 * SEC).stepMs).toBe(60 * SEC)
  })

  it('leaves a gap for a metric missing from a sample and starts new metrics late', () => {
    const history = new MetricHistory(tiers)
    history.record(0, { a: 1 })
    history.record(10 * SEC, { a: 2, b: 5 })
    history.record(20 * SEC, { b: 6 })

    expect(history.series('a', 0, 30 * SEC).points).toEqual([
      [0, 1],
      [10 * SEC, 2]
    ])
    expect(history.series('b', 0, 30 * SEC).points).toEqual([
      [10 * SEC, 5],
      [20 * SEC, 6]
    ])
  })

  it('works with a single tier and an empty history', () => {
    const history = new MetricHistory([{ stepMs: SEC, retentionMs: 3 * SEC }])

    expect(history.series('a', 0, 10 * SEC)).toEqual({ stepMs: SEC, points: [] })
    for (let i = 0; i < 5; i += 1) {
      history.record(i * SEC, { a: i })
    }
    expect(history.series('a', 0, 10 * SEC).points.map(([, value]) => value)).toEqual([2, 3, 4])
  })

  describe('retune', () => {
    it('keeps the newest points when a tier is made smaller, and room for more when it is made larger', () => {
      const history = new MetricHistory(tiers)
      for (let i = 0; i < 5; i += 1) {
        history.record(i * 10 * SEC, { a: i })
      }

      history.retune([20 * SEC, 600 * SEC])
      expect(history.series('a', 0, 100 * SEC).points).toEqual([
        [30 * SEC, 3],
        [40 * SEC, 4]
      ])

      history.retune([100 * SEC, 600 * SEC])
      history.record(50 * SEC, { a: 5, b: 1 })
      expect(history.series('a', 0, 100 * SEC).points.map(([, value]) => value)).toEqual([3, 4, 5])
      expect(history.series('b', 0, 100 * SEC).points).toEqual([[50 * SEC, 1]])
    })

    it('changes nothing when the sizes are the same, and drops gaps of a metric that was missing', () => {
      const history = new MetricHistory(tiers)
      history.record(0, { a: 1 })
      history.record(10 * SEC, { b: 2 })

      history.retune([50 * SEC, 600 * SEC])
      expect(history.series('a', 0, 100 * SEC).points).toEqual([[0, 1]])

      history.retune([30 * SEC, 600 * SEC])
      expect(history.series('a', 0, 100 * SEC).points).toEqual([[0, 1]])
      expect(history.series('b', 0, 100 * SEC).points).toEqual([[10 * SEC, 2]])
    })
  })
})
