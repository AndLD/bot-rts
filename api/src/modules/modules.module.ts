import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { ID_GENERATOR, IdGenerator } from '../shared/application/id-generator'
import { MODULE_REPOSITORY } from './application/module.repository'
import { ModuleFactory } from './application/module.factory'
import { createModuleRegistry, ModuleRegistry } from './domain/module-registry'
import { PrismaModuleRepository } from './infrastructure/prisma-module.repository'

@Module({
  providers: [
    {
      provide: MODULE_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaModuleRepository(client)
    },
    { provide: ModuleRegistry, useFactory: createModuleRegistry },
    {
      provide: ModuleFactory,
      inject: [ID_GENERATOR],
      useFactory: (ids: IdGenerator) => new ModuleFactory(ids)
    }
  ],
  exports: [MODULE_REPOSITORY, ModuleRegistry, ModuleFactory]
})
export class ModulesModule {}
