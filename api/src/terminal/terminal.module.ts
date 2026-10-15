import { ExecutionsController } from './presentation/executions.controller'
import { Inject, Module, OnApplicationShutdown, OnModuleInit } from '@nestjs/common'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { FilesModule } from '../files/files.module'
import { FilesService } from '../files/application/files.service'
import { BotsModule } from '../bots/bots.module'
import { AssemblyService } from '../bots/application/assembly.service'
import { BotsService } from '../bots/application/bots.service'
import { MaintenanceService } from '../bots/application/maintenance.service'
import { FactoryService } from '../bots/application/factory.service'
import { CraftingModule } from '../crafting/crafting.module'
import { RecipeService } from '../crafting/application/recipe.service'
import { CLOCK, Clock } from '../shared/application/clock'
import { ID_GENERATOR, IdGenerator } from '../shared/application/id-generator'
import { TERMINAL_SESSION_REPOSITORY, TerminalSessionRepository } from './application/terminal-session.repository'
import { createTerminalShell } from './application/shell/create-terminal-shell'
import { TerminalShell } from './application/shell/terminal-shell.service'
import { TerminalService } from './application/terminal.service'
import { TERMINAL_RETENTION, TerminalRetention } from './domain/terminal-retention'
import { ENGINE_PORT, EnginePort } from '../engine/application/engine-port'
import { EngineLinkGate } from '../engine/infrastructure/engine-link-gate'
import { LINK_GATE, LinkGate, OpenLinkGate } from './application/link-gate'
import { EngineScriptRunner } from '../engine/infrastructure/engine-script-runner'
import { LOGGER, Logger } from '../shared/application/logger'
import { ScriptLogRecorder } from './application/script-log-recorder'
import { SCRIPT_OUTPUT_FEED, SCRIPT_RUNNER, ScriptOutputFeed } from './application/script-runner'
import { BotAccessService } from './application/bot-access.service'
import { DELAY, Delay } from './application/delay'
import { SystemDelay } from './infrastructure/system-delay'
import { ScriptRunner } from './application/script-runner'
import { TerminalCoreModule } from './terminal-core.module'
import { TerminalGateway } from './presentation/terminal.gateway'

// Lines a script wrote are stored this often (a busy script writes hundreds a second)
const SCRIPT_LOG_FLUSH_MS = 250

@Module({
  controllers: [ExecutionsController],
  imports: [BotsModule, FilesModule, CraftingModule, TerminalCoreModule],
  providers: [
    TerminalGateway,
    {
      provide: LINK_GATE,
      inject: [APP_CONFIG, ENGINE_PORT],
      useFactory: (config: AppConfig, engine: EnginePort): LinkGate =>
        config.engine.isEnabled ? new EngineLinkGate(engine) : new OpenLinkGate()
    },
    {
      provide: TerminalService,
      inject: [TERMINAL_SESSION_REPOSITORY, BotsService, ID_GENERATOR, CLOCK, TERMINAL_RETENTION, LINK_GATE],
      useFactory: (
        sessions: TerminalSessionRepository,
        bots: BotsService,
        ids: IdGenerator,
        clock: Clock,
        retention: TerminalRetention,
        links: LinkGate
      ) => new TerminalService(sessions, bots, ids, clock, retention, links)
    },
    { provide: DELAY, useClass: SystemDelay },
    {
      provide: SCRIPT_RUNNER,
      inject: [ENGINE_PORT],
      useFactory: (engine: EnginePort) => new EngineScriptRunner(engine)
    },
    { provide: SCRIPT_OUTPUT_FEED, useExisting: SCRIPT_RUNNER },
    {
      provide: ScriptLogRecorder,
      inject: [SCRIPT_OUTPUT_FEED, TerminalService, CLOCK, LOGGER, TERMINAL_RETENTION],
      useFactory: (
        feed: ScriptOutputFeed,
        terminal: TerminalService,
        clock: Clock,
        logger: Logger,
        retention: TerminalRetention
      ) =>
        new ScriptLogRecorder(feed, terminal, clock, logger, {
          flushMs: SCRIPT_LOG_FLUSH_MS,
          get maxLinesPerBot() {
            return retention.maxLinesPerBot
          }
        })
    },
    {
      provide: TerminalShell,
      inject: [
        BotsService,
        FilesService,
        TerminalService,
        FactoryService,
        AssemblyService,
        RecipeService,
        MaintenanceService,
        SCRIPT_RUNNER,
        BotAccessService,
        DELAY,
        APP_CONFIG
      ],
      useFactory: (
        bots: BotsService,
        files: FilesService,
        terminal: TerminalService,
        factory: FactoryService,
        assembly: AssemblyService,
        recipes: RecipeService,
        maintenance: MaintenanceService,
        scripts: ScriptRunner,
        access: BotAccessService,
        delay: Delay,
        config: AppConfig
      ) =>
        createTerminalShell(
          bots,
          files,
          terminal,
          factory,
          assembly,
          recipes,
          maintenance,
          scripts,
          access,
          delay,
          config.botSecurity.attemptDelayMs
        )
    }
  ],
  exports: [TerminalService]
})
export class TerminalModule implements OnModuleInit, OnApplicationShutdown {
  constructor(@Inject(ScriptLogRecorder) private readonly recorder: ScriptLogRecorder) {}

  onModuleInit() {
    this.recorder.start()
  }

  async onApplicationShutdown() {
    await this.recorder.shutdown()
  }
}
