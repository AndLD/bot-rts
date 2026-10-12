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
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { ENGINE_PORT, EnginePort } from '../engine/application/engine-port'
import { routedThroughEngine } from '../engine/infrastructure/route-through-engine'
import { CLOCK, Clock } from '../shared/application/clock'
import { RNG, Rng } from '../shared/application/rng'
import { ID_GENERATOR, IdGenerator } from '../shared/application/id-generator'
import { BOT_REPOSITORY, BotRepository } from './application/bot.repository'
import { BaseLifecycle } from './application/base-lifecycle'
import { BotsService } from './application/bots.service'
import { FactorySettler } from '../crafting/application/factory-settler'
import { RecipeBook } from '../crafting/domain/recipe-book'
import { EnergyModel } from '../modules/domain/energy-model'
import { AssemblyService } from './application/assembly.service'
import { FactoryService } from './application/factory.service'
import { MaintenanceService } from './application/maintenance.service'
import { ScanService } from './application/scan.service'
import { PrismaBotRepository } from './infrastructure/prisma-bot.repository'
import { MaintenanceController } from './presentation/maintenance.controller'
import { FactoryController } from './presentation/factory.controller'
import { FactoryGateway } from './presentation/factory.gateway'
import { BotsController } from './presentation/bots.controller'
import { BotsGateway } from './presentation/bots.gateway'

@Module({
  imports: [AuthModule, MapModule, ModulesModule, SpawnModule, CraftingModule],
  controllers: [BotsController, FactoryController, MaintenanceController],
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
        SpawnService,
        APP_CONFIG,
        ENGINE_PORT
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
        spawn: SpawnService,
        config: AppConfig,
        engine: EnginePort
      ) =>
        routedThroughEngine(
          new BotsService(unitOfWork, bots, modules, ids, clock, hasher, moduleFactory, lifecycle, spawn),
          engine,
          config.engine.isEnabled,
          { deployUserBase: 'bots.deployUserBase' }
        )
    },
    {
      provide: FactoryService,
      inject: [UNIT_OF_WORK, BotsService, RecipeBook, CLOCK, EnergyModel, FactorySettler, APP_CONFIG, ENGINE_PORT],
      useFactory: (
        unitOfWork: UnitOfWork,
        bots: BotsService,
        recipes: RecipeBook,
        clock: Clock,
        energy: EnergyModel,
        settler: FactorySettler,
        config: AppConfig,
        engine: EnginePort
      ) =>
        routedThroughEngine(
          new FactoryService(unitOfWork, bots, recipes, clock, energy, settler),
          engine,
          config.engine.isEnabled,
          { craft: 'factory.craft', research: 'factory.research', learn: 'factory.learn' }
        )
    },
    {
      provide: MaintenanceService,
      inject: [
        UNIT_OF_WORK,
        BotsService,
        RecipeBook,
        ModuleRegistry,
        EnergyModel,
        CLOCK,
        RNG,
        BaseLifecycle,
        ID_GENERATOR,
        APP_CONFIG,
        ENGINE_PORT
      ],
      useFactory: (
        unitOfWork: UnitOfWork,
        bots: BotsService,
        recipes: RecipeBook,
        registry: ModuleRegistry,
        energy: EnergyModel,
        clock: Clock,
        rng: Rng,
        lifecycle: BaseLifecycle,
        ids: IdGenerator,
        config: AppConfig,
        engine: EnginePort
      ) =>
        routedThroughEngine(
          new MaintenanceService(unitOfWork, bots, recipes, registry, energy, clock, rng, lifecycle, ids),
          engine,
          config.engine.isEnabled,
          { repair: 'maintenance.repair', disassemble: 'maintenance.disassemble' }
        )
    },
    {
      provide: AssemblyService,
      inject: [
        BotsService,
        MODULE_REPOSITORY,
        ITEM_REPOSITORY,
        ModuleFactory,
        ModuleRegistry,
        FactoryService,
        APP_CONFIG,
        ENGINE_PORT
      ],
      useFactory: (
        bots: BotsService,
        modules: ModuleRepository,
        items: ItemRepository,
        moduleFactory: ModuleFactory,
        registry: ModuleRegistry,
        factory: FactoryService,
        config: AppConfig,
        engine: EnginePort
      ) =>
        routedThroughEngine(
          new AssemblyService(bots, modules, items, moduleFactory, registry, factory),
          engine,
          config.engine.isEnabled,
          { assemble: 'assembly.assemble' }
        )
    },
    {
      provide: ScanService,
      inject: [
        BotsService,
        MODULE_REPOSITORY,
        MAP_REPOSITORY,
        MapService,
        ModuleRegistry,
        CLOCK,
        EnergyService,
        APP_CONFIG,
        ENGINE_PORT
      ],
      useFactory: (
        bots: BotsService,
        modules: ModuleRepository,
        map: MapRepository,
        mapService: MapService,
        registry: ModuleRegistry,
        clock: Clock,
        energy: EnergyService,
        config: AppConfig,
        engine: EnginePort
      ) =>
        routedThroughEngine(
          new ScanService(bots, modules, map, mapService, registry, clock, energy),
          engine,
          config.engine.isEnabled,
          { scan: 'scan.scan' }
        )
    }
  ],
  exports: [BOT_REPOSITORY, BotsService, ScanService, AssemblyService, FactoryService, MaintenanceService]
})
export class BotsModule {}
