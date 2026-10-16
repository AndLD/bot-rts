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
  LOG_RETENTION,
  LogRetention,
  NO_LOG_RETENTION,
  RETENTION_POLICY,
  RETENTION_STORE,
  RetentionSettingsService,
  RetentionStore
} from './application/retention-settings.service'
import { ElasticsearchClient } from '../logs/infrastructure/elasticsearch-client'
import { ElasticsearchLogRetention } from '../logs/infrastructure/elasticsearch-log-retention'
import { retentionDefaults } from './domain/retention-defaults'
import { PrismaRetentionStore } from './infrastructure/prisma-retention.store'
import { RetentionController } from './presentation/retention.controller'

// How long a node keeps the retention values it read before the writers of retained data read them again
const SNAPSHOT_CACHE_MS = 5000

// The retention of the logs is applied to the log store with an account that may change its lifecycle policy; a deployment without the
// log store, or without such an account, keeps the setting and applies nothing
export function createLogRetention(config: AppConfig, logger: Logger): LogRetention {
  const { observability } = config
  const hasAccount = observability.elasticsearchAdminApiKey || observability.elasticsearchAdminUsername !== undefined

  if (observability.logStore !== 'elasticsearch' || !hasAccount) {
    return NO_LOG_RETENTION
  }

  return new ElasticsearchLogRetention(
    new ElasticsearchClient(
      {
        url: observability.elasticsearchUrl as string,
        apiKey: observability.elasticsearchAdminApiKey,
        username: observability.elasticsearchAdminUsername,
        password: observability.elasticsearchAdminPassword,
        timeoutMs: observability.logSearchTimeoutMs
      },
      logger
    )
  )
}

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
      provide: LOG_RETENTION,
      inject: [APP_CONFIG, LOGGER],
      useFactory: createLogRetention
    },
    {
      provide: RetentionSettingsService,
      inject: [RETENTION_STORE, APP_CONFIG, CLOCK, LOGGER, LOG_RETENTION],
      useFactory: (store: RetentionStore, config: AppConfig, clock: Clock, logger: Logger, logs: LogRetention) =>
        new RetentionSettingsService(store, retentionDefaults(config), clock, SNAPSHOT_CACHE_MS, logger, logs)
    },
    { provide: RETENTION_POLICY, useExisting: RetentionSettingsService }
  ],
  exports: [RetentionSettingsService, RETENTION_POLICY]
})
export class RetentionModule {}
