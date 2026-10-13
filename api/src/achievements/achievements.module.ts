import { Inject, Module, OnApplicationShutdown, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import { LOGGER, Logger } from '../shared/application/logger'
import { ACHIEVEMENT_REPOSITORY, AchievementRepository } from './application/achievement.repository'
import { AchievementService } from './application/achievement.service'
import { PrismaAchievementRepository } from './infrastructure/prisma-achievement.repository'
import { AchievementsController } from './presentation/achievements.controller'

// How often the counted events are written to the database
export const ACHIEVEMENT_FLUSH_MS = 2000

@Module({
  controllers: [AchievementsController],
  providers: [
    {
      provide: ACHIEVEMENT_REPOSITORY,
      inject: [PRISMA_CLIENT, CLOCK],
      useFactory: (client: PrismaClient, clock: Clock) => new PrismaAchievementRepository(client, () => clock.now())
    },
    {
      provide: AchievementService,
      inject: [ACHIEVEMENT_REPOSITORY, CLOCK, LOGGER],
      useFactory: (repository: AchievementRepository, clock: Clock, logger: Logger) =>
        new AchievementService(repository, clock, logger)
    }
  ],
  exports: [AchievementService]
})
export class AchievementsModule implements OnModuleInit, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null

  constructor(@Inject(AchievementService) private readonly achievements: AchievementService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.achievements.flush(), ACHIEVEMENT_FLUSH_MS)
    this.timer.unref()
  }

  async onApplicationShutdown() {
    if (this.timer) {
      clearInterval(this.timer)
    }
    await this.achievements.flush()
  }
}
