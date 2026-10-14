import { PrismaClient } from '@prisma/client'
import { WorldStateBatch, WorldStateStore } from '../application/world-state-store'
import { writeModules } from '../../modules/infrastructure/prisma-module.repository'
import { writeKnownPoints } from '../../map/infrastructure/prisma-map.repository'

export class PrismaWorldStateStore implements WorldStateStore {
  constructor(private readonly client: PrismaClient) {}

  async flush({ mapPoints, knownPoints, modules, items, removedItemIds, headings }: WorldStateBatch): Promise<void> {
    await this.client.$transaction(async (tx) => {
      // Rows travel as one JSON document: typed arrays with NULL elements are not inferred reliably by the driver
      if (mapPoints.length) {
        const rows = mapPoints.map(({ id, location, type, contentId, resource }) => ({
          id,
          ...location,
          type,
          contentId,
          resource: resource?.resource ?? null,
          amount: resource?.amount ?? null
        }))
        await tx.$executeRaw`
          INSERT INTO map_points (id, x, y, z, type, content_id, resource, amount)
          SELECT id, x, y, z, type::map_point_type, "contentId", resource::resource_type, amount
          FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
            AS r(id uuid, x int, y int, z int, type text, "contentId" uuid, resource text, amount int)
          ON CONFLICT (x, y, z) DO UPDATE
            SET type = EXCLUDED.type, content_id = EXCLUDED.content_id, resource = EXCLUDED.resource,
                amount = EXCLUDED.amount`
      }

      await writeKnownPoints(tx, knownPoints)

      if (items.length) {
        await tx.$executeRaw`
          INSERT INTO items (id, type, name, weight, bot_id)
          SELECT id, type::item_type, name, weight, "botId"
          FROM jsonb_to_recordset(${JSON.stringify(items)}::jsonb)
            AS r(id uuid, type text, name text, weight float8, "botId" uuid)
          ON CONFLICT (id) DO UPDATE SET bot_id = EXCLUDED.bot_id, weight = EXCLUDED.weight`
      }

      if (removedItemIds.length) {
        await tx.item.deleteMany({ where: { id: { in: removedItemIds } } })
      }

      if (headings.length) {
        await tx.$executeRaw`
          UPDATE bots SET heading = r.heading
          FROM jsonb_to_recordset(${JSON.stringify(headings)}::jsonb) AS r("botId" uuid, heading int)
          WHERE bots.id = r."botId"`
      }

      await writeModules(tx, modules, true)
    })
  }
}
