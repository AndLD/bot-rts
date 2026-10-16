import { Alert } from '../domain/alert'

export const METRICS_PORT = Symbol('MetricsPort')
export const GATEWAY_PROBE = Symbol('GatewayProbe')
export const ALERT_NOTIFIER = Symbol('AlertNotifier')

// The observations of a distribution since the previous sample: how many fell into each bucket, and the slowest with its trace
export interface HistogramSample {
  // One count per bound of the histogram (monitoring/domain/histograms.ts), then one for what is above the last bound
  counts: readonly number[]
  slowestMs: number | null
  slowestTraceId: string | null
}

export interface MetricSample {
  at: Date
  // By metric id; a metric that could not be read is absent
  values: Readonly<Record<string, number>>
  // By histogram id; a distribution that could not be read is absent
  histograms?: Readonly<Record<string, HistogramSample>>
}

// A part of the picture that is read on its own and keeps its own earlier readings (the gateway, the sockets, the database, the host):
// the sampler asks each in turn and merges what they say
export interface MetricReading {
  values: Record<string, number>
  histograms?: Record<string, HistogramSample>
}

export interface MetricSource {
  read(): Promise<MetricReading>
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
