import { HealthStatus, IAreaHealth, METRIC_RANGES, MetricRange, MONITOR_AREAS } from '../../../../lib/utils/admin'
import { Clock } from '../../shared/application/clock'
import { Logger } from '../../shared/application/logger'
import { ValidationError } from '../../shared/domain/errors'
import { Alert } from '../domain/alert'
import { ALERT_RULES, evaluateRule, METRIC_CATALOG, METRIC_IDS, worstOf } from '../domain/metric-catalog'
import { AlertManager } from './alert-manager'
import { MetricHistoryStore } from './metric-history-store'
import { SeriesResult } from './metric-history'
import { MetricSample, MetricsPort } from './ports'

export const MONITORING_SERVICE = Symbol('MonitoringService')

const RANGE_MS: Record<MetricRange, number> = {
  '1h': 3_600_000,
  '6h': 6 * 3_600_000,
  '24h': 24 * 3_600_000,
  '7d': 7 * 24 * 3_600_000,
  '30d': 30 * 24 * 3_600_000
}

export interface HealthView {
  sampledAt: Date | null
  status: HealthStatus
  areas: IAreaHealth[]
  alerts: Alert[]
}

// Samples the metrics, keeps their history, raises alerts, and answers the dashboard (design §25.5)
export class MonitoringService {
  private latest: MetricSample | null = null
  private readonly listeners = new Set<(health: HealthView) => void>()

  constructor(
    private readonly port: MetricsPort,
    private readonly history: MetricHistoryStore,
    private readonly alerts: AlertManager,
    private readonly clock: Clock,
    private readonly logger: Logger
  ) {}

  // One pass of the sampler; a failure is logged and never ends the schedule
  // How far back the history of the two tiers reaches, in milliseconds; the console can change it while the server runs
  retuneHistory(retentionsMs: readonly number[]): void {
    this.history.retune(retentionsMs)
  }

  async sampleOnce(): Promise<void> {
    try {
      const sample = await this.port.sample()
      this.latest = sample
      await this.history.record(sample)
      await this.alerts.evaluate(sample)
      const health = this.health()
      this.listeners.forEach((listener) => listener(health))
    } catch (error) {
      this.logger.error(error)
    }
  }

  // Tells the listener the health after every sample (the live dashboard); returns the function that removes it
  onSample(listener: (health: HealthView) => void): () => void {
    this.listeners.add(listener)

    return () => this.listeners.delete(listener)
  }

  health(): HealthView {
    const values = this.latest?.values ?? {}
    const areas = MONITOR_AREAS.map((area): IAreaHealth => {
      const metrics = METRIC_CATALOG.filter((metric) => metric.area === area).map((metric) => {
        const value = values[metric.id] ?? null
        const rule = ALERT_RULES.find((candidate) => candidate.metric === metric.id)
        const breach = rule && value !== null ? evaluateRule(rule, this.alerts.thresholdOf(rule), value) : null

        return { id: metric.id, area, unit: metric.unit, value, status: breach?.severity ?? ('green' as const) }
      })

      return { area, status: worstOf(metrics.map((metric) => metric.status)), metrics }
    })

    return {
      sampledAt: this.latest?.at ?? null,
      status: worstOf(areas.map((area) => area.status)),
      areas,
      alerts: this.alerts.openAlerts()
    }
  }

  // `node` narrows the series to one node; without it the series is over every node
  async series(metric: string, range: MetricRange, node?: string): Promise<SeriesResult & { metric: string }> {
    if (!METRIC_IDS.includes(metric) || !METRIC_RANGES.includes(range)) {
      throw new ValidationError('Unknown metric or range')
    }
    const now = this.clock.now().getTime()

    return { metric, ...(await this.history.series({ metric, fromMs: now - RANGE_MS[range], toMs: now, node })) }
  }

  // The nodes that took part in the monitoring in the range
  nodes(range: MetricRange): Promise<string[]> {
    if (!METRIC_RANGES.includes(range)) {
      throw new ValidationError('Unknown range')
    }
    const now = this.clock.now().getTime()

    return this.history.nodes(now - RANGE_MS[range], now)
  }

  // Writes the minute that is still open (at shutdown)
  flushHistory(): Promise<void> {
    return this.history.flush()
  }

  listAlerts(): Alert[] {
    return this.alerts.recent()
  }

  acknowledge(id: string, adminId: string): Alert {
    return this.alerts.acknowledge(id, adminId)
  }
}
