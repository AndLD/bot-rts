import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { AdminModule } from '../admin/admin.module'
import { AuthModule } from '../auth/auth.module'
import { PASSWORD_HASHER, PasswordHasher } from '../auth/application/ports'
import { BotsService } from '../bots/application/bots.service'
import { TimeModule } from '../time/time.module'
import { BotsModule } from '../bots/bots.module'
import { UNIT_OF_WORK, UnitOfWork } from '../persistence/application/unit-of-work'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import { ID_GENERATOR, IdGenerator } from '../shared/application/id-generator'
import { LOGGER, Logger } from '../shared/application/logger'
import { DevToolsService } from './application/devtools.service'
import {
  DATABASE_RESETTER,
  DatabaseResetter,
  ENGINE_RESTARTER,
  EngineRestarter,
  TEST_PLAYER_DIRECTORY,
  TestPlayerDirectory
} from './application/ports'
import { PrismaTestPlayerDirectory } from './infrastructure/prisma-test-player.directory'
import { DATABASE_RESET_SERVICE, DEVTOOLS_SERVICE, DevToolsController } from './presentation/devtools.controller'
import { DatabaseResetService } from './application/database-reset.service'
import { PrismaDatabaseResetter } from './infrastructure/prisma-database.resetter'
import { ENGINE_PROCESS } from '../engine/engine.module'
import { EngineProcess } from '../engine/infrastructure/engine-process'
import { GameTimeSettingsService } from '../time/application/game-time-settings.service'
import { APP_CONFIG, AppConfig } from '../config/app-config'

// The Dev tools of the admin console. AppModule includes it only when the configuration enables the tools.
@Module({
  imports: [AdminModule, AuthModule, BotsModule, TimeModule],
  controllers: [DevToolsController],
  providers: [
    {
      provide: TEST_PLAYER_DIRECTORY,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaTestPlayerDirectory(client)
    },
    {
      provide: DATABASE_RESETTER,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaDatabaseResetter(client)
    },
    {
      provide: ENGINE_RESTARTER,
      inject: [ENGINE_PROCESS],
      useFactory: (process: EngineProcess | null): EngineRestarter | null =>
        process && { stop: () => process.close(), start: () => process.reopen() }
    },
    {
      provide: DATABASE_RESET_SERVICE,
      inject: [DATABASE_RESETTER, ENGINE_RESTARTER, APP_CONFIG, GameTimeSettingsService, LOGGER],
      useFactory: (
        resetter: DatabaseResetter,
        engine: EngineRestarter | null,
        config: AppConfig,
        gameTime: GameTimeSettingsService,
        logger: Logger
      ) => new DatabaseResetService(resetter, engine, config.engine.isEnabled, gameTime, logger)
    },
    {
      provide: DEVTOOLS_SERVICE,
      inject: [UNIT_OF_WORK, BotsService, PASSWORD_HASHER, TEST_PLAYER_DIRECTORY, ID_GENERATOR, CLOCK, LOGGER],
      useFactory: (
        unitOfWork: UnitOfWork,
        bots: BotsService,
        hasher: PasswordHasher,
        directory: TestPlayerDirectory,
        ids: IdGenerator,
        clock: Clock,
        logger: Logger
      ) => new DevToolsService(unitOfWork, bots, hasher, directory, ids, clock, logger)
    }
  ]
})
export class DevToolsModule {}
