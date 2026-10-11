import { Prisma } from '@prisma/client'
import { PrismaBotRepository } from '../../bots/infrastructure/prisma-bot.repository'
import { PrismaFileRepository } from '../../files/infrastructure/prisma-file.repository'
import { PrismaMapRepository } from '../../map/infrastructure/prisma-map.repository'
import { PrismaModuleRepository } from '../../modules/infrastructure/prisma-module.repository'
import { PrismaUserRepository } from '../../users/infrastructure/prisma-user.repository'
import { Repositories } from '../application/unit-of-work'

export function createPrismaRepositories(db: Prisma.TransactionClient): Repositories {
  return {
    users: new PrismaUserRepository(db),
    bots: new PrismaBotRepository(db),
    modules: new PrismaModuleRepository(db),
    files: new PrismaFileRepository(db),
    map: new PrismaMapRepository(db)
  }
}
