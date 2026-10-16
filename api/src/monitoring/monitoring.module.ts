import { Inject, Module, OnApplicationBootstrap, OnApplicationShutdown, OnModuleInit } from '@nestjs/common'
import { runJob, TRACING, Tracing } from '../shared/application/tracing'
import { RETENTION_POLICY, RetentionPolicy } from '../retention/application/retention-settings.service'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { ENGINE_PORT, EnginePort } from '../engine/application/engine-port'
import { HttpMetrics } from '../metrics/application/http-metrics'
import { MetricCollectors } from '../metrics/application/metric-collectors'
import { EMAIL_SENDER, EmailSender } from '../notifications/application/email-sender'
import { NotificationsModule } from '../notifications/notifications.module'
import { CLOCK, Clock } from '../shared/application/clock'
import { ID_GENERATOR, IdGenerator } from '../shared/application/id-generator'
import { LOGGER, Logger } from '../shared/application/logger'
import { AdminModule } from '../admin/admin.module'
import { AuthModule } from '../auth/auth.module'
import { AlertManager } from './application/alert-manager'
import { MetricHistory } from './application/metric-history'
import { MetricHistoryRepository, METRIC_HISTORY_REPOSITORY } from './application/metric-history.repository'
import {
  MemoryMetricHistoryStore,
  METRIC_HISTORY_STORE,
  MetricHistoryStore,
  PersistentMetricHistoryStore
} from './application/metric-history-store'
import { PrismaMetricHistoryRepository } from './infrastructure/prisma-metric-history.repository'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { PrismaClient } from '@prisma/client'
import { API_ACTIVITY, ApiActivity } from '../shared/application/api-activity'
import { nodeId } from '../shared/infrastructure/node-id'
import { MONITORING_SERVICE, MonitoringService } from './application/monitoring.service'
import { ALERT_NOTIFIER, AlertNotifier, METRICS_PORT, MetricsPort } from './application/ports'
import { EmailAlertNotifier } from './infrastructure/email-alert-notifier'
import { gatewayProbeFor } from './infrastructure/http-gateway.probe'
import { RuntimeMetricsPort } from './infrastructure/runtime-metrics.port'
import { MonitoringController } from './presentation/monitoring.controller'
import { MonitoringGateway } from './presentation/monitoring.gateway'

// Health, performance and load for the admin console (design §25.5). Each process samples itself. Its finest tier is in its memory; with
// `MONITORING_HISTORY=postgres` the one-minute tier of every node is in the database, so the console shows them together.
const DAY_MS = 24 * 60 * 60 * 1000
// A sample must not wait for a gateway that does not answer
const GATEWAY_TIMEOUT_MS = 2000

// Chooses where the history is kept (`MONITORING_HISTORY`)
export function createHistoryStore(
  config: AppConfig,
  repository: MetricHistoryRepository,
  logger: Logger
): MetricHistoryStore {
  const { monitoring } = config
  const fine = { stepMs: monitoring.sampleIntervalMs, retentionMs: monitoring.fineRetentionMs }

  return monitoring.history === 'postgres'
    ? new PersistentMetricHistoryStore(new MetricHistory([fine]), repository, nodeId(), logger)
    : new MemoryMetricHistoryStore(
        new MetricHistory([fine, { stepMs: monitoring.coarseStepMs, retentionMs: monitoring.coarseRetentionMs }]),
        nodeId()
      )
}

@Module({
  imports: [NotificationsModule, AdminModule, AuthModule],
  controllers: [MonitoringController],
  providers: [
    MonitoringGateway,
    {
      provide: METRICS_PORT,
      inject: [ENGINE_PORT, HttpMetrics, APP_CONFIG, CLOCK, API_ACTIVITY],
      useFactory: (engine: EnginePort, http: HttpMetrics, config: AppConfig, clock: Clock, activity: ApiActivity) =>
        new RuntimeMetricsPort(
          engine,
          http,
          () => ({ rssBytes: process.memoryUsage().rss, heapUsedBytes: process.memoryUsage().heapUsed }),
          config.engine.tickIntervalMs,
          clock,
          gatewayProbeFor(config.observability, GATEWAY_TIMEOUT_MS),
          activity
        )
    },
    {
      provide: ALERT_NOTIFIER,
      inject: [EMAIL_SENDER, APP_CONFIG],
      useFactory: (sender: EmailSender | undefined, config: AppConfig) =>
        new EmailAlertNotifier(sender, config.monitoring.alertEmails, config.adminUrl)
    },
    {
      provide: METRIC_HISTORY_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaMetricHistoryRepository(client)
    },
    {
      provide: METRIC_HISTORY_STORE,
      inject: [APP_CONFIG, METRIC_HISTORY_REPOSITORY, LOGGER],
      useFactory: createHistoryStore
    },
    {
      provide: MONITORING_SERVICE,
      inject: [METRICS_PORT, METRIC_HISTORY_STORE, ALERT_NOTIFIER, ID_GENERATOR, CLOCK, APP_CONFIG, LOGGER],
      useFactory: (
        port: MetricsPort,
        history: MetricHistoryStore,
        notifier: AlertNotifier,
        ids: IdGenerator,
        clock: Clock,
        config: AppConfig,
        logger: Logger
      ) =>
        new MonitoringService(
          port,
          history,
          new AlertManager(config.monitoring.thresholds, notifier, ids, clock),
          clock,
          logger
        )
    }
  ],
  exports: [MONITORING_SERVICE]
})
export class MonitoringModule implements OnModuleInit, OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null

  constructor(
    @Inject(MONITORING_SERVICE) private readonly monitoring: MonitoringService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly collectors: MetricCollectors,
    @Inject(RETENTION_POLICY) private readonly retention: RetentionPolicy,
    @Inject(TRACING) private readonly tracing: Tracing
  ) {}

  // Open alerts are also a series for the operator's scraper
  onModuleInit() {
    this.collectors.register((text) => {
      text.family('botrts_alerts_open', 'gauge', 'Open console alerts by severity')
      for (const severity of ['yellow', 'red'] as const) {
        const count = this.monitoring.health().alerts.filter((alert) => alert.severity === severity).length
        text.sample('botrts_alerts_open', count, { severity })
      }
    })
  }

  onApplicationBootstrap() {
    if (this.config.monitoring.isEnabled) {
      this.timer = setInterval(
        () => void runJob(this.tracing, 'monitoring-sample', () => this.tick()),
        this.config.monitoring.sampleIntervalMs
      )
      this.timer.unref()
    }
  }

  // Applies the ranges of the history in force (the console may have changed them), then takes a sample
  private async tick(): Promise<void> {
    const { monitoring } = this.retention.snapshot()

    this.monitoring.retuneHistory([
      (monitoring.fineDays as number) * DAY_MS,
      (monitoring.coarseDays as number) * DAY_MS
    ])
    await this.monitoring.sampleOnce()
  }

  async onApplicationShutdown() {
    if (this.timer) {
      clearInterval(this.timer)
    }
    await this.monitoring.flushHistory()
  }
}
