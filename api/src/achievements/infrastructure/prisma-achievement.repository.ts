import { PrismaClient } from '@prisma/client'
import { AchievementRepository, AchievementUnlockRecord } from '../application/achievement.repository'
import { COUNTERS, Counter } from '../domain/achievement-definitions'

type Totals = Partial<Record<Counter, number>>

const isCounter = (value: string): value is Counter => (COUNTERS as readonly string[]).includes(value)

export class PrismaAchievementRepository implements AchievementRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly now: () => Date = () => new Date()
  ) {}

  async addToCounters(userId: string, deltas: Totals): Promise<Totals> {
    const totals: Totals = {}
    const updatedAt = this.now()

    for (const [counter, amount] of Object.entries(deltas) as [Counter, number][]) {
      const row = await this.db.achievementCounter.upsert({
        where: { userId_counter: { userId, counter } },
        create: { userId, counter, value: amount, updatedAt },
        update: { value: { increment: amount }, updatedAt }
      })
      totals[counter] = Number(row.value)
    }

    return totals
  }

  async counters(userId: string): Promise<Totals> {
    const rows = await this.db.achievementCounter.findMany({ where: { userId } })

    return Object.fromEntries(
      rows.filter((row) => isCounter(row.counter)).map((row) => [row.counter, Number(row.value)])
    )
  }

  async unlocks(userId: string): Promise<AchievementUnlockRecord[]> {
    const rows = await this.db.achievementUnlock.findMany({ where: { userId }, orderBy: { unlockedAt: 'asc' } })

    return rows.map((row) => ({ achievementId: row.achievementId, unlockedAt: row.unlockedAt }))
  }

  async unlock(userId: string, achievementId: string, at: Date): Promise<boolean> {
    const { count } = await this.db.achievementUnlock.createMany({
      data: [{ userId, achievementId, unlockedAt: at }],
      skipDuplicates: true
    })

    return count === 1
  }
}
