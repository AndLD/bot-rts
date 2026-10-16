import { Alert } from '../domain/alert'

export const METRICS_PORT = Symbol('MetricsPort')
export const GATEWAY_PROBE = Symbol('GatewayProbe')
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

// What the console learns of the collector gateway that every node sends its logs and traces to (Phase 13.2)
export interface GatewayReading {
  isUp: boolean
  // Batches waiting in the gateway's export queue; null when its metrics cannot be read
  queueSize: number | null
}

export interface GatewayProbe {
  read(): Promise<GatewayReading>
}

// Tells the owner about an alert that needs attention; how (email, a webhook later) is the adapter's business
export interface AlertNotifier {
  notify(alert: Alert): Promise<void>
}
