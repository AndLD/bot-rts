import { bucketize, parseCoordinates } from './heatmap'

describe('bucketize', () => {
  it('counts the samples of each bucket and scales to the busiest', () => {
    const buckets = bucketize(
      [
        { x: 1, y: 1, value: 1 },
        { x: 7, y: 7, value: 1 },
        { x: 9, y: 1, value: 1 },
        { x: -1, y: -1, value: 1 }
      ],
      8,
      'density'
    )

    expect(buckets).toEqual([
      { x: -8, y: -8, value: 1, intensity: 0.5 },
      { x: 0, y: 0, value: 2, intensity: 1 },
      { x: 8, y: 0, value: 1, intensity: 0.5 }
    ])
  })

  it('averages the samples of a bucket for depletion', () => {
    expect(
      bucketize(
        [
          { x: 0, y: 0, value: 1 },
          { x: 1, y: 1, value: 0.5 }
        ],
        8,
        'depletion'
      )
    ).toEqual([{ x: 0, y: 0, value: 0.75, intensity: 1 }])
  })

  it('has no intensity when nothing is there to measure', () => {
    expect(bucketize([], 8, 'activity')).toEqual([])
    expect(bucketize([{ x: 0, y: 0, value: 0 }], 8, 'depletion')).toEqual([{ x: 0, y: 0, value: 0, intensity: 0 }])
  })
})

describe('parseCoordinates', () => {
  it.each([
    ['12,-4', { x: 12, y: -4 }],
    ['12 -4', { x: 12, y: -4 }],
    ['(12, -4)', { x: 12, y: -4 }],
    [' 0,0 ', { x: 0, y: 0 }]
  ])('reads %s', (text, expected) => {
    expect(parseCoordinates(text)).toEqual(expected)
  })

  it.each(['', 'abc', '12', '1,2,3', '1.5,2'])('does not read %s', (text) => {
    expect(parseCoordinates(text)).toBeNull()
  })
})
