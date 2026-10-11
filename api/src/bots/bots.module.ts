import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PASSWORD_HASHER, PasswordHasher } from '../auth/application/ports'
import { AuthModule } from '../auth/auth.module'
import { MAP_REPOSITORY, MapRepository } from '../map/application/map.repository'
import { MapService } from '../map/application/map.service'
import { SpawnModule } from '../spawn/spawn.module'
import { SpawnService } from '../spawn/application/spawn.service'
import { MapModule } from '../map/map.module'
import { MODULE_REPOSITORY, ModuleRepository } from '../modules/application/module.repository'
import { ModuleRegistry } from '../modules/domain/module-registry'
import { ModuleFactory } from '../modules/application/module.factory'
import { ModulesModule } from '../modules/modules.module'
import { UNIT_OF_WORK, UnitOfWork } from '../persistence/application/unit-of-work'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import { ID_GENERATOR, IdGenerator } from '../shared/application/id-generator'
import { BOT_REPOSITORY, BotRepository } from './application/bot.repository'
import { BaseLifecycle } from './application/base-lifecycle'
import { BotsService } from './application/bots.service'
import { ScanService } from './application/scan.service'
import { PrismaBotRepository } from './infrastructure/prisma-bot.repository'
import { BotsController } from './presentation/bots.controller'
import { BotsGateway } from './presentation/bots.gateway'

@Module({
  imports: [AuthModule, MapModule, ModulesModule, SpawnModule],
  controllers: [BotsController],
  providers: [
    BotsGateway,
    {
      provide: BOT_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaBotRepository(client)
    },
    {
      provide: BaseLifecycle,
      inject: [ModuleRegistry],
      useFactory: (registry: ModuleRegistry) => new BaseLifecycle(registry)
    },
    {
      provide: BotsService,
      inject: [
        UNIT_OF_WORK,
        BOT_REPOSITORY,
        MODULE_REPOSITORY,
        ID_GENERATOR,
        CLOCK,
        PASSWORD_HASHER,
        ModuleFactory,
        BaseLifecycle,
        SpawnService
      ],
      useFactory: (
        unitOfWork: UnitOfWork,
        bots: BotRepository,
        modules: ModuleRepository,
        ids: IdGenerator,
        clock: Clock,
        hasher: PasswordHasher,
        moduleFactory: ModuleFactory,
        lifecycle: BaseLifecycle,
        spawn: SpawnService
      ) => new BotsService(unitOfWork, bots, modules, ids, clock, hasher, moduleFactory, lifecycle, spawn)
    },
    {
      provide: ScanService,
      inject: [BotsService, MODULE_REPOSITORY, MAP_REPOSITORY, MapService, ModuleRegistry],
      useFactory: (
        bots: BotsService,
        modules: ModuleRepository,
        map: MapRepository,
        mapService: MapService,
        registry: ModuleRegistry
      ) => new ScanService(bots, modules, map, mapService, registry)
    }
  ],
  exports: [BOT_REPOSITORY, BotsService, ScanService]
})
export class BotsModule {}
