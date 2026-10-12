import { ageAlpha, ageSeconds, DEFAULT_AGING } from './aging'

describe('aging', () => {
  it('keeps a fresh snapshot at full strength', () => {
    expect(ageAlpha(0)).toBe(1)
    expect(ageAlpha(DEFAULT_AGING.fullTicks)).toBe(1)
  })

  it('fades to the minimum and no further', () => {
    const { fullTicks, fadeTicks, minAlpha } = DEFAULT_AGING

    expect(ageAlpha(fullTicks + fadeTicks / 2)).toBeCloseTo((1 + minAlpha) / 2)
    expect(ageAlpha(fullTicks + fadeTicks)).toBeCloseTo(minAlpha)
    expect(ageAlpha(1e9)).toBeCloseTo(minAlpha)
  })

  it('tells the age in seconds', () => {
    expect(ageSeconds(30, 10, 100)).toBe(2)
    expect(ageSeconds(10, 30, 100)).toBe(0)
  })
})
