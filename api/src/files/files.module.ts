import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { FILE_REPOSITORY } from './application/file.repository'
import { PrismaFileRepository } from './infrastructure/prisma-file.repository'

@Module({
  providers: [
    {
      provide: FILE_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaFileRepository(client)
    }
  ],
  exports: [FILE_REPOSITORY]
})
export class FilesModule {}
