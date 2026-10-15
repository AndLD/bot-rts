import { ACTIVITY_MONTH_DAYS, FUNNEL_STEPS, IAnalytics } from '../../../../lib/utils/admin-analytics'
import { Clock } from '../../shared/application/clock'
import { daysBetween, dayOf, retentionOf } from '../domain/analytics'
import { AnalyticsReadModel } from './ports'

const DAY_MS = 24 * 60 * 60 * 1000

// The Analytics page (design §25.3): daily and monthly active players, retention of weekly cohorts, the onboarding funnel and the share of
// players who earned each achievement
export class AnalyticsService {
  constructor(
    private readonly readModel: AnalyticsReadModel,
    private readonly clock: Clock
  ) {}

  async report(days: number): Promise<IAnalytics> {
    const now = this.clock.now()
    const today = dayOf(now)
    const from = dayOf(new Date(now.getTime() - (days - 1) * DAY_MS))
    const monthStart = dayOf(new Date(now.getTime() - (ACTIVITY_MONTH_DAYS - 1) * DAY_MS))
    const since = new Date(`${from}T00:00:00.000Z`)
    const [players, active, mau, cohorts, funnel, unlocks] = await Promise.all([
      this.readModel.playerCount(),
      this.readModel.dailyActive(from),
      this.readModel.activeSince(monthStart),
      this.readModel.cohorts(since),
      this.readModel.funnel(since),
      this.readModel.achievementUnlocks()
    ])
    const daily = daysBetween(from, today).map((day) => ({
      day,
      users: active.find((entry) => entry.day === day)?.users ?? 0
    }))

    return {
      days,
      players,
      activity: { daily, dau: daily[daily.length - 1].users, mau },
      retention: cohorts.map((row) => retentionOf(row, today)),
      funnel: FUNNEL_STEPS.map((step, index) => ({ step, users: funnel[index] })),
      achievements: unlocks
        .map(({ id, unlocked }) => ({ id, unlocked, share: players ? unlocked / players : 0 }))
        .sort((a, b) => b.unlocked - a.unlocked || a.id.localeCompare(b.id))
    }
  }
}
