import { DynamicModule, Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { AuthModule } from '../auth/auth.module'
import { BOT_REPOSITORY, BotRepository } from '../bots/application/bot.repository'
import { AssemblyService } from '../bots/application/assembly.service'
import { BotsService } from '../bots/application/bots.service'
import { FactoryService } from '../bots/application/factory.service'
import { MaintenanceService } from '../bots/application/maintenance.service'
import { ScanService } from '../bots/application/scan.service'
import { BotsModule } from '../bots/bots.module'
import { AppConfig, APP_CONFIG } from '../config/app-config'
import { ConfigModule } from '../config/config.module'
import { CraftingModule } from '../crafting/crafting.module'
import { FilesService } from '../files/application/files.service'
import { FilesModule } from '../files/files.module'
import { MAP_REPOSITORY, MapRepository } from '../map/application/map.repository'
import { MapModule } from '../map/map.module'
import { EnergyService } from '../modules/application/energy.service'
import { MODULE_REPOSITORY, ModuleRepository } from '../modules/application/module.repository'
import { ModuleRegistry } from '../modules/domain/module-registry'
import { ModulesModule } from '../modules/modules.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { WORLD_STATE_STORE, WorldStateStore } from '../persistence/application/world-state-store'
import { PersistenceModule } from '../persistence/persistence.module'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import { ID_GENERATOR, IdGenerator } from '../shared/application/id-generator'
import { LOGGER, Logger } from '../shared/application/logger'
import { SeededRng } from '../shared/infrastructure/seeded-rng'
import { SharedModule } from '../shared/shared.module'
import { UsersModule } from '../users/users.module'
import { EngineCore } from './application/engine-core'
import { BOT_STATE_SOURCE, BotStateSource, EngineSink, SCRIPT_SOURCE, ScriptSource } from './application/engine-ports'
import { ControlMessage, EngineMessage, MessageChannel } from './application/engine-protocol'
import { EXECUTION_REPOSITORY, ExecutionRepository } from './application/execution.repository'
import { DriveHandler } from './application/handlers/drive-handler'
import { FactoryHandler } from './application/handlers/factory-handler'
import { GpsHandler } from './application/handlers/gps-handler'
import { MaintenanceHandler } from './application/handlers/maintenance-handler'
import { ScannerHandler } from './application/handlers/scanner-handler'
import { BotCapacities } from './application/bot-capacities'
import { FairScheduler, SCHEDULER, Scheduler } from './application/scheduler'
import { ScriptApi } from './application/script-api'
import { ScriptRuntime } from './application/script-runtime'
import { WriteBehind } from './application/write-behind'
import { ServiceBotStateSource } from './infrastructure/bot-state.source'
import { ChannelSink, EngineHost } from './infrastructure/engine-host'
import { FilesScriptSource } from './infrastructure/files-script.source'
import { PrismaExecutionRepository } from './infrastructure/prisma-execution.repository'
import { QuickJsScriptRuntime } from './infrastructure/quickjs-script-runtime'
import { SYSTEM_TIMERS } from './infrastructure/tick-loop'

const ENGINE_CHANNEL = Symbol('EngineChannel')
const ENGINE_SINK = Symbol('EngineSink')
const SCRIPT_RUNTIME = Symbol('ScriptRuntime')

// The modules the engine thread needs: the use cases the scripts call, without any transport (design §12.2.2). The engine
// thread has its own application context and its own database connections.
@Module({})
export class EngineWorkerModule {
  static register(config: AppConfig, channel: MessageChannel<ControlMessage, EngineMessage>): DynamicModule {
    return {
      module: EngineWorkerModule,
      imports: [
        ConfigModule.forRoot(config),
        SharedModule,
        PersistenceModule,
        NotificationsModule,
        UsersModule,
        AuthModule,
        ModulesModule,
        CraftingModule,
        FilesModule,
        MapModule,
        BotsModule
      ],
      providers: [
        { provide: ENGINE_CHANNEL, useValue: channel },
        {
          provide: EXECUTION_REPOSITORY,
          inject: [PRISMA_CLIENT],
          useFactory: (client: PrismaClient) => new PrismaExecutionRepository(client)
        },
        {
          provide: BOT_STATE_SOURCE,
          inject: [BotsService, BOT_REPOSITORY, MODULE_REPOSITORY],
          useFactory: (bots: BotsService, repository: BotRepository, modules: ModuleRepository) =>
            new ServiceBotStateSource(bots, repository, modules)
        },
        {
          provide: SCRIPT_SOURCE,
          inject: [FilesService],
          useFactory: (files: FilesService) => new FilesScriptSource(files)
        },
        { provide: SCRIPT_RUNTIME, useFactory: () => QuickJsScriptRuntime.create() },
        BotCapacities,
        {
          provide: SCHEDULER,
          inject: [BotCapacities, APP_CONFIG],
          useFactory: (capacities: BotCapacities, app: AppConfig) =>
            new FairScheduler(capacities, (seed) => new SeededRng(seed), app.worldSeed ?? 0)
        },
        {
          provide: ScriptApi,
          inject: [
            ScanService,
            MODULE_REPOSITORY,
            ModuleRegistry,
            MAP_REPOSITORY,
            EnergyService,
            FactoryService,
            AssemblyService,
            MaintenanceService,
            FilesService
          ],
          useFactory: (
            scans: ScanService,
            modules: ModuleRepository,
            registry: ModuleRegistry,
            map: MapRepository,
            energy: EnergyService,
            factory: FactoryService,
            assembly: AssemblyService,
            maintenance: MaintenanceService,
            files: FilesService
          ) =>
            new ScriptApi([
              new ScannerHandler(scans),
              new GpsHandler(modules, registry, map, energy),
              new FactoryHandler(factory, assembly),
              new MaintenanceHandler(maintenance),
              new DriveHandler(files)
            ])
        },
        {
          provide: WriteBehind,
          inject: [WORLD_STATE_STORE, APP_CONFIG],
          useFactory: (store: WorldStateStore, app: AppConfig) => new WriteBehind(store, app.engine.flushEveryTicks)
        },
        { provide: ENGINE_SINK, inject: [ENGINE_CHANNEL], useFactory: (c: typeof channel) => new ChannelSink(c) },
        {
          provide: EngineCore,
          inject: [
            APP_CONFIG,
            EXECUTION_REPOSITORY,
            BOT_STATE_SOURCE,
            SCRIPT_SOURCE,
            SCRIPT_RUNTIME,
            ScriptApi,
            SCHEDULER,
            BotCapacities,
            ModuleRegistry,
            WriteBehind,
            ENGINE_SINK,
            ID_GENERATOR,
            CLOCK,
            LOGGER
          ],
          useFactory: (
            app: AppConfig,
            executions: ExecutionRepository,
            bots: BotStateSource,
            sources: ScriptSource,
            runtime: ScriptRuntime,
            api: ScriptApi,
            scheduler: Scheduler,
            capacities: BotCapacities,
            registry: ModuleRegistry,
            writeBehind: WriteBehind,
            sink: EngineSink,
            ids: IdGenerator,
            clock: Clock,
            logger: Logger
          ) =>
            new EngineCore({
              config: app.engine,
              worldSeed: app.worldSeed ?? 0,
              createRng: (seed) => new SeededRng(seed),
              executions,
              bots,
              sources,
              runtime,
              api,
              scheduler,
              capacities,
              registry,
              writeBehind,
              sink,
              ids,
              clock,
              logger,
              monotonicMs: () => performance.now()
            })
        },
        {
          provide: EngineHost,
          inject: [EngineCore, ENGINE_CHANNEL, LOGGER, APP_CONFIG],
          useFactory: (core: EngineCore, c: typeof channel, logger: Logger, app: AppConfig) =>
            new EngineHost(core, c, logger, app.engine.tickIntervalMs, SYSTEM_TIMERS)
        }
      ]
    }
  }
}
