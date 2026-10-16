import { Module } from '@nestjs/common'
import { AdminModule } from '../admin/admin.module'
import { AuthModule } from '../auth/auth.module'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { ENGINE_PORT, EnginePort } from '../engine/application/engine-port'
import { CLOCK, Clock } from '../shared/application/clock'
import { LOG_BUFFER, LogBuffer } from '../shared/application/log-buffer'
import { LOGGER, Logger } from '../shared/application/logger'
import { nodeId } from '../shared/infrastructure/node-id'
import { LOG_STORE, LogStore } from './application/log-store'
import { LogsService } from './application/logs.service'
import { ElasticsearchLogStore } from './infrastructure/elasticsearch-log-store'
import { MemoryLogStore } from './infrastructure/memory-log-store'
import { LOGS_SERVICE, LogsController } from './presentation/logs.controller'

// The default range of a search of the log store, when the question names none
const DEFAULT_WINDOW_HOURS = 24

// Chooses where the console reads the log from (`LOG_STORE`): the recent lines of this process, or the Elasticsearch the gateway writes to
export function createLogStore(config: AppConfig, buffer: LogBuffer, clock: Clock, logger: Logger): LogStore {
  const { observability } = config
  if (observability.logStore === 'elasticsearch') {
    return new ElasticsearchLogStore(
      {
        url: observability.elasticsearchUrl as string,
        apiKey: observability.elasticsearchApiKey,
        username: observability.elasticsearchUsername,
        password: observability.elasticsearchPassword,
        index: observability.logIndex,
        timeoutMs: observability.logSearchTimeoutMs,
        maxWindowDays: observability.logSearchMaxWindowDays,
        defaultWindowHours: DEFAULT_WINDOW_HOURS
      },
      clock,
      logger
    )
  }

  return new MemoryLogStore(buffer, nodeId(), config.deployment.role === 'engine' ? 'botrts-engine' : 'botrts-api')
}

// The log search and the slow-tick traces of the admin console; the audit trail is part of the admin module
@Module({
  imports: [AdminModule, AuthModule],
  controllers: [LogsController],
  providers: [
    {
      provide: LOG_STORE,
      inject: [APP_CONFIG, LOG_BUFFER, CLOCK, LOGGER],
      useFactory: createLogStore
    },
    {
      provide: LOGS_SERVICE,
      inject: [LOG_STORE, ENGINE_PORT],
      useFactory: (store: LogStore, engine: EnginePort) => new LogsService(store, engine)
    }
  ]
})
export class LogsModule {}
