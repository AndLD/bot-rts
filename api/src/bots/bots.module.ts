import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PASSWORD_HASHER, PasswordHasher } from '../auth/application/ports'
import { AuthModule } from '../auth/auth.module'
import { MAP_REPOSITORY, MapRepository } from '../map/application/map.repository'
import { MapService } from '../map/application/map.service'
import { CraftingModule } from '../crafting/crafting.module'
import { ITEM_REPOSITORY, ItemRepository } from '../crafting/application/item.repository'
import { SpawnModule } from '../spawn/spawn.module'
import { SpawnService } from '../spawn/application/spawn.service'
import { MapModule } from '../map/map.module'
import { MODULE_REPOSITORY, ModuleRepository } from '../modules/application/module.repository'
import { ModuleRegistry } from '../modules/domain/module-registry'
import { EnergyService } from '../modules/application/energy.service'
import { ModuleFactory } from '../modules/application/module.factory'
import { ModulesModule } from '../modules/modules.module'
import { UNIT_OF_WORK, UnitOfWork } from '../persistence/application/unit-of-work'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import { ID_GENERATOR, IdGenerator } from '../shared/application/id-generator'
import { BOT_REPOSITORY, BotRepository } from './application/bot.repository'
import { BaseLifecycle } from './application/base-lifecycle'
import { BotsService } from './application/bots.service'
import { RecipeBook } from '../crafting/domain/recipe-book'
import { EnergyModel } from '../modules/domain/energy-model'
import { AssemblyService } from './application/assembly.service'
import { FactoryService } from './application/factory.service'
import { ScanService } from './application/scan.service'
import { PrismaBotRepository } from './infrastructure/prisma-bot.repository'
import { FactoryController } from './presentation/factory.controller'
import { FactoryGateway } from './presentation/factory.gateway'
import { BotsController } from './presentation/bots.controller'
import { BotsGateway } from './presentation/bots.gateway'

@Module({
  imports: [AuthModule, MapModule, ModulesModule, SpawnModule, CraftingModule],
  controllers: [BotsController, FactoryController],
  providers: [
    BotsGateway,
    FactoryGateway,
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
      provide: FactoryService,
      inject: [UNIT_OF_WORK, BotsService, RecipeBook, ID_GENERATOR, CLOCK, ModuleRegistry, EnergyModel, ModuleFactory],
      useFactory: (
        unitOfWork: UnitOfWork,
        bots: BotsService,
        recipes: RecipeBook,
        ids: IdGenerator,
        clock: Clock,
        registry: ModuleRegistry,
        energy: EnergyModel,
        moduleFactory: ModuleFactory
      ) => new FactoryService(unitOfWork, bots, recipes, ids, clock, registry, energy, moduleFactory)
    },
    {
      provide: AssemblyService,
      inject: [BotsService, MODULE_REPOSITORY, ITEM_REPOSITORY, ModuleFactory, ModuleRegistry, FactoryService],
      useFactory: (
        bots: BotsService,
        modules: ModuleRepository,
        items: ItemRepository,
        moduleFactory: ModuleFactory,
        registry: ModuleRegistry,
        factory: FactoryService
      ) => new AssemblyService(bots, modules, items, moduleFactory, registry, factory)
    },
    {
      provide: ScanService,
      inject: [BotsService, MODULE_REPOSITORY, MAP_REPOSITORY, MapService, ModuleRegistry, CLOCK, EnergyService],
      useFactory: (
        bots: BotsService,
        modules: ModuleRepository,
        map: MapRepository,
        mapService: MapService,
        registry: ModuleRegistry,
        clock: Clock,
        energy: EnergyService
      ) => new ScanService(bots, modules, map, mapService, registry, clock, energy)
    }
  ],
  exports: [BOT_REPOSITORY, BotsService, ScanService, AssemblyService, FactoryService]
})
export class BotsModule {}
