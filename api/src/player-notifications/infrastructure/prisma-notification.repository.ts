import { Prisma, PlayerNotification as Row, PrismaClient } from '@prisma/client'
import {
  NOTIFICATION_CATEGORIES,
  NotificationCategory,
  NotificationParams
} from '../../../../lib/utils/interfaces/notifications'
import { ListQuery, NotificationRepository } from '../application/notification.repository'
import { Notification } from '../domain/notification'

const isCategory = (value: string): value is NotificationCategory =>
  (NOTIFICATION_CATEGORIES as readonly string[]).includes(value)

function toEntity(row: Row): Notification {
  return {
    id: row.id,
    userId: row.userId,
    category: row.category as NotificationCategory,
    kind: row.kind,
    params: row.params as NotificationParams,
    botId: row.botId,
    count: row.count,
    createdAt: row.createdAt,
    deliveredAt: row.deliveredAt,
    readAt: row.readAt
  }
}

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly db: PrismaClient) {}

  async add(notification: Notification): Promise<void> {
    await this.db.playerNotification.create({ data: { ...notification, params: notification.params } })
  }

  async bump(id: string, at: Date): Promise<Notification | null> {
    // One statement, so a notification that was read in between is not counted on
    const { count } = await this.db.playerNotification.updateMany({
      where: { id, readAt: null },
      data: { count: { increment: 1 }, createdAt: at }
    })

    if (count === 0) {
      return null
    }
    const row = await this.db.playerNotification.findUniqueOrThrow({ where: { id } })

    return toEntity(row)
  }

  async claimDue(now: Date, limit: number): Promise<Notification[]> {
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Row[]>(Prisma.sql`
        SELECT id FROM player_notifications
        WHERE delivered_at IS NULL AND created_at <= ${now}
        ORDER BY created_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED`)
      const ids = rows.map((row) => row.id)
      await tx.playerNotification.updateMany({ where: { id: { in: ids } }, data: { deliveredAt: now } })

      return (await tx.playerNotification.findMany({ where: { id: { in: ids } }, orderBy: { createdAt: 'asc' } })).map(
        toEntity
      )
    })
  }

  async list(userId: string, { limit, before, isUnreadOnly }: ListQuery): Promise<Notification[]> {
    const rows = await this.db.playerNotification.findMany({
      where: {
        userId,
        deliveredAt: { not: null },
        ...(before ? { createdAt: { lt: before } } : {}),
        ...(isUnreadOnly ? { readAt: null } : {})
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit
    })

    return rows.map(toEntity)
  }

  async unreadByCategory(userId: string): Promise<Partial<Record<NotificationCategory, number>>> {
    const groups = await this.db.playerNotification.groupBy({
      by: ['category'],
      where: { userId, deliveredAt: { not: null }, readAt: null },
      _count: { _all: true }
    })

    return Object.fromEntries(
      groups.filter((group) => isCategory(group.category)).map((group) => [group.category, group._count._all])
    )
  }

  async markRead(userId: string, ids: readonly string[] | null, at: Date): Promise<number> {
    const { count } = await this.db.playerNotification.updateMany({
      where: { userId, readAt: null, deliveredAt: { not: null }, ...(ids ? { id: { in: [...ids] } } : {}) },
      data: { readAt: at }
    })

    return count
  }

  async deleteOlderThan(date: Date): Promise<number> {
    const { count } = await this.db.playerNotification.deleteMany({ where: { createdAt: { lt: date } } })

    return count
  }
}
