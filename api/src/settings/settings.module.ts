import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { AuthModule } from '../auth/auth.module'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import { SETTINGS_REPOSITORY, SettingsRepository } from './application/settings.repository'
import { SettingsService } from './application/settings.service'
import { PrismaSettingsRepository } from './infrastructure/prisma-settings.repository'
import { AdminSettingsController, SettingsController } from './presentation/settings.controller'

// The settings of the game and of the players (design §15.1)
@Module({
  imports: [AuthModule],
  controllers: [SettingsController, AdminSettingsController],
  providers: [
    {
      provide: SETTINGS_REPOSITORY,
      inject: [PRISMA_CLIENT, CLOCK],
      useFactory: (client: PrismaClient, clock: Clock) => new PrismaSettingsRepository(client, () => clock.now())
    },
    {
      provide: SettingsService,
      inject: [SETTINGS_REPOSITORY],
      useFactory: (settings: SettingsRepository) => new SettingsService(settings)
    }
  ],
  exports: [SettingsService]
})
export class SettingsModule {}
