import { Global, Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { AdminModule } from '../admin/admin.module'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { JOB_STATUS_STORE } from '../operations/application/ports'
import { PrismaOperationsStore } from '../operations/infrastructure/prisma-operations.store'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import { LOGGER, Logger } from '../shared/application/logger'
import {
  RETENTION_POLICY,
  RETENTION_STORE,
  RetentionSettingsService,
  RetentionStore
} from './application/retention-settings.service'
import { retentionDefaults } from './domain/retention-defaults'
import { PrismaRetentionStore } from './infrastructure/prisma-retention.store'
import { RetentionController } from './presentation/retention.controller'

// How long a node keeps the retention values it read before the writers of retained data read them again
const SNAPSHOT_CACHE_MS = 5000

// The retention settings of the game (design §25.3). Global, because the jobs and the writers of retained data of other features read
// the values in force through RETENTION_POLICY.
@Global()
@Module({
  imports: [AdminModule],
  controllers: [RetentionController],
  providers: [
    { provide: RETENTION_STORE, inject: [PRISMA_CLIENT], useFactory: (c: PrismaClient) => new PrismaRetentionStore(c) },
    {
      provide: JOB_STATUS_STORE,
      inject: [PRISMA_CLIENT, CLOCK],
      useFactory: (client: PrismaClient, clock: Clock) => new PrismaOperationsStore(client, clock)
    },
    {
      provide: RetentionSettingsService,
      inject: [RETENTION_STORE, APP_CONFIG, CLOCK, LOGGER],
      useFactory: (store: RetentionStore, config: AppConfig, clock: Clock, logger: Logger) =>
        new RetentionSettingsService(store, retentionDefaults(config), clock, SNAPSHOT_CACHE_MS, logger)
    },
    { provide: RETENTION_POLICY, useExisting: RetentionSettingsService }
  ],
  exports: [RetentionSettingsService, RETENTION_POLICY]
})
export class RetentionModule {}
