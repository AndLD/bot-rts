import { bannerProblems, isBannerShown } from './maintenance'

const banner = { message: 'Maintenance at noon', startsAt: 1000, endsAt: 5000 }

describe('bannerProblems', () => {
  it('accepts a banner with or without an end', () => {
    expect(bannerProblems(banner)).toEqual([])
    expect(bannerProblems({ ...banner, endsAt: null })).toEqual([])
  })

  it.each([
    [{ ...banner, message: '   ' }, 'The message must have 1 to 300 characters'],
    [{ ...banner, message: 'x'.repeat(301) }, 'The message must have 1 to 300 characters'],
    [{ ...banner, startsAt: NaN }, 'The times must be valid'],
    [{ ...banner, endsAt: Infinity }, 'The times must be valid'],
    [{ ...banner, endsAt: 1000 }, 'The end must be after the start']
  ])('refuses %j', (given, problem) => {
    expect(bannerProblems(given)).toEqual([problem])
  })
})

describe('isBannerShown', () => {
  it('shows a banner from the moment it is set until its end, and never a missing one', () => {
    expect(isBannerShown(null, 0)).toBe(false)
    expect(isBannerShown(banner, 0)).toBe(true)
    expect(isBannerShown(banner, 4999)).toBe(true)
    expect(isBannerShown(banner, 5000)).toBe(false)
    expect(isBannerShown({ ...banner, endsAt: null }, 10 ** 12)).toBe(true)
  })
})
