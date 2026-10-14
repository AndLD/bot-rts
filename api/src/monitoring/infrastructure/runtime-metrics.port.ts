import { EnginePort } from '../../engine/application/engine-port'
import { EngineMetricsSnapshot } from '../../engine/application/engine-metrics'
import { HttpMetrics, HttpTotals } from '../../metrics/application/http-metrics'
import { Clock } from '../../shared/application/clock'
import { MetricSample, MetricsPort } from '../application/ports'

export interface ProcessReading {
  rssBytes: number
  heapUsedBytes: number
}

// The 95th percentile latency of the requests between two readings, from the histogram bounds (the upper bound of the bucket)
function latencyP95Ms(previous: HttpTotals, current: HttpTotals): number | undefined {
  const requests = current.count - previous.count
  if (requests <= 0) {
    return undefined
  }
  const target = requests * 0.95
  const bucket = current.buckets.find((candidate, index) => candidate.count - previous.buckets[index].count >= target)

  return (bucket ? bucket.le : current.buckets[current.buckets.length - 1].le) * 1000
}

// Reads the engine (through its port, so any node can), the HTTP counters of this process and the process itself. Rates
// and percentiles are between the previous reading and this one.
export class RuntimeMetricsPort implements MetricsPort {
  private previousHttp: HttpTotals
  private previousEngine: EngineMetricsSnapshot | null = null
  private previousAt: number

  constructor(
    private readonly engine: EnginePort,
    private readonly http: HttpMetrics,
    private readonly process: () => ProcessReading,
    private readonly tickIntervalMs: number,
    private readonly clock: Clock
  ) {
    this.previousHttp = http.totals()
    this.previousAt = clock.now().getTime()
  }

  async sample(): Promise<MetricSample> {
    const at = this.clock.now()
    const values: Record<string, number> = {}

    await this.readEngine(values)
    this.readHttp(values, at.getTime())
    const { rssBytes, heapUsedBytes } = this.process()
    values['infrastructure.rssBytes'] = rssBytes
    values['infrastructure.heapUsedBytes'] = heapUsedBytes
    this.previousAt = at.getTime()

    return { at, values }
  }

  private async readEngine(values: Record<string, number>): Promise<void> {
    let snapshot: EngineMetricsSnapshot
    try {
      snapshot = await this.engine.metrics()
    } catch {
      values['engine.up'] = 0
      return
    }
    const previous = this.previousEngine
    const ticks = previous ? snapshot.tick - previous.tick : 0
    values['engine.up'] = 1
    values['engine.lastTickMs'] = snapshot.lastTickMs
    values['engine.tickP95Ms'] = snapshot.p95TickMs
    values['engine.tickP95Ratio'] = snapshot.p95TickMs / this.tickIntervalMs
    values['engine.cutTicks'] = snapshot.cutTicks
    if (previous && ticks > 0) {
      values['engine.overrunRate'] = Math.max(0, snapshot.overrunTicks - previous.overrunTicks) / ticks
    }
    values['scripts.running'] = snapshot.executions
    values['scripts.queued'] = snapshot.queuedExecutions
    values['scripts.deferred'] = snapshot.deferredExecutions
    values['scripts.maxWaitTicks'] = snapshot.maxWaitTicks
    values['scripts.sandboxMemoryBytes'] = snapshot.memoryBytes
    this.previousEngine = snapshot
  }

  private readHttp(values: Record<string, number>, atMs: number): void {
    const current = this.http.totals()
    const requests = current.count - this.previousHttp.count
    const seconds = (atMs - this.previousAt) / 1000

    if (seconds > 0) {
      values['api.requestsPerSecond'] = requests / seconds
    }
    if (requests > 0) {
      values['api.errorRate5xx'] = (current.errors5xx - this.previousHttp.errors5xx) / requests
      values['api.errorRate4xx'] = (current.errors4xx - this.previousHttp.errors4xx) / requests
    }
    const latency = latencyP95Ms(this.previousHttp, current)
    if (latency !== undefined) {
      values['api.latencyP95Ms'] = latency
    }
    this.previousHttp = current
  }
}
