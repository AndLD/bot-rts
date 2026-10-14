import { Alert } from '../domain/alert'

export const METRICS_PORT = Symbol('MetricsPort')
export const ALERT_NOTIFIER = Symbol('AlertNotifier')

export interface MetricSample {
  at: Date
  // By metric id; a metric that could not be read is absent
  values: Readonly<Record<string, number>>
}

// Where the console gets its numbers: the engine, the API tier and the process (design §25.5)
export interface MetricsPort {
  sample(): Promise<MetricSample>
}

// Tells the owner about an alert that needs attention; how (email, a webhook later) is the adapter's business
export interface AlertNotifier {
  notify(alert: Alert): Promise<void>
}
