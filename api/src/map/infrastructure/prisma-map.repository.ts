import { KnownPoint as KnownPointRow, MapPoint as MapPointRow, Prisma } from '@prisma/client'
import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { RESOURCE } from '../../../../lib/utils/interfaces/resources'
import { MapRepository } from '../application/map.repository'
import { KnownPoint, Location, LocationRange, MapPoint } from '../domain/map-point.entity'

// The types of a cell that holds a base
const BASE_TYPES = [MapPointType.BASE, MapPointType.CORPSE_BASE]

function toPoint(row: MapPointRow): MapPoint {
  return {
    id: row.id,
    location: { x: row.x, y: row.y, z: row.z },
    type: row.type as MapPointType | null,
    contentId: row.contentId,
    resource: row.resource && row.amount !== null ? { resource: row.resource as RESOURCE, amount: row.amount } : null
  }
}

// The columns of a point's content; the deposit is stored as two nullable columns
function contentOf({ type, contentId, resource }: MapPoint) {
  return { type, contentId, resource: resource?.resource ?? null, amount: resource?.amount ?? null }
}

function toKnownPoint(row: KnownPointRow): KnownPoint {
  const { userId, seenAt } = row
  return { ...toPoint(row), userId, seenAt: Number(seenAt) }
}

function inRange({ from, to }: LocationRange) {
  return { x: { gte: from.x, lte: to.x }, y: { gte: from.y, lte: to.y }, z: { gte: from.z, lte: to.z } }
}

// Inserts or updates the snapshots of what players know in one statement; the rows travel as one JSON document (typed arrays
// with NULL elements are not inferred reliably by the driver). A cell named twice keeps its last snapshot.
export async function writeKnownPoints(db: Prisma.TransactionClient, points: readonly KnownPoint[]): Promise<void> {
  if (!points.length) {
    return
  }
  const latest = new Map(
    points.map((point) => [`${point.userId}:${point.location.x}:${point.location.y}:${point.location.z}`, point])
  )
  const rows = [...latest.values()].map(({ id, userId, location, type, contentId, resource, seenAt }) => ({
    id,
    userId,
    ...location,
    type,
    contentId,
    resource: resource?.resource ?? null,
    amount: resource?.amount ?? null,
    seenAt
  }))
  await db.$executeRaw`
    INSERT INTO known_points (id, user_id, x, y, z, type, content_id, resource, amount, seen_at)
    SELECT id, "userId", x, y, z, type::map_point_type, "contentId", resource::resource_type, amount, "seenAt"
    FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
      AS r(id uuid, "userId" uuid, x int, y int, z int, type text, "contentId" uuid, resource text,
           amount int, "seenAt" bigint)
    ON CONFLICT (user_id, x, y, z) DO UPDATE
      SET type = EXCLUDED.type, content_id = EXCLUDED.content_id, resource = EXCLUDED.resource,
          amount = EXCLUDED.amount, seen_at = EXCLUDED.seen_at`
}

export class PrismaMapRepository implements MapRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async findPointsInRange(range: LocationRange): Promise<MapPoint[]> {
    const rows = await this.db.mapPoint.findMany({
      where: inRange(range),
      orderBy: [{ x: 'asc' }, { y: 'asc' }, { z: 'asc' }]
    })
    return rows.map(toPoint)
  }

  async findPointByContentId(contentId: string): Promise<MapPoint | null> {
    const row = await this.db.mapPoint.findFirst({ where: { contentId } })
    return row && toPoint(row)
  }

  async findBasePointsInRange(range: LocationRange): Promise<MapPoint[]> {
    const rows = await this.db.mapPoint.findMany({ where: { ...inRange(range), type: { in: BASE_TYPES } } })
    return rows.map(toPoint)
  }

  async countBases(): Promise<number> {
    return await this.db.mapPoint.count({ where: { type: { in: BASE_TYPES } } })
  }

  async addPoints(points: MapPoint[]): Promise<void> {
    await this.db.mapPoint.createMany({
      data: points.map((point) => ({ id: point.id, ...point.location, ...contentOf(point) })),
      skipDuplicates: true
    })
  }

  async upsertPoint(point: MapPoint): Promise<MapPoint> {
    const content = contentOf(point)
    const row = await this.db.mapPoint.upsert({
      where: { x_y_z: point.location },
      create: { id: point.id, ...point.location, ...content },
      update: content
    })
    return toPoint(row)
  }

  async findKnownPointsInRange(userId: string, range: LocationRange): Promise<KnownPoint[]> {
    const rows = await this.db.knownPoint.findMany({
      where: { userId, ...inRange(range) },
      orderBy: [{ x: 'asc' }, { y: 'asc' }, { z: 'asc' }]
    })
    return rows.map(toKnownPoint)
  }

  async upsertKnownPoints(points: KnownPoint[]): Promise<void> {
    await writeKnownPoints(this.db, points)
  }

  async findKnownPoint(userId: string, location: Location): Promise<KnownPoint | null> {
    const row = await this.db.knownPoint.findUnique({ where: { userId_x_y_z: { userId, ...location } } })
    return row && toKnownPoint(row)
  }
}
