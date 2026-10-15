import { Prisma } from '@prisma/client'
import { IActivityDay } from '../../../../lib/utils/admin-analytics'
import { AnalyticsReadModel, CohortRow } from '../application/ports'

// Players: live accounts without an admin role. Days are UTC days.
const IS_PLAYER = Prisma.sql`u.deleted_at IS NULL AND u.status NOT IN ('owner', 'admin', 'moderator', 'analyst')`
const SIGNED_UP_ON = Prisma.sql`(u.created_at AT TIME ZONE 'UTC')::date`

export class PrismaAnalyticsReadModel implements AnalyticsReadModel {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async playerCount(): Promise<number> {
    const [row] = await this.db.$queryRaw<Array<{ players: number }>>`
      SELECT COUNT(*)::int AS players FROM users u WHERE ${IS_PLAYER}`

    return row.players
  }

  async dailyActive(from: string): Promise<IActivityDay[]> {
    return this.db.$queryRaw<IActivityDay[]>`
      SELECT a.day::text AS day, COUNT(*)::int AS users
      FROM player_activity a JOIN users u ON u.id = a.user_id
      WHERE ${IS_PLAYER} AND a.day >= ${from}::date
      GROUP BY a.day ORDER BY a.day`
  }

  async activeSince(from: string): Promise<number> {
    const [row] = await this.db.$queryRaw<Array<{ players: number }>>`
      SELECT COUNT(DISTINCT a.user_id)::int AS players
      FROM player_activity a JOIN users u ON u.id = a.user_id
      WHERE ${IS_PLAYER} AND a.day >= ${from}::date`

    return row.players
  }

  async cohorts(since: Date): Promise<CohortRow[]> {
    const back = (days: number) => Prisma.sql`COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM player_activity a WHERE a.user_id = u.id AND a.day = ${SIGNED_UP_ON} + ${days}::int
    ))::int`

    return this.db.$queryRaw<CohortRow[]>`
      SELECT date_trunc('week', u.created_at AT TIME ZONE 'UTC')::date::text AS week,
             COUNT(*)::int AS size,
             ${back(1)} AS d1, ${back(7)} AS d7, ${back(30)} AS d30
      FROM users u
      WHERE ${IS_PLAYER} AND u.created_at >= ${since}
      GROUP BY 1 ORDER BY 1`
  }

  async funnel(since: Date): Promise<number[]> {
    const reached = (counter: string) => Prisma.sql`COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM achievement_counters k WHERE k.user_id = u.id AND k.counter = ${counter} AND k.value > 0
    ))::int`
    const [row] = await this.db.$queryRaw<Array<Record<string, number>>>`
      SELECT COUNT(*)::int AS signed_up,
             COUNT(*) FILTER (WHERE COALESCE(c.email_verified, false))::int AS verified,
             ${reached('basesDeployed')} AS base_deployed,
             ${reached('scriptRuns')} AS first_script,
             ${reached('unitsMined')} AS first_resource,
             ${reached('tutorialsCompleted')} AS tutorial_completed
      FROM users u LEFT JOIN local_credentials c ON c.user_id = u.id
      WHERE ${IS_PLAYER} AND u.created_at >= ${since}`

    return [
      row.signed_up,
      row.verified,
      row.base_deployed,
      row.first_script,
      row.first_resource,
      row.tutorial_completed
    ]
  }

  async achievementUnlocks(): Promise<Array<{ id: string; unlocked: number }>> {
    return this.db.$queryRaw<Array<{ id: string; unlocked: number }>>`
      SELECT n.achievement_id AS id, COUNT(*)::int AS unlocked
      FROM achievement_unlocks n JOIN users u ON u.id = n.user_id
      WHERE ${IS_PLAYER}
      GROUP BY n.achievement_id`
  }
}
