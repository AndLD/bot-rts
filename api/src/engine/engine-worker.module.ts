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
import { MapGenerator } from '../map/domain/map-generator'
import { WORLD_CONFIG, WorldConfig } from '../map/domain/world-config'
import { ITEM_REPOSITORY, ItemRepository } from '../crafting/application/item.repository'
import { MapModule } from '../map/map.module'
import { EnergyModel } from '../modules/domain/energy-model'
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
import { BotAccessService } from '../terminal/application/bot-access.service'
import { TerminalCoreModule } from '../terminal/terminal-core.module'
import { UsersModule } from '../users/users.module'
import { EngineCore } from './application/engine-core'
import { ModuleLoader } from './application/module-loader'
import { TRANSPILER, Transpiler } from './application/transpiler'
import { StepWatch, StepWatchWriter } from './infrastructure/step-watch'
import { SucraseTranspiler } from './infrastructure/sucrase-transpiler'
import { BOT_STATE_SOURCE, BotStateSource, EngineSink, SCRIPT_SOURCE, ScriptSource } from './application/engine-ports'
import { ControlMessage, EngineMessage, MessageChannel } from './application/engine-protocol'
import { EXECUTION_REPOSITORY, ExecutionRepository } from './application/execution.repository'
import { EngineAudience } from './application/engine-audience'
import { EventOutbox } from './application/event-outbox'
import { GameEventBus } from './application/game-event-bus'
import { LiveVision } from './application/live-vision'
import { LinkHandler } from './application/handlers/link-handler'
import { RadioBuffers } from './application/radio-buffers'
import { RadioNetwork } from './application/radio-network'
import { ViewHandler } from './application/handlers/view-handler'
import { World } from './application/world/world'
import { WorldActionExecutor } from './application/world-action-executor'
import { EngineModule } from './engine.module'
import { RepositoryWorldSource } from './application/world/repository-world-source'
import { WorldSource } from './application/world/world-source'
import { CombatHandler } from './application/handlers/combat-handler'
import { ManipulatorHandler } from './application/handlers/manipulator-handler'
import { MiningHandler } from './application/handlers/mining-handler'
import { MovementHandler } from './application/handlers/movement-handler'
import { PowerHandler } from './application/handlers/power-handler'
import { SyncedHandler } from './application/handlers/synced-handler'
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
const STEP_WATCH = Symbol('StepWatch')
const WORLD_SOURCE = Symbol('WorldSource')

