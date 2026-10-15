import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { AdminModule } from '../admin/admin.module'
import { AuthModule } from '../auth/auth.module'
import { PASSWORD_HASHER, PasswordHasher } from '../auth/application/ports'
import { BotsService } from '../bots/application/bots.service'
import { BotsModule } from '../bots/bots.module'
import { UNIT_OF_WORK, UnitOfWork } from '../persistence/application/unit-of-work'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import { ID_GENERATOR, IdGenerator } from '../shared/application/id-generator'
import { LOGGER, Logger } from '../shared/application/logger'
import { DevToolsService } from './application/devtools.service'
import { TEST_PLAYER_DIRECTORY, TestPlayerDirectory } from './application/ports'
import { PrismaTestPlayerDirectory } from './infrastructure/prisma-test-player.directory'
import { DEVTOOLS_SERVICE, DevToolsController } from './presentation/devtools.controller'

// The Dev tools of the admin console. AppModule includes it only when the configuration enables the tools.
@Module({
  imports: [AdminModule, AuthModule, BotsModule],
  controllers: [DevToolsController],
  providers: [
    {
      provide: TEST_PLAYER_DIRECTORY,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaTestPlayerDirectory(client)
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
