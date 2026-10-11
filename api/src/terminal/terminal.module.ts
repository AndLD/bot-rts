import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { FilesModule } from '../files/files.module'
import { FilesService } from '../files/application/files.service'
import { BotsModule } from '../bots/bots.module'
import { BotsService } from '../bots/application/bots.service'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import { ID_GENERATOR, IdGenerator } from '../shared/application/id-generator'
import { TERMINAL_SESSION_REPOSITORY, TerminalSessionRepository } from './application/terminal-session.repository'
import { createTerminalShell } from './application/shell/create-terminal-shell'
import { TerminalShell } from './application/shell/terminal-shell.service'
import { TerminalService } from './application/terminal.service'
import { TERMINAL_RETENTION, TerminalRetention } from './domain/terminal-retention'
import { PrismaTerminalSessionRepository } from './infrastructure/prisma-terminal-session.repository'
import { TerminalGateway } from './presentation/terminal.gateway'

@Module({
  imports: [BotsModule, FilesModule],
  providers: [
    TerminalGateway,
    {
      provide: TERMINAL_SESSION_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaTerminalSessionRepository(client)
    },
    { provide: TERMINAL_RETENTION, inject: [APP_CONFIG], useFactory: (config: AppConfig) => config.terminal },
    {
      provide: TerminalService,
      inject: [TERMINAL_SESSION_REPOSITORY, BotsService, ID_GENERATOR, CLOCK, TERMINAL_RETENTION],
      useFactory: (
        sessions: TerminalSessionRepository,
        bots: BotsService,
        ids: IdGenerator,
        clock: Clock,
        retention: TerminalRetention
      ) => new TerminalService(sessions, bots, ids, clock, retention)
    },
    {
      provide: TerminalShell,
      inject: [BotsService, FilesService, TerminalService],
      useFactory: createTerminalShell
    }
  ],
  exports: [TerminalService]
})
export class TerminalModule {}
