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
    [1, 'flag', '✓'],
    [0, 'flag', '✗'],
    [4.6, 'count', '5'],
    [3, 'ticks', '3']
  ] as const)('shows %s as %s: %s', (value, unit, expected) => {
    expect(formatMetric(value, unit)).toBe(expected)
  })
})
