import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import { ID_GENERATOR, IdGenerator } from '../shared/application/id-generator'
import { USER_REPOSITORY, UserRepository } from '../users/application/user.repository'
import { UsersModule } from '../users/users.module'
import { API_KEY_AUTHENTICATOR } from '../auth/application/api-key-authenticator'
import { RateLimitHits } from './application/rate-limit-hits'
import { API_KEY_REPOSITORY, ApiKeyRepository } from './application/api-key.repository'
import { ApiKeyService } from './application/api-key.service'
import { KEY_SECRETS, KeySecrets } from './application/key-secrets'
import { CryptoKeySecrets } from './infrastructure/crypto-key-secrets'
import { PrismaApiKeyRepository } from './infrastructure/prisma-api-key.repository'
import { API_KEY_SERVICE, ApiKeysController } from './presentation/api-keys.controller'

// API keys (design §22.1): creating, listing and revoking them, and authenticating a request that carries one. The guard that
// holds a key to its scopes is registered by the auth module, right after authentication.
@Module({
  imports: [UsersModule],
  controllers: [ApiKeysController],
  providers: [
    RateLimitHits,
    { provide: KEY_SECRETS, useClass: CryptoKeySecrets },
    {
      provide: API_KEY_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaApiKeyRepository(client)
    },
    {
      provide: API_KEY_SERVICE,
      inject: [API_KEY_REPOSITORY, USER_REPOSITORY, KEY_SECRETS, ID_GENERATOR, CLOCK],
      useFactory: (
        keys: ApiKeyRepository,
        users: UserRepository,
        secrets: KeySecrets,
        ids: IdGenerator,
        clock: Clock
      ) => new ApiKeyService(keys, users, secrets, ids, clock)
    },
    { provide: API_KEY_AUTHENTICATOR, useExisting: API_KEY_SERVICE }
  ],
  exports: [API_KEY_AUTHENTICATOR, API_KEY_SERVICE, RateLimitHits]
})
export class ApiKeysModule {}
