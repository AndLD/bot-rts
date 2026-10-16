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
import { TRACE_STORE, TraceStore } from './application/trace-store'
import { TracesService } from './application/traces.service'
import { ElasticsearchClient } from './infrastructure/elasticsearch-client'
import { ElasticsearchLogStore } from './infrastructure/elasticsearch-log-store'
import { ElasticsearchTraceStore } from './infrastructure/elasticsearch-trace-store'
import { MemoryLogStore } from './infrastructure/memory-log-store'
import { MemoryTraceStore } from './infrastructure/memory-trace-store'
import { LOGS_SERVICE, LogsController } from './presentation/logs.controller'
import { TRACES_SERVICE, TracesController } from './presentation/traces.controller'

// The default range of a search of the log store, when the question names none
const DEFAULT_WINDOW_HOURS = 24

// The read-only connection to the Elasticsearch the gateway writes to
function createElasticsearchClient(config: AppConfig, logger: Logger): ElasticsearchClient {
  const { observability } = config

  return new ElasticsearchClient(
    {
      url: observability.elasticsearchUrl as string,
      apiKey: observability.elasticsearchApiKey,
      username: observability.elasticsearchUsername,
      password: observability.elasticsearchPassword,
      timeoutMs: observability.logSearchTimeoutMs
    },
    logger
  )
}

// Chooses where the console reads the log from (`LOG_STORE`): the recent lines of this process, or the Elasticsearch the gateway writes to
export function createLogStore(config: AppConfig, buffer: LogBuffer, clock: Clock, logger: Logger): LogStore {
  const { observability } = config
  if (observability.logStore === 'elasticsearch') {
    return new ElasticsearchLogStore(
      {
        index: observability.logIndex,
        maxWindowDays: observability.logSearchMaxWindowDays,
        defaultWindowHours: DEFAULT_WINDOW_HOURS
      },
      createElasticsearchClient(config, logger),
      clock
    )
  }

  return new MemoryLogStore(buffer, nodeId(), config.deployment.role === 'engine' ? 'botrts-engine' : 'botrts-api')
}

// Chooses where the console reads the spans from: the Elasticsearch next to the logs, or nowhere (the process keeps no spans)
export function createTraceStore(config: AppConfig, clock: Clock, logger: Logger): TraceStore {
  const { observability } = config

  return observability.logStore === 'elasticsearch'
    ? new ElasticsearchTraceStore(
        { index: observability.traceIndex, maxWindowDays: observability.logSearchMaxWindowDays },
        createElasticsearchClient(config, logger),
        clock
      )
    : new MemoryTraceStore()
}

// The log search and the slow-tick traces of the admin console; the audit trail is part of the admin module
@Module({
  imports: [AdminModule, AuthModule],
  controllers: [LogsController, TracesController],
  providers: [
    {
      provide: LOG_STORE,
      inject: [APP_CONFIG, LOG_BUFFER, CLOCK, LOGGER],
      useFactory: createLogStore
    },
    {
      provide: TRACE_STORE,
      inject: [APP_CONFIG, CLOCK, LOGGER],
      useFactory: createTraceStore
    },
    {
      provide: TRACES_SERVICE,
      inject: [TRACE_STORE, LOG_STORE],
      useFactory: (traces: TraceStore, logs: LogStore) => new TracesService(traces, logs)
    },
    {
      provide: LOGS_SERVICE,
      inject: [LOG_STORE, ENGINE_PORT],
      useFactory: (store: LogStore, engine: EnginePort) => new LogsService(store, engine)
    }
  ]
})
export class LogsModule {}
