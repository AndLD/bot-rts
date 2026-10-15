import { Prisma } from '@prisma/client'
import { DepositTotals, EconomyReadModel } from '../application/ports'

export class PrismaEconomyReadModel implements EconomyReadModel {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async deposits(): Promise<DepositTotals[]> {
    const rows = await this.db.$queryRaw<Array<{ resource: string; deposits: bigint; remaining: bigint }>>`
      SELECT resource::text AS resource,
             COUNT(*) AS deposits,
             COALESCE(SUM(amount), 0) AS remaining
      FROM map_points
      WHERE type = 'resource' AND resource IS NOT NULL
      GROUP BY resource`

    return rows.map((row) => ({
      resource: row.resource,
      deposits: Number(row.deposits),
      remaining: Number(row.remaining)
    }))
  }

  async stored(): Promise<Array<{ resource: string; amount: number }>> {
    const rows = await this.db.$queryRaw<Array<{ resource: string; amount: number }>>`
      SELECT item->>'resource' AS resource, SUM((item->>'amount')::float8) AS amount
      FROM modules m, JSONB_ARRAY_ELEMENTS(
        CASE WHEN JSONB_TYPEOF(m.props->'items') = 'array' THEN m.props->'items' ELSE '[]'::jsonb END
      ) AS item
      WHERE m.type = 'storage'
      GROUP BY item->>'resource'`

    return rows.map((row) => ({ resource: row.resource, amount: Number(row.amount) }))
  }

  async blueprints(): Promise<Array<{ module: string; source: string; players: number }>> {
    const groups = await this.db.blueprint.groupBy({ by: ['module', 'source'], _count: { _all: true } })

    return groups.map((group) => ({ module: group.module, source: group.source, players: group._count._all }))
  }

  async modules(): Promise<Array<{ type: string; name: string; count: number }>> {
    const groups = await this.db.module.groupBy({ by: ['type', 'name'], _count: { _all: true } })

    return groups.map((group) => ({ type: group.type, name: group.name, count: group._count._all }))
  }
}
