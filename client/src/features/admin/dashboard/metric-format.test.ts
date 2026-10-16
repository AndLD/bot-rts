import { formatMetric } from './metric-format'

describe('formatMetric', () => {
  it.each([
    [null, 'ms', '–'],
    [12.34, 'ms', '12.3 ms'],
    [250.4, 'ms', '250 ms'],
    [0.0123, 'ratio', '1.2 %'],
    [0.5, 'ratio', '50 %'],
    [5 * 1024 * 1024, 'bytes', '5.0 MB'],
    [2.345, 'perSecond', '2.3/s'],
    [2.34, 'number', '2.3'],
    [45, 'seconds', '45 s'],
    [600, 'seconds', '10 min'],
    [10800, 'seconds', '3.0 h'],
    [259200, 'seconds', '3.0 d'],
    [1, 'flag', '✓'],
    [0, 'flag', '✗'],
    [4.6, 'count', '5'],
    [3, 'ticks', '3']
  ] as const)('shows %s as %s: %s', (value, unit, expected) => {
    expect(formatMetric(value, unit)).toBe(expected)
  })
})
