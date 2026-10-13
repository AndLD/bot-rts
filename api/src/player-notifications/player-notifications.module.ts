import { Inject, Module, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { AchievementsModule } from '../achievements/achievements.module'
import { AchievementService } from '../achievements/application/achievement.service'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import { ID_GENERATOR, IdGenerator } from '../shared/application/id-generator'
import { LOGGER, Logger } from '../shared/application/logger'
import {
  NOTIFICATION_PREFERENCES,
  NOTIFICATION_REPOSITORY,
  NotificationPreferenceRepository,
  NotificationRepository
} from './application/notification.repository'
import { NotificationService } from './application/notification.service'
import { PrismaNotificationPreferenceRepository } from './infrastructure/prisma-notification-preference.repository'
import { PrismaNotificationRepository } from './infrastructure/prisma-notification.repository'
import { NotificationsController } from './presentation/notifications.controller'

// How often what waits for its time is delivered, and how often what is too old is forgotten
export const DELIVER_DUE_MS = 2000
export const PURGE_MS = 3_600_000

// The notifications of the players about their game (design §24.2); the email of the accounts is the `notifications` module
@Module({
  imports: [AchievementsModule],
  controllers: [NotificationsController],
  providers: [
    {
      provide: NOTIFICATION_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaNotificationRepository(client)
    },
    {
      provide: NOTIFICATION_PREFERENCES,
      inject: [PRISMA_CLIENT, CLOCK],
      useFactory: (client: PrismaClient, clock: Clock) =>
        new PrismaNotificationPreferenceRepository(client, () => clock.now())
    },
    {
      provide: NotificationService,
      inject: [NOTIFICATION_REPOSITORY, NOTIFICATION_PREFERENCES, CLOCK, ID_GENERATOR, LOGGER, APP_CONFIG],
      useFactory: (
        repository: NotificationRepository,
        preferences: NotificationPreferenceRepository,
        clock: Clock,
        ids: IdGenerator,
        logger: Logger,
        config: AppConfig
      ) => new NotificationService(repository, preferences, clock, ids, logger, config.notifications)
    }
  ],
  exports: [NotificationService]
})
export class PlayerNotificationsModule implements OnApplicationBootstrap, OnApplicationShutdown {
  private timers: NodeJS.Timeout[] = []
  private offUnlocks: (() => void) | null = null

  constructor(
    @Inject(NotificationService) private readonly notifications: NotificationService,
    @Inject(AchievementService) private readonly achievements: AchievementService,
    @Inject(LOGGER) private readonly logger: Logger
  ) {}

  onApplicationBootstrap() {
    this.offUnlocks = this.achievements.onUnlocked(
      (userId, unlock) => void this.notifications.achievementUnlocked(userId, unlock)
    )
    this.timers = [
      setInterval(
        () => void this.notifications.deliverDue().catch((error) => this.logger.error(error)),
        DELIVER_DUE_MS
      ),
      setInterval(() => void this.notifications.purge().catch((error) => this.logger.error(error)), PURGE_MS)
    ]
    this.timers.forEach((timer) => timer.unref())
  }

  onApplicationShutdown() {
    this.timers.forEach((timer) => clearInterval(timer))
    this.offUnlocks?.()
  }
}
