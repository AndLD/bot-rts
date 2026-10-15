import { FakeClock } from '../../../tests/fakes/fakes'
import { AnalyticsService } from './analytics.service'
import { AnalyticsReadModel } from './ports'

function setup(overrides: Partial<AnalyticsReadModel> = {}) {
  const calls: Array<[string, unknown]> = []
  const readModel: AnalyticsReadModel = {
    playerCount: async () => 10,
    dailyActive: async (from) => (calls.push(['daily', from]), [{ day: '2026-06-01', users: 4 }]),
    activeSince: async (from) => (calls.push(['month', from]), 6),
    cohorts: async (since) => (calls.push(['cohorts', since]), [{ week: '2026-05-25', size: 4, d1: 2, d7: 1, d30: 1 }]),
    funnel: async () => [10, 9, 8, 7, 6, 5],
    achievementUnlocks: async () => [
      { id: 'b', unlocked: 2 },
      { id: 'a', unlocked: 2 },
      { id: 'c', unlocked: 7 }
    ],
    ...overrides
  }

  return { service: new AnalyticsService(readModel, new FakeClock()), calls }
}

describe('AnalyticsService', () => {
  it('reports the window with every day in it, today as the daily active players, and the month before today', async () => {
    const { service, calls } = setup()

    const report = await service.report(3)

    expect(report.days).toBe(3)
    expect(report.players).toBe(10)
    expect(report.activity).toEqual({
      daily: [
        { day: '2026-05-30', users: 0 },
        { day: '2026-05-31', users: 0 },
        { day: '2026-06-01', users: 4 }
      ],
      dau: 4,
      mau: 6
    })
    expect(calls).toEqual([
      ['daily', '2026-05-30'],
      ['month', '2026-05-03'],
      ['cohorts', new Date('2026-05-30T00:00:00.000Z')]
    ])
  })

  it('works out the retention, the funnel and the achievement shares, the most earned first', async () => {
    const { service } = setup()

    const report = await service.report(30)

    expect(report.retention).toEqual([{ cohort: '2026-05-25', size: 4, d1: 0.5, d7: null, d30: null }])
    expect(report.funnel.map(({ step, users }) => [step, users])).toEqual([
      ['signedUp', 10],
      ['verified', 9],
      ['baseDeployed', 8],
      ['firstScript', 7],
      ['firstResource', 6],
      ['tutorialCompleted', 5]
    ])
    expect(report.achievements).toEqual([
      { id: 'c', unlocked: 7, share: 0.7 },
      { id: 'a', unlocked: 2, share: 0.2 },
      { id: 'b', unlocked: 2, share: 0.2 }
    ])
  })

  it('has no shares when there are no players', async () => {
    const { service } = setup({ playerCount: async () => 0 })

    expect((await service.report(7)).achievements.every(({ share }) => share === 0)).toBe(true)
  })
})
