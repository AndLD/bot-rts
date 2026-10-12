import { clamp01, seeded } from './painter'

describe('painter helpers', () => {
  it('keeps a number in [0, 1]', () => {
    expect(clamp01(-3)).toBe(0)
    expect(clamp01(0.4)).toBe(0.4)
    expect(clamp01(7)).toBe(1)
  })

  it('gives the same number for the same seed and a different one for another', () => {
    expect(seeded(5, 1)).toBe(seeded(5, 1))
    expect(seeded(5, 1)).not.toBe(seeded(5, 2))
    expect(seeded(5, 1)).toBeGreaterThanOrEqual(0)
    expect(seeded(5, 1)).toBeLessThan(1)
  })
})
