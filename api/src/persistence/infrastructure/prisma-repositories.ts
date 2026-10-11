import { Prisma } from '@prisma/client'
import { PrismaCredentialRepository } from '../../auth/infrastructure/prisma-credential.repository'
import { PrismaAuthTokenRepository } from '../../auth/infrastructure/prisma-auth-token.repository'
import { PrismaIdentityRepository } from '../../auth/infrastructure/prisma-identity.repository'
import { PrismaSessionRepository } from '../../auth/infrastructure/prisma-session.repository'
import { PrismaItemRepository } from '../../crafting/infrastructure/prisma-item.repository'
import { PrismaBotRepository } from '../../bots/infrastructure/prisma-bot.repository'
import { PrismaFileRepository } from '../../files/infrastructure/prisma-file.repository'
import { PrismaMapRepository } from '../../map/infrastructure/prisma-map.repository'
import { PrismaModuleRepository } from '../../modules/infrastructure/prisma-module.repository'
import { PrismaSpawnSeedRepository } from '../../spawn/infrastructure/prisma-spawn-seed.repository'
import { PrismaUserRepository } from '../../users/infrastructure/prisma-user.repository'
import { Repositories } from '../application/unit-of-work'

export function createPrismaRepositories(db: Prisma.TransactionClient): Repositories {
  return {
    users: new PrismaUserRepository(db),
    bots: new PrismaBotRepository(db),
    modules: new PrismaModuleRepository(db),
    files: new PrismaFileRepository(db),
    items: new PrismaItemRepository(db),
    map: new PrismaMapRepository(db),
    spawnSeeds: new PrismaSpawnSeedRepository(db),
    identities: new PrismaIdentityRepository(db),
    credentials: new PrismaCredentialRepository(db),
    sessions: new PrismaSessionRepository(db),
    authTokens: new PrismaAuthTokenRepository(db)
  }
}
