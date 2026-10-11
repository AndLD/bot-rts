import { convertTimeStringToMilliseconds } from './duration'

describe('convertTimeStringToMilliseconds', () => {
  it.each([
    ['500ms', 500],
    ['10s', 10_000],
    ['5m', 300_000],
    ['24h', 86_400_000],
    ['30d', 2_592_000_000],
    ['soon', 0],
    ['', 0]
  ])('%p -> %p', (input, expected) => {
    expect(convertTimeStringToMilliseconds(input)).toBe(expected)
  })
})
