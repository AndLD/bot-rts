import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { BotsService } from '../bots/application/bots.service'
import { BotsModule } from '../bots/bots.module'
import { ModuleRegistry } from '../modules/domain/module-registry'
import { ModulesModule } from '../modules/modules.module'
import { UNIT_OF_WORK, UnitOfWork } from '../persistence/application/unit-of-work'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { ENGINE_PORT, EnginePort } from '../engine/application/engine-port'
import { routedThroughEngine } from '../engine/infrastructure/route-through-engine'
import { ID_GENERATOR, IdGenerator } from '../shared/application/id-generator'
import { FILE_REPOSITORY, FileRepository } from './application/file.repository'
import { FilesService } from './application/files.service'
import { PrismaFileRepository } from './infrastructure/prisma-file.repository'
import { FilesController } from './presentation/files.controller'

@Module({
  imports: [BotsModule, ModulesModule],
  controllers: [FilesController],
  providers: [
    {
      provide: FILE_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaFileRepository(client)
    },
    {
      provide: FilesService,
      inject: [UNIT_OF_WORK, BotsService, FILE_REPOSITORY, ID_GENERATOR, ModuleRegistry, APP_CONFIG, ENGINE_PORT],
      useFactory: (
        unitOfWork: UnitOfWork,
        bots: BotsService,
        files: FileRepository,
        ids: IdGenerator,
        registry: ModuleRegistry,
        config: AppConfig,
        engine: EnginePort
      ) =>
        routedThroughEngine(new FilesService(unitOfWork, bots, files, ids, registry), engine, config.engine.isEnabled, {
          write: 'files.write',
          makeDirectory: 'files.makeDirectory',
          remove: 'files.remove'
        })
    }
  ],
  exports: [FILE_REPOSITORY, FilesService]
})
export class FilesModule {}
