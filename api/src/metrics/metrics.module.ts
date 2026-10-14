import { Global, Module } from '@nestjs/common'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { ENGINE_PORT, EnginePort } from '../engine/application/engine-port'
import { HttpMetrics } from './application/http-metrics'
import { MetricCollectors } from './application/metric-collectors'
import { METRICS_SERVICE, MetricsService } from './application/metrics.service'
import { MetricsController } from './presentation/metrics.controller'

@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    HttpMetrics,
    MetricCollectors,
    {
      provide: METRICS_SERVICE,
      inject: [HttpMetrics, ENGINE_PORT, APP_CONFIG, MetricCollectors],
      useFactory: (http: HttpMetrics, engine: EnginePort, config: AppConfig, collectors: MetricCollectors) =>
        new MetricsService(
          http,
          engine,
          () => ({
            uptimeSeconds: process.uptime(),
            rssBytes: process.memoryUsage().rss,
            heapUsedBytes: process.memoryUsage().heapUsed
          }),
          config.observability.metricsToken,
          collectors
        )
    }
  ],
  exports: [HttpMetrics, MetricCollectors]
})
export class MetricsModule {}
