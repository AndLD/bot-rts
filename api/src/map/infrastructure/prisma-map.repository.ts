import { KnownPoint as KnownPointRow, MapPoint as MapPointRow, Prisma } from '@prisma/client'
import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { RESOURCE } from '../../../../lib/utils/interfaces/resources'
import { MapRepository } from '../application/map.repository'
import { KnownPoint, Location, LocationRange, MapPoint } from '../domain/map-point.entity'

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

function toKnownRow(point: KnownPoint): KnownPointRow {
  const { x, y, z } = point.location
  return {
    id: point.id,
    userId: point.userId,
    x,
    y,
    z,
    ...contentOf(point),
    seenAt: BigInt(point.seenAt)
  }
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
    for (const point of points) {
      const { id, ...row } = toKnownRow(point)
      await this.db.knownPoint.upsert({
        where: { userId_x_y_z: { userId: row.userId, x: row.x, y: row.y, z: row.z } },
        create: { id, ...row },
        update: {
          type: row.type,
          contentId: row.contentId,
          resource: row.resource,
          amount: row.amount,
          seenAt: row.seenAt
        }
      })
    }
  }

  async findKnownPoint(userId: string, location: Location): Promise<KnownPoint | null> {
    const row = await this.db.knownPoint.findUnique({ where: { userId_x_y_z: { userId, ...location } } })
    return row && toKnownPoint(row)
  }
}
