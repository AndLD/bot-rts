import { Inject, Module, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { AdminModule } from '../admin/admin.module'
import { AuditService } from '../admin/application/audit.service'
import { CREDENTIAL_AUTH, CredentialAuthService } from '../auth/application/credential-auth.service'
import { AuthModule } from '../auth/auth.module'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { UNIT_OF_WORK, UnitOfWork } from '../persistence/application/unit-of-work'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import { ID_GENERATOR, IdGenerator } from '../shared/application/id-generator'
import { LOGGER, Logger } from '../shared/application/logger'
import { PlayersService } from './application/players.service'
import {
  PLAYER_DIRECTORY,
  PLAYER_MODERATION_REPOSITORY,
  PlayerDirectory,
  PlayerModerationRepository
} from './application/ports'
import { PrismaPlayerDirectory } from './infrastructure/prisma-player-directory'
import { PrismaPlayerModerationRepository } from './infrastructure/prisma-player-moderation.repository'
import { PLAYERS_SERVICE, PlayersController } from './presentation/players.controller'

const EXPIRED_BANS_INTERVAL_MS = 60_000

// The Players page of the admin console. Bans with a duration end by themselves: a timer on the nodes that own the data lifecycle
// lifts them.
@Module({
  imports: [AdminModule, AuthModule],
  controllers: [PlayersController],
  providers: [
    {
      provide: PLAYER_DIRECTORY,
      inject: [PRISMA_CLIENT],
      useFactory: (c: PrismaClient) => new PrismaPlayerDirectory(c)
    },
    {
      provide: PLAYER_MODERATION_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (c: PrismaClient) => new PrismaPlayerModerationRepository(c)
    },
    {
      provide: PLAYERS_SERVICE,
      inject: [
        PLAYER_DIRECTORY,
        PLAYER_MODERATION_REPOSITORY,
        UNIT_OF_WORK,
        AuditService,
        { token: CREDENTIAL_AUTH, optional: true },
        ID_GENERATOR,
        CLOCK
      ],
      useFactory: (
        directory: PlayerDirectory,
        moderation: PlayerModerationRepository,
        unitOfWork: UnitOfWork,
        audit: AuditService,
        credentials: CredentialAuthService | undefined,
        ids: IdGenerator,
        clock: Clock
      ) => new PlayersService(directory, moderation, unitOfWork, audit, credentials, ids, clock)
    }
  ]
})
export class PlayersModule implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null

  constructor(
    @Inject(PLAYERS_SERVICE) private readonly players: PlayersService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(LOGGER) private readonly logger: Logger
  ) {}

  onApplicationBootstrap() {
    if (this.config.lifecycle.isEnabled && this.config.deployment.role !== 'api') {
      this.timer = setInterval(
        () => void this.players.liftExpiredBans().catch((error: unknown) => this.logger.error(error)),
        EXPIRED_BANS_INTERVAL_MS
      )
      this.timer.unref()
    }
  }

  onApplicationShutdown() {
    if (this.timer) {
      clearInterval(this.timer)
    }
  }
}
