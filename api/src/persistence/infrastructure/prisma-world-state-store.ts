import { Prisma, PrismaClient } from '@prisma/client'
import { WorldStateBatch, WorldStateStore } from '../application/world-state-store'
import { toModuleRow } from '../../modules/infrastructure/prisma-module.repository'

export class PrismaWorldStateStore implements WorldStateStore {
  constructor(private readonly client: PrismaClient) {}

  async flush({ mapPoints, knownPoints, modules }: WorldStateBatch): Promise<void> {
    await this.client.$transaction(async (tx) => {
      // Rows travel as one JSON document: typed arrays with NULL elements are not inferred reliably by the driver
      if (mapPoints.length) {
        const rows = mapPoints.map(({ id, location, type, contentId }) => ({ id, ...location, type, contentId }))
        await tx.$executeRaw`
          INSERT INTO map_points (id, x, y, z, type, content_id)
          SELECT id, x, y, z, type::map_point_type, "contentId"
          FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
            AS r(id uuid, x int, y int, z int, type text, "contentId" uuid)
          ON CONFLICT (x, y, z) DO UPDATE SET type = EXCLUDED.type, content_id = EXCLUDED.content_id`
      }

      if (knownPoints.length) {
        const rows = knownPoints.map(({ id, userId, location, type, contentId, seenAt }) => ({
          id,
          userId,
          ...location,
          type,
          contentId,
          seenAt
        }))
        await tx.$executeRaw`
          INSERT INTO known_points (id, user_id, x, y, z, type, content_id, seen_at)
          SELECT id, "userId", x, y, z, type::map_point_type, "contentId", "seenAt"
          FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
            AS r(id uuid, "userId" uuid, x int, y int, z int, type text, "contentId" uuid, "seenAt" bigint)
          ON CONFLICT (user_id, x, y, z) DO UPDATE
            SET type = EXCLUDED.type, content_id = EXCLUDED.content_id, seen_at = EXCLUDED.seen_at`
      }

      for (const module of modules) {
        const { id, ...data } = toModuleRow(module) as Prisma.ModuleUncheckedCreateInput
        await tx.module.upsert({ where: { id }, create: { id, ...data }, update: data })
      }
    })
  }
}
