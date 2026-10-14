import { Clock } from '../../shared/application/clock'
import { IdGenerator } from '../../shared/application/id-generator'
import { NotFoundError } from '../../shared/domain/errors'
import { Alert } from '../domain/alert'
import { ALERT_RULES, AlertRule, evaluateRule, METRIC_CATALOG, Threshold } from '../domain/metric-catalog'
import { AlertNotifier, MetricSample } from './ports'

const KEEP_CLEARED = 100

// Opens an alert when a metric crosses its threshold, updates it when the severity changes, closes it when the metric is
// back in range, and tells the owner about a red one. An acknowledged alert stays listed until it clears but is not repeated.
export class AlertManager {
  private readonly open = new Map<string, Alert>()
  private cleared: Alert[] = []

  constructor(
    private readonly thresholds: Readonly<Record<string, Threshold>>,
    private readonly notifier: AlertNotifier,
    private readonly ids: IdGenerator,
    private readonly clock: Clock
  ) {}

  thresholdOf(rule: AlertRule): Threshold {
    return { ...rule.defaults, ...this.thresholds[rule.metric] }
  }

  async evaluate(sample: MetricSample): Promise<void> {
    for (const rule of ALERT_RULES) {
      const value = sample.values[rule.metric]
      if (value === undefined) {
        continue
      }
      const breach = evaluateRule(rule, this.thresholdOf(rule), value)
      const existing = this.open.get(rule.metric)

      if (!breach) {
        this.close(existing)
      } else if (!existing || existing.severity !== breach.severity) {
        this.close(existing)
        await this.raise(rule, value, breach.severity, breach.threshold, sample.at)
      } else {
        this.open.set(rule.metric, { ...existing, value })
      }
    }
  }

  openAlerts(): Alert[] {
    return [...this.open.values()]
  }

  recent(): Alert[] {
    return [...this.open.values(), ...this.cleared]
  }

  acknowledge(id: string, adminId: string): Alert {
    const entry = [...this.open.entries()].find(([, alert]) => alert.id === id)

    if (!entry) {
      throw new NotFoundError('No open alert with this id')
    }
    const acknowledged = { ...entry[1], acknowledgedAt: this.clock.now(), acknowledgedBy: adminId }
    this.open.set(entry[0], acknowledged)

    return acknowledged
  }

  private close(alert: Alert | undefined): void {
    if (!alert) {
      return
    }
    this.open.delete(alert.metric)
    this.cleared = [{ ...alert, clearedAt: this.clock.now() }, ...this.cleared].slice(0, KEEP_CLEARED)
  }

  private async raise(rule: AlertRule, value: number, severity: Alert['severity'], threshold: number, at: Date) {
    const area = METRIC_CATALOG.find((metric) => metric.id === rule.metric)?.area as Alert['area']
    const alert: Alert = {
      id: this.ids.next(),
      metric: rule.metric,
      area,
      severity,
      value,
      threshold,
      openedAt: at,
      clearedAt: null,
      acknowledgedAt: null,
      acknowledgedBy: null
    }
    this.open.set(rule.metric, alert)

    if (severity === 'red') {
      await this.notifier.notify(alert).catch(() => undefined)
    }
  }
}
