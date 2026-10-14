import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { AdminModule } from '../admin/admin.module'
import { ApiKeyService } from '../apikeys/application/api-key.service'
import { RateLimitHits } from '../apikeys/application/rate-limit-hits'
import { API_KEY_SERVICE } from '../apikeys/presentation/api-keys.controller'
import { ApiKeysModule } from '../apikeys/apikeys.module'
import { AuthModule } from '../auth/auth.module'
import { ENGINE_PORT, EnginePort } from '../engine/application/engine-port'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import { SECURITY_READ_MODEL, SecurityReadModel } from './application/ports'
import { SecurityService } from './application/security.service'
import { PrismaSecurityReadModel } from './infrastructure/prisma-security-read-model'
import { SECURITY_SERVICE, SecurityController } from './presentation/security.controller'

// The Security page of the admin console
@Module({
  imports: [AdminModule, AuthModule, ApiKeysModule],
  controllers: [SecurityController],
  providers: [
    {
      provide: SECURITY_READ_MODEL,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaSecurityReadModel(client)
    },
    {
      provide: SECURITY_SERVICE,
      inject: [SECURITY_READ_MODEL, RateLimitHits, API_KEY_SERVICE, ENGINE_PORT, CLOCK],
      useFactory: (
        readModel: SecurityReadModel,
        hits: RateLimitHits,
        keys: ApiKeyService,
        engine: EnginePort,
        clock: Clock
      ) => new SecurityService(readModel, hits, keys, engine, clock)
    }
  ]
})
export class SecurityModule {}
