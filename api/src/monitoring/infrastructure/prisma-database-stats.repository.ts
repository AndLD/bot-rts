import { PrismaClient } from '@prisma/client'
import { ConnectionUse, DatabaseSizes, DatabaseStatsRepository } from '../application/database-stats.repository'

// The statistics views of PostgreSQL; nothing here writes
export class PrismaDatabaseStatsRepository implements DatabaseStatsRepository {
  constructor(private readonly client: PrismaClient) {}

  async connections(): Promise<ConnectionUse> {
    const [row] = await this.client.$queryRaw<Array<{ open: number; max: number }>>`
      SELECT (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database())::int AS open,
             current_setting('max_connections')::int AS max`

    return { open: Number(row.open), max: Number(row.max) }
  }

  async sizes(): Promise<DatabaseSizes> {
    const [row] = await this.client.$queryRaw<Array<{ total: bigint; largest: bigint | null }>>`
      SELECT pg_database_size(current_database()) AS total,
             (SELECT max(pg_total_relation_size(relid)) FROM pg_stat_user_tables) AS largest`

    return { totalBytes: Number(row.total), largestTableBytes: Number(row.largest ?? 0) }
  }
}
