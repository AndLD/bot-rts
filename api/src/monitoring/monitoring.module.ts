import { Inject, Module, OnApplicationBootstrap, OnApplicationShutdown, OnModuleInit } from '@nestjs/common'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { ENGINE_PORT, EnginePort } from '../engine/application/engine-port'
import { HttpMetrics } from '../metrics/application/http-metrics'
import { MetricCollectors } from '../metrics/application/metric-collectors'
import { EMAIL_SENDER, EmailSender } from '../notifications/application/email-sender'
import { NotificationsModule } from '../notifications/notifications.module'
import { CLOCK, Clock } from '../shared/application/clock'
import { ID_GENERATOR, IdGenerator } from '../shared/application/id-generator'
import { LOGGER, Logger } from '../shared/application/logger'
import { AlertManager } from './application/alert-manager'
import { MetricHistory } from './application/metric-history'
import { MONITORING_SERVICE, MonitoringService } from './application/monitoring.service'
import { ALERT_NOTIFIER, AlertNotifier, METRICS_PORT, MetricsPort } from './application/ports'
import { EmailAlertNotifier } from './infrastructure/email-alert-notifier'
import { RuntimeMetricsPort } from './infrastructure/runtime-metrics.port'
import { MonitoringController } from './presentation/monitoring.controller'

// Health, performance and load for the admin console (design §25.5). Each process samples itself: its history is in memory.
@Module({
  imports: [NotificationsModule],
  controllers: [MonitoringController],
  providers: [
    {
      provide: METRICS_PORT,
      inject: [ENGINE_PORT, HttpMetrics, APP_CONFIG, CLOCK],
      useFactory: (engine: EnginePort, http: HttpMetrics, config: AppConfig, clock: Clock) =>
        new RuntimeMetricsPort(
          engine,
          http,
          () => ({ rssBytes: process.memoryUsage().rss, heapUsedBytes: process.memoryUsage().heapUsed }),
          config.engine.tickIntervalMs,
          clock
        )
    },
    {
      provide: ALERT_NOTIFIER,
      inject: [EMAIL_SENDER, APP_CONFIG],
      useFactory: (sender: EmailSender | undefined, config: AppConfig) =>
        new EmailAlertNotifier(sender, config.monitoring.alertEmails, config.adminUrl)
    },
    {
      provide: MONITORING_SERVICE,
      inject: [METRICS_PORT, ALERT_NOTIFIER, ID_GENERATOR, CLOCK, APP_CONFIG, LOGGER],
      useFactory: (
        port: MetricsPort,
        notifier: AlertNotifier,
        ids: IdGenerator,
        clock: Clock,
        config: AppConfig,
        logger: Logger
      ) =>
        new MonitoringService(
          port,
          new MetricHistory([
            { stepMs: config.monitoring.sampleIntervalMs, retentionMs: config.monitoring.fineRetentionMs },
            { stepMs: config.monitoring.coarseStepMs, retentionMs: config.monitoring.coarseRetentionMs }
          ]),
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
    private readonly collectors: MetricCollectors
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
      this.timer = setInterval(() => void this.monitoring.sampleOnce(), this.config.monitoring.sampleIntervalMs)
      this.timer.unref()
    }
  }

  onApplicationShutdown() {
    if (this.timer) {
      clearInterval(this.timer)
    }
  }
}
