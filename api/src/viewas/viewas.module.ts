import { Module } from '@nestjs/common'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { AdminModule } from '../admin/admin.module'
import { AuditService } from '../admin/application/audit.service'
import {
  ACCESS_TOKEN_SERVICE,
  AccessTokenService,
  SESSION_REPOSITORY,
  SessionRepository
} from '../auth/application/ports'
import { AuthModule } from '../auth/auth.module'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { CLOCK, Clock } from '../shared/application/clock'
import { ID_GENERATOR, IdGenerator } from '../shared/application/id-generator'
import { USER_REPOSITORY, UserRepository } from '../users/application/user.repository'
import { UsersModule } from '../users/users.module'
import { ViewAsService } from './application/view-as.service'
import { VIEW_AS_SERVICE, ViewAsController } from './presentation/view-as.controller'
import { ViewAsAuditInterceptor } from './presentation/view-as-audit.interceptor'
import { ViewAsGuard } from './presentation/view-as.guard'
import { ViewAsSocketGateway } from './presentation/view-as-socket.gateway'

// "View as player" (design §25.2): the session of an admin that shows a player's game in read-only mode. The guard and the socket
// gateway make it read-only on the server.
@Module({
  imports: [AdminModule, AuthModule, UsersModule],
  controllers: [ViewAsController],
  providers: [
    {
      provide: VIEW_AS_SERVICE,
      inject: [
        SESSION_REPOSITORY,
        USER_REPOSITORY,
        ACCESS_TOKEN_SERVICE,
        AuditService,
        ID_GENERATOR,
        CLOCK,
        APP_CONFIG
      ],
      useFactory: (
        sessions: SessionRepository,
        users: UserRepository,
        accessTokens: AccessTokenService,
        audit: AuditService,
        ids: IdGenerator,
        clock: Clock,
        config: AppConfig
      ) => new ViewAsService(sessions, users, accessTokens, audit, ids, clock, config.admin.viewAsTtlMs)
    },
    ViewAsSocketGateway,
    // After authentication (AuthModule is imported first)
    { provide: APP_GUARD, useClass: ViewAsGuard },
    { provide: APP_INTERCEPTOR, useClass: ViewAsAuditInterceptor }
  ]
})
export class ViewAsModule {}
