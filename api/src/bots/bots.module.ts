import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { FilesModule } from '../files/files.module'
import { MAP_REPOSITORY, MapRepository } from '../map/application/map.repository'
import { MapService } from '../map/application/map.service'
import { WORLD_CONFIG, WorldConfig } from '../map/domain/world-config'
import { MapModule } from '../map/map.module'
import { MODULE_REPOSITORY, ModuleRepository } from '../modules/application/module.repository'
import { ModulesModule } from '../modules/modules.module'
import { UNIT_OF_WORK, UnitOfWork } from '../persistence/application/unit-of-work'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import { ID_GENERATOR, IdGenerator } from '../shared/application/id-generator'
import { RNG, Rng } from '../shared/application/rng'
import { BOT_REPOSITORY, BotRepository } from './application/bot.repository'
import { BotsService } from './application/bots.service'
import { ScanService } from './application/scan.service'
import { PrismaBotRepository } from './infrastructure/prisma-bot.repository'

@Module({
  imports: [MapModule, ModulesModule, FilesModule],
  providers: [
    {
      provide: BOT_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaBotRepository(client)
    },
    {
      provide: BotsService,
      inject: [UNIT_OF_WORK, BOT_REPOSITORY, MODULE_REPOSITORY, ID_GENERATOR, RNG, CLOCK, WORLD_CONFIG],
      useFactory: (
        unitOfWork: UnitOfWork,
        bots: BotRepository,
        modules: ModuleRepository,
        ids: IdGenerator,
        rng: Rng,
        clock: Clock,
        world: WorldConfig
      ) => new BotsService(unitOfWork, bots, modules, ids, rng, clock, world)
    },
    {
      provide: ScanService,
      inject: [BotsService, MODULE_REPOSITORY, MAP_REPOSITORY, MapService],
      useFactory: (bots: BotsService, modules: ModuleRepository, map: MapRepository, mapService: MapService) =>
        new ScanService(bots, modules, map, mapService)
    }
  ],
  exports: [BOT_REPOSITORY, BotsService, ScanService]
})
export class BotsModule {}
