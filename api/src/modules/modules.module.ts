import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { MODULE_REPOSITORY } from './application/module.repository'
import { PrismaModuleRepository } from './infrastructure/prisma-module.repository'

@Module({
  providers: [
    {
      provide: MODULE_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaModuleRepository(client)
    }
  ],
  exports: [MODULE_REPOSITORY]
})
export class ModulesModule {}