// The modules the engine thread needs: the use cases the scripts call, without any transport (design §12.2.2). The engine
// thread has its own application context and its own database connections.
@Module({})
export class EngineWorkerModule {
  static register(
    config: AppConfig,
    channel: MessageChannel<ControlMessage, EngineMessage>,
    stepWatch?: SharedArrayBuffer
  ): DynamicModule {
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
        BotsModule,
        TerminalCoreModule,
        // Provides the port that the services are told to use, which here answers that there is no other engine
        EngineModule
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
        { provide: TRANSPILER, useFactory: () => new SucraseTranspiler() },
        {
          provide: ModuleLoader,
          inject: [SCRIPT_SOURCE, TRANSPILER, APP_CONFIG],
          useFactory: (source: ScriptSource, transpiler: Transpiler, app: AppConfig) =>
            new ModuleLoader(source, transpiler, app.engine.modules)
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
          provide: WORLD_SOURCE,
          inject: [
            BOT_STATE_SOURCE,
            BOT_REPOSITORY,
            MODULE_REPOSITORY,
            MAP_REPOSITORY,
            ITEM_REPOSITORY,
            MapGenerator,
            ID_GENERATOR,
            WORLD_CONFIG
          ],
          useFactory: (
            states: BotStateSource,
            bots: BotRepository,
            modules: ModuleRepository,
            map: MapRepository,
            items: ItemRepository,
            generator: MapGenerator,
            ids: IdGenerator,
            world: WorldConfig
          ) => new RepositoryWorldSource(states, bots, modules, map, items, generator, ids, world.resources)
        },
        {
          provide: World,
          inject: [WORLD_SOURCE, WriteBehind, ModuleRegistry, EnergyModel, WORLD_CONFIG, APP_CONFIG],
          useFactory: (
            source: WorldSource,
            writeBehind: WriteBehind,
            registry: ModuleRegistry,
            energy: EnergyModel,
            world: WorldConfig,
            app: AppConfig
          ) =>
            new World(
              source,
              writeBehind,
              registry,
              energy,
              world.chunkSize,
              (seed) => new SeededRng(seed),
              app.worldSeed ?? 0,
              app.engine.maxChunks
            )
        },
        {
          provide: LiveVision,
          inject: [World, WORLD_SOURCE, WriteBehind, ID_GENERATOR, ENGINE_SINK, APP_CONFIG, WORLD_CONFIG],
          useFactory: (
            world: World,
            source: WorldSource,
            writeBehind: WriteBehind,
            ids: IdGenerator,
            sink: EngineSink,
            app: AppConfig,
            worldConfig: WorldConfig
          ) => new LiveVision(world, source, writeBehind, ids, sink, app.engine.tickIntervalMs, worldConfig.chunkSize)
        },
        { provide: EventOutbox, inject: [CLOCK], useFactory: (clock: Clock) => new EventOutbox(clock) },
        {
          provide: RadioBuffers,
          inject: [APP_CONFIG],
          useFactory: (app: AppConfig) =>
            new RadioBuffers({ scans: app.engine.radio.bufferScans, events: app.engine.radio.bufferEvents })
        },
        {
          provide: RadioNetwork,
          inject: [World, WORLD_SOURCE, ENGINE_SINK, EventOutbox, RadioBuffers, APP_CONFIG, LiveVision, CLOCK],
          useFactory: (
            world: World,
            source: WorldSource,
            sink: EngineSink,
            outbox: EventOutbox,
            buffers: RadioBuffers,
            app: AppConfig,
            vision: LiveVision,
            clock: Clock
          ) => new RadioNetwork(world, source, sink, outbox, buffers, app.engine.radio, vision, clock)
        },
        {
          provide: GameEventBus,
          inject: [EventOutbox, LiveVision, RadioNetwork, RadioBuffers, ENGINE_SINK],
          useFactory: (
            outbox: EventOutbox,
            vision: LiveVision,
            radio: RadioNetwork,
            buffers: RadioBuffers,
            sink: EngineSink
          ) => new GameEventBus(outbox, new EngineAudience(vision, radio), buffers, sink)
        },
        {
          provide: ScriptApi,
          inject: [
            World,
            LiveVision,
            RadioNetwork,
            RadioBuffers,
            EventOutbox,
            CLOCK,
            APP_CONFIG,
            ScanService,
            FactoryService,
            AssemblyService,
            MaintenanceService,
            FilesService
          ],
          useFactory: (
            world: World,
            vision: LiveVision,
            radio: RadioNetwork,
            buffers: RadioBuffers,
            outbox: EventOutbox,
            clock: Clock,
            app: AppConfig,
            scans: ScanService,
            factory: FactoryService,
            assembly: AssemblyService,
            maintenance: MaintenanceService,
            files: FilesService
          ) =>
            new ScriptApi([
              new GpsHandler(world),
              new MovementHandler(world, app.engine.movement, outbox),
              new MiningHandler(world, outbox),
              new ManipulatorHandler(world),
              new CombatHandler(world, clock, app.engine.combat, outbox),
              new PowerHandler(world, clock, vision),
              new ViewHandler(world, vision),
              new SyncedHandler(world, new ScannerHandler(scans, radio, buffers, outbox)),
              new LinkHandler(radio),
              new SyncedHandler(world, new FactoryHandler(factory, assembly)),
              new SyncedHandler(world, new MaintenanceHandler(maintenance)),
              new DriveHandler(files)
            ])
        },
        {
          provide: WorldActionExecutor,
          inject: [
            BotsService,
            ScanService,
            FactoryService,
            AssemblyService,
            MaintenanceService,
            FilesService,
            BotAccessService
          ],
          useFactory: (
            bots: BotsService,
            scans: ScanService,
            factory: FactoryService,
            assembly: AssemblyService,
            maintenance: MaintenanceService,
            files: FilesService,
            access: BotAccessService
          ) => new WorldActionExecutor({ bots, scans, factory, assembly, maintenance, files, access })
        },
        {
          provide: WriteBehind,
          inject: [WORLD_STATE_STORE, APP_CONFIG],
          useFactory: (store: WorldStateStore, app: AppConfig) =>
            new WriteBehind(store, app.engine.flushEveryTicks, app.engine.flushMaxFailures)
        },
        { provide: STEP_WATCH, useValue: stepWatch ? new StepWatchWriter(stepWatch) : undefined },
        { provide: ENGINE_SINK, inject: [ENGINE_CHANNEL], useFactory: (c: typeof channel) => new ChannelSink(c) },
        {
          provide: EngineCore,
          inject: [
            APP_CONFIG,
            EXECUTION_REPOSITORY,
            BOT_STATE_SOURCE,
            ModuleLoader,
            SCRIPT_RUNTIME,
            ScriptApi,
            SCHEDULER,
            BotCapacities,
            ModuleRegistry,
            WriteBehind,
            World,
            LiveVision,
            RadioNetwork,
            EventOutbox,
            GameEventBus,
            WorldActionExecutor,
            STEP_WATCH,
            ENGINE_SINK,
            ID_GENERATOR,
            CLOCK,
            LOGGER
          ],
          useFactory: (
            app: AppConfig,
            executions: ExecutionRepository,
            bots: BotStateSource,
            modules: ModuleLoader,
            runtime: ScriptRuntime,
            api: ScriptApi,
            scheduler: Scheduler,
            capacities: BotCapacities,
            registry: ModuleRegistry,
            writeBehind: WriteBehind,
            world: World,
            vision: LiveVision,
            radio: RadioNetwork,
            outbox: EventOutbox,
            bus: GameEventBus,
            actions: WorldActionExecutor,
            watch: StepWatch | undefined,
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
              modules,
              watch,
              runtime,
              api,
              scheduler,
              capacities,
              registry,
              writeBehind,
              world,
              vision,
              radio,
              outbox,
              bus,
              actions,
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
