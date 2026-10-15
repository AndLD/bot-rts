import { daysBetween, dayOf, retentionOf } from './analytics'

describe('daysBetween', () => {
  it('lists the days from one to the other, both included, across a month end', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
    expect(daysBetween('2026-10-15', '2026-10-15')).toEqual(['2026-10-15'])
    expect(dayOf(new Date('2026-10-15T23:59:59Z'))).toBe('2026-10-15')
  })
})

describe('retentionOf', () => {
  const row = { week: '2026-09-07', size: 4, d1: 2, d7: 1, d30: 1 }

  it('gives the shares of a cohort old enough for all three looks', () => {
    expect(retentionOf(row, '2026-11-01')).toEqual({ cohort: '2026-09-07', size: 4, d1: 0.5, d7: 0.25, d30: 0.25 })
  })

  it('leaves out a look the youngest member has not had yet', () => {
    // The week ends on the 13th: day 1 is the 14th, day 7 the 20th, day 30 October 13th
    expect(retentionOf(row, '2026-09-14')).toMatchObject({ d1: 0.5, d7: null, d30: null })
    expect(retentionOf(row, '2026-09-13')).toMatchObject({ d1: null, d7: null, d30: null })
    expect(retentionOf(row, '2026-09-20')).toMatchObject({ d1: 0.5, d7: 0.25, d30: null })
  })
})
