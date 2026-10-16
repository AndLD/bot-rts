import { markOf } from './slowest-marks'

const points = [
  [0, 1],
  [60_000, 2],
  [120_000, 3]
]

describe('markOf', () => {
  it('puts each sample on the point nearest to its step', () => {
    expect(
      markOf(points, [
        { at: 10_000, durationMs: 5, traceId: 'a' },
        { at: 119_000, durationMs: 6, traceId: 'b' }
      ])
    ).toEqual([
      { index: 0, sample: { at: 10_000, durationMs: 5, traceId: 'a' } },
      { index: 2, sample: { at: 119_000, durationMs: 6, traceId: 'b' } }
    ])
  })

  it('keeps the slowest when several samples fall on one point', () => {
    const marks = markOf(points, [
      { at: 0, durationMs: 5, traceId: 'a' },
      { at: 5_000, durationMs: 9, traceId: 'b' },
      { at: 8_000, durationMs: 7, traceId: 'c' }
    ])

    expect(marks).toHaveLength(1)
    expect(marks[0].sample.traceId).toBe('b')
  })

  it('has nothing to mark without points or samples', () => {
    expect(markOf([], [{ at: 0, durationMs: 1, traceId: 'a' }])).toEqual([])
    expect(markOf(points, [])).toEqual([])
  })
})
