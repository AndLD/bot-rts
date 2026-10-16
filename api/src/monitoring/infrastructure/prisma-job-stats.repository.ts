import { PrismaClient } from '@prisma/client'
import { JobStatsRepository, NotificationQueue } from '../application/job-stats.repository'

export class PrismaJobStatsRepository implements JobStatsRepository {
  constructor(private readonly client: PrismaClient) {}

  async notificationQueue(): Promise<NotificationQueue> {
    const [row] = await this.client.$queryRaw<Array<{ waiting: bigint; oldest_ms: number | null }>>`
      SELECT count(*) AS waiting,
             (extract(epoch FROM (now() - min(created_at))) * 1000)::float8 AS oldest_ms
        FROM player_notifications
       WHERE delivered_at IS NULL AND created_at <= now()`

    return { waiting: Number(row.waiting), oldestWaitMs: row.oldest_ms === null ? null : Number(row.oldest_ms) }
  }
}
