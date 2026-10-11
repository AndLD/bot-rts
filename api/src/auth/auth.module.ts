import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { PrismaClient } from '@prisma/client'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { NotificationsModule } from '../notifications/notifications.module'
import { EMAIL_SENDER, EmailSender } from '../notifications/application/email-sender'
import { UNIT_OF_WORK, UnitOfWork } from '../persistence/application/unit-of-work'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import { ID_GENERATOR, IdGenerator } from '../shared/application/id-generator'
import { LOGGER, Logger } from '../shared/application/logger'
import { USER_REPOSITORY, UserRepository } from '../users/application/user.repository'
import { UsersModule } from '../users/users.module'
import { AuthService } from './application/auth.service'
import { CREDENTIAL_AUTH } from './application/credential-auth.service'
import { IDENTITY_VERIFIER, IdentityVerifier } from './application/identity-verifier'
import { LocalAuthService } from './application/local-auth.service'
import { LocalIdentityVerifier } from './application/local-identity.verifier'
import {
  ACCESS_TOKEN_SERVICE,
  AccessTokenService,
  AUTH_MAILER,
  AuthMailer,
  CREDENTIAL_REPOSITORY,
  IDENTITY_REPOSITORY,
  IdentityRepository,
  PASSWORD_HASHER,
  PasswordHasher,
  SECRET_GENERATOR,
  SecretGenerator,
  SESSION_REPOSITORY,
  SessionRepository,
  CredentialRepository
} from './application/ports'
import { UserProvisioner } from './application/user-provisioner'
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher'
import { CryptoSecretGenerator } from './infrastructure/crypto-secret-generator'
import { EmailAuthMailer } from './infrastructure/email-auth-mailer'
import { JwtAccessTokenService } from './infrastructure/jwt-access-token.service'
import { PrismaCredentialRepository } from './infrastructure/prisma-credential.repository'
import { PrismaIdentityRepository } from './infrastructure/prisma-identity.repository'
import { PrismaSessionRepository } from './infrastructure/prisma-session.repository'
import { AuthController, REFRESH_COOKIE_OPTIONS } from './presentation/auth.controller'
import { AuthGuard } from './presentation/auth.guard'
import { createRefreshCookieOptions } from './presentation/refresh-cookie'
import { RolesGuard } from './presentation/roles.guard'

// The adapter that verifies tokens is chosen by AUTH_PROVIDER. Only the custom (`local`) provider exists today; a hosted
// provider would add its own IdentityVerifier here and would not provide CREDENTIAL_AUTH.
@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        throttlers: [{ ttl: config.rateLimit.windowMs, limit: config.rateLimit.authMax }]
      })
    })
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: IDENTITY_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (c: PrismaClient) => new PrismaIdentityRepository(c)
    },
    {
      provide: CREDENTIAL_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (c: PrismaClient) => new PrismaCredentialRepository(c)
    },
    {
      provide: SESSION_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (c: PrismaClient) => new PrismaSessionRepository(c)
    },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: SECRET_GENERATOR, useClass: CryptoSecretGenerator },
    {
      provide: ACCESS_TOKEN_SERVICE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        new JwtAccessTokenService(config.auth.accessSecret, config.auth.accessTtlSeconds)
    },
    {
      provide: AUTH_MAILER,
      inject: [EMAIL_SENDER, APP_CONFIG],
      useFactory: (sender: EmailSender | undefined, config: AppConfig) =>
        new EmailAuthMailer(sender, config.frontendUrl)
    },
    {
      provide: IDENTITY_VERIFIER,
      inject: [ACCESS_TOKEN_SERVICE, SESSION_REPOSITORY, CREDENTIAL_REPOSITORY, USER_REPOSITORY, CLOCK],
      useFactory: (
        accessTokens: AccessTokenService,
        sessions: SessionRepository,
        credentials: CredentialRepository,
        users: UserRepository,
        clock: Clock
      ): IdentityVerifier => new LocalIdentityVerifier(accessTokens, sessions, credentials, users, clock)
    },
    {
      provide: CREDENTIAL_AUTH,
      inject: [
        UNIT_OF_WORK,
        PASSWORD_HASHER,
        SECRET_GENERATOR,
        ACCESS_TOKEN_SERVICE,
        AUTH_MAILER,
        ID_GENERATOR,
        CLOCK,
        APP_CONFIG,
        LOGGER
      ],
      useFactory: (
        unitOfWork: UnitOfWork,
        hasher: PasswordHasher,
        secrets: SecretGenerator,
        accessTokens: AccessTokenService,
        mailer: AuthMailer,
        ids: IdGenerator,
        clock: Clock,
        config: AppConfig,
        logger: Logger
      ) =>
        new LocalAuthService({
          unitOfWork,
          hasher,
          secrets,
          accessTokens,
          mailer,
          ids,
          clock,
          policy: config.auth.policy,
          logger
        })
    },
    {
      provide: UserProvisioner,
      inject: [USER_REPOSITORY, IDENTITY_REPOSITORY, ID_GENERATOR, CLOCK],
      useFactory: (users: UserRepository, identities: IdentityRepository, ids: IdGenerator, clock: Clock) =>
        new UserProvisioner(users, identities, ids, clock)
    },
    {
      provide: AuthService,
      inject: [IDENTITY_VERIFIER, UserProvisioner],
      useFactory: (verifier: IdentityVerifier, provisioner: UserProvisioner) => new AuthService(verifier, provisioner)
    },
    {
      provide: REFRESH_COOKIE_OPTIONS,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        createRefreshCookieOptions({ nodeEnv: config.nodeEnv, sessionTtlMs: config.auth.policy.sessionTtlMs })
    },
    // Deny by default: every route needs a signed-in player unless it is @Public(); roles are checked after that
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard }
  ],
  exports: [AuthService]
})
export class AuthModule {}
