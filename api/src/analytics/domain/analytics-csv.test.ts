import { IAnalytics } from '../../../../lib/utils/admin-analytics'
import { analyticsCsv } from './analytics-csv'

const analytics: IAnalytics = {
  days: 7,
  players: 10,
  activity: {
    daily: [
      { day: '2026-10-14', users: 3 },
      { day: '2026-10-15', users: 4 }
    ],
    dau: 4,
    mau: 6
  },
  retention: [
    { cohort: '2026-10-12', size: 5, d1: 0.4, d7: null, d30: null },
    { cohort: '2026-10-05', size: 3, d1: 1 / 3, d7: 0, d30: null }
  ],
  funnel: [
    { step: 'signedUp', users: 10 },
    { step: 'verified', users: 8 }
  ],
  achievements: [{ id: 'firstSteps', unlocked: 7, share: 0.7 }]
}

describe('analyticsCsv', () => {
  it('writes each report with a header, and shares as percentages with an empty cell where unknown', () => {
    expect(analyticsCsv('activity', analytics)).toBe('day,active players\n2026-10-14,3\n2026-10-15,4\n')
    expect(analyticsCsv('retention', analytics)).toBe(
      'cohort (week starting),players,day 1 %,day 7 %,day 30 %\n2026-10-12,5,40,,\n2026-10-05,3,33.3,0,\n'
    )
    expect(analyticsCsv('funnel', analytics)).toBe('step,players\nsignedUp,10\nverified,8\n')
    expect(analyticsCsv('achievements', analytics)).toBe('achievement,players,share of players %\nfirstSteps,7,70\n')
  })
})
