import { PrismaClient } from '@prisma/client'
import { NotificationPreferences, withNotificationDefaults } from '../../../../lib/utils/interfaces/notifications'
import { NotificationPreferenceRepository } from '../application/notification.repository'

export class PrismaNotificationPreferenceRepository implements NotificationPreferenceRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly now: () => Date
  ) {}

  async get(userId: string): Promise<NotificationPreferences> {
    const row = await this.db.userSetting.findUnique({ where: { userId }, select: { notificationCategories: true } })

    return withNotificationDefaults(row?.notificationCategories as Record<string, boolean> | undefined)
  }

  async save(userId: string, preferences: NotificationPreferences): Promise<void> {
    const data = { notificationCategories: preferences, updatedAt: this.now() }

    await this.db.userSetting.upsert({ where: { userId }, create: { userId, ...data }, update: data })
  }
}
