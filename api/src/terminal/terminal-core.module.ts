import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PASSWORD_HASHER, PasswordHasher } from '../auth/application/ports'
import { AuthModule } from '../auth/auth.module'
import { BOT_REPOSITORY, BotRepository } from '../bots/application/bot.repository'
import { BotsService } from '../bots/application/bots.service'
import { BotsModule } from '../bots/bots.module'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { ENGINE_PORT, EnginePort } from '../engine/application/engine-port'
import { routedThroughEngine } from '../engine/infrastructure/route-through-engine'
import { MAP_REPOSITORY, MapRepository } from '../map/application/map.repository'
import { MapModule } from '../map/map.module'
import { EnergyService } from '../modules/application/energy.service'
import { MODULE_REPOSITORY, ModuleRepository } from '../modules/application/module.repository'
import { ModuleRegistry } from '../modules/domain/module-registry'
import { ModulesModule } from '../modules/modules.module'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import { ID_GENERATOR, IdGenerator } from '../shared/application/id-generator'
import { BOT_ACCESS_REPOSITORY, BotAccessRepository } from './application/bot-access.repository'
import { BotAccessService } from './application/bot-access.service'
import { SecurityLog, SessionLogWriter, SessionSecurityLog } from './application/session-log-writer'
import { TERMINAL_SESSION_REPOSITORY, TerminalSessionRepository } from './application/terminal-session.repository'
import { TERMINAL_RETENTION, TerminalRetention } from './domain/terminal-retention'
import { PrismaBotAccessRepository } from './infrastructure/prisma-bot-access.repository'
import { PrismaTerminalSessionRepository } from './infrastructure/prisma-terminal-session.repository'

const SECURITY_LOG = Symbol('SecurityLog')

// What the terminal and the engine both need: the stored sessions and the access rules of bots. The engine thread uses it too,
// since connecting to a bot costs energy and adopting one changes who owns it, which only the engine may do (design §14.2).
@Module({
  imports: [AuthModule, BotsModule, MapModule, ModulesModule],
  providers: [
    {
      provide: TERMINAL_SESSION_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaTerminalSessionRepository(client)
    },
    { provide: TERMINAL_RETENTION, inject: [APP_CONFIG], useFactory: (config: AppConfig) => config.terminal },
    {
      provide: BOT_ACCESS_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaBotAccessRepository(client)
    },
    {
      provide: SECURITY_LOG,
      inject: [TERMINAL_SESSION_REPOSITORY, ID_GENERATOR, CLOCK, TERMINAL_RETENTION],
      useFactory: (
        sessions: TerminalSessionRepository,
        ids: IdGenerator,
        clock: Clock,
        retention: TerminalRetention
      ): SecurityLog => new SessionSecurityLog(new SessionLogWriter(sessions, ids, clock, retention))
    },
    {
      provide: BotAccessService,
      inject: [
        BotsService,
        BOT_REPOSITORY,
        MODULE_REPOSITORY,
        MAP_REPOSITORY,
        ModuleRegistry,
        EnergyService,
        PASSWORD_HASHER,
        BOT_ACCESS_REPOSITORY,
        SECURITY_LOG,
        CLOCK,
        APP_CONFIG,
        ENGINE_PORT
      ],
      useFactory: (
        bots: BotsService,
        botRepository: BotRepository,
        modules: ModuleRepository,
        map: MapRepository,
        registry: ModuleRegistry,
        energy: EnergyService,
        hasher: PasswordHasher,
        access: BotAccessRepository,
        securityLog: SecurityLog,
        clock: Clock,
        config: AppConfig,
        engine: EnginePort
      ) =>
        routedThroughEngine(
          new BotAccessService(
            bots,
            botRepository,
            modules,
            map,
            registry,
            energy,
            hasher,
            access,
            securityLog,
            clock,
            config.botSecurity
          ),
          engine,
          config.engine.isEnabled,
          { connect: 'access.connect', adopt: 'access.adopt' }
        )
    }
  ],
  exports: [TERMINAL_SESSION_REPOSITORY, TERMINAL_RETENTION, BotAccessService]
})
export class TerminalCoreModule {}
