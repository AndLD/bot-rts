import { Module } from '@nestjs/common'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { PrismaClient } from '@prisma/client'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import { ID_GENERATOR, IdGenerator } from '../shared/application/id-generator'
import { AuditService } from './application/audit.service'
import {
  AUDIT_LOG,
  AuditLog,
  RECOVERY_CODES,
  RecoveryCodes,
  SECOND_FACTOR_REPOSITORY,
  SECRET_CIPHER,
  SecondFactorRepository,
  SecretCipher,
  TOTP,
  Totp
} from './application/ports'
import { SecondFactorService } from './application/second-factor.service'
import { AesSecretCipher } from './infrastructure/aes-secret-cipher'
import { CryptoRecoveryCodes } from './infrastructure/crypto-recovery-codes'
import { CryptoTotp } from './infrastructure/crypto-totp'
import { PrismaAuditLog } from './infrastructure/prisma-audit-log'
import { PrismaSecondFactorRepository } from './infrastructure/prisma-second-factor.repository'
import { AdminAccessGuard } from './presentation/admin-access.guard'
import { AdminController } from './presentation/admin.controller'
import { AuditController } from './presentation/audit.controller'
import { AuditInterceptor } from './presentation/audit.interceptor'

// The admin console's foundations (design §25.2): roles and permissions, the second factor and the audit trail. The console's
// own routes live under /api/v1/admin and name a permission with @RequirePermission().
@Module({
  controllers: [AdminController, AuditController],
  providers: [
    { provide: AUDIT_LOG, inject: [PRISMA_CLIENT], useFactory: (c: PrismaClient) => new PrismaAuditLog(c) },
    {
      provide: SECOND_FACTOR_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (c: PrismaClient) => new PrismaSecondFactorRepository(c)
    },
    { provide: TOTP, useClass: CryptoTotp },
    { provide: RECOVERY_CODES, useClass: CryptoRecoveryCodes },
    {
      provide: SECRET_CIPHER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => new AesSecretCipher(config.admin.secret)
    },
    {
      provide: AuditService,
      inject: [AUDIT_LOG, ID_GENERATOR, CLOCK],
      useFactory: (log: AuditLog, ids: IdGenerator, clock: Clock) => new AuditService(log, ids, clock)
    },
    {
      provide: SecondFactorService,
      inject: [SECOND_FACTOR_REPOSITORY, TOTP, SECRET_CIPHER, RECOVERY_CODES, CLOCK, APP_CONFIG],
      useFactory: (
        factors: SecondFactorRepository,
        totp: Totp,
        cipher: SecretCipher,
        recovery: RecoveryCodes,
        clock: Clock,
        config: AppConfig
      ) =>
        new SecondFactorService(factors, totp, cipher, recovery, clock, {
          issuer: config.admin.totpIssuer,
          verificationTtlMs: config.admin.verificationTtlMs,
          recoveryCodeCount: config.admin.recoveryCodeCount
        })
    },
    // After authentication (AuthModule is imported first): the permission, the address and the second factor
    { provide: APP_GUARD, useClass: AdminAccessGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }
  ],
  exports: [SecondFactorService, AuditService]
})
export class AdminModule {}
