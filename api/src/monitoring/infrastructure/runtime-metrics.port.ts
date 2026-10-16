import { EnginePort } from '../../engine/application/engine-port'
import { EngineMetricsSnapshot, SlowestTick } from '../../engine/application/engine-metrics'
import { HttpMetrics, HttpTotals } from '../../metrics/application/http-metrics'
import { Clock } from '../../shared/application/clock'
import { ApiActivitySnapshot } from '../../shared/application/api-activity'
import { engineDerivedMetrics } from './engine-derived-metrics'
import { HistogramDefinition, histogramOf, percentileOf } from '../domain/histograms'
import { GatewayProbe, HistogramSample, MetricSample, MetricsPort } from '../application/ports'

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

// The percentiles of a period, from its buckets, for the metrics that are one
function putPercentiles(
  values: Record<string, number>,
  histogramId: string,
  counts: readonly number[],
  ...wanted: Array<[string, number]>
): void {
  const histogram = histogramOf(histogramId) as HistogramDefinition

  for (const [metric, quantile] of wanted) {
    const value = percentileOf(histogram, counts, quantile)
    if (value !== null) {
      values[metric] = value
    }
  }
}

// The requests of a period per latency bucket, from two readings of the cumulative counts, and the ones above the last bound
function bucketCounts(previous: HttpTotals, current: HttpTotals): number[] {
  const cumulative = current.buckets.map((bucket, index) => bucket.count - previous.buckets[index].count)
  const inBucket = cumulative.map((count, index) => count - (cumulative[index - 1] ?? 0))

  return [...inBucket, current.count - previous.count - cumulative[cumulative.length - 1]]
}

// The ticks of a period per duration bucket, and the slowest of them with its trace. An engine that restarted between the two readings
// starts its counts again, so its new counts are all of the period.
function tickHistogram(previous: EngineMetricsSnapshot, current: EngineMetricsSnapshot): HistogramSample | null {
  const isRestart = current.tick < previous.tick
  const counts = current.tickBuckets.map((count, index) => (isRestart ? count : count - previous.tickBuckets[index]))
  if (counts.every((count) => count <= 0)) {
    return null
  }
  const slowest = current.slowestTicks
    .filter((block) => isRestart || block.tick > previous.tick)
    .reduce<SlowestTick | null>((worst, block) => (worst && worst.durationMs >= block.durationMs ? worst : block), null)

  return {
    counts: counts.map((count) => Math.max(0, count)),
    slowestMs: slowest?.durationMs ?? null,
    slowestTraceId: slowest?.traceId ?? null
  }
}

// Reads the engine (through its port, so any node can), the HTTP counters of this process and the process itself. Rates
// and percentiles are between the previous reading and this one.
export class RuntimeMetricsPort implements MetricsPort {
  private previousHttp: HttpTotals
  private previousEngine: EngineMetricsSnapshot | null = null
  private previousActivity: ApiActivitySnapshot | null = null
  private previousAt: number

  constructor(
    private readonly engine: EnginePort,
    private readonly http: HttpMetrics,
    private readonly process: () => ProcessReading,
    private readonly tickIntervalMs: number,
    private readonly clock: Clock,
    // Absent when the node has no gateway to watch
    private readonly gateway?: GatewayProbe,
    // The traffic counters of this node's API tier
    private readonly activity?: { snapshot(): ApiActivitySnapshot }
  ) {
    this.previousHttp = http.totals()
    this.previousAt = clock.now().getTime()
  }

  async sample(): Promise<MetricSample> {
    const at = this.clock.now()
    const values: Record<string, number> = {}
    const histograms: Record<string, HistogramSample> = {}

    await this.readEngine(values, histograms, (at.getTime() - this.previousAt) / 1000)
    this.readHttp(values, histograms, at.getTime())
    const { rssBytes, heapUsedBytes } = this.process()
    values['infrastructure.rssBytes'] = rssBytes
    values['infrastructure.heapUsedBytes'] = heapUsedBytes
    await this.readGateway(values)
    this.readActivity(values)
    this.previousAt = at.getTime()

    return { at, values, histograms }
  }

  // Sockets and the rate limit: the open ones as they are, the rest per sample
  private readActivity(values: Record<string, number>): void {
    if (!this.activity) {
      return
    }
    const current = this.activity.snapshot()
    const previous = this.previousActivity

    values['api.socketConnections'] = current.socketsOpen
    values['world.onlinePlayers'] = current.onlinePlayers
    if (previous) {
      values['api.socketConnects'] = current.socketConnects - previous.socketConnects
      values['api.socketReconnects'] = current.socketReconnects - previous.socketReconnects
      values['api.rateLimitHits'] = current.rateLimitHits - previous.rateLimitHits
    }
    this.previousActivity = current
  }

  private async readGateway(values: Record<string, number>): Promise<void> {
    if (!this.gateway) {
      return
    }
    const { isUp, queueSize } = await this.gateway.read()
    values['infrastructure.gatewayUp'] = isUp ? 1 : 0
    if (queueSize !== null) {
      values['infrastructure.gatewayQueueSize'] = queueSize
    }
  }

  private async readEngine(
    values: Record<string, number>,
    histograms: Record<string, HistogramSample>,
    seconds: number
  ): Promise<void> {
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
    Object.assign(values, engineDerivedMetrics(previous, snapshot, seconds, this.tickIntervalMs))
    if (previous) {
      const histogram = tickHistogram(previous, snapshot)
      if (histogram) {
        histograms['engine.tickMs'] = histogram
        putPercentiles(values, 'engine.tickMs', histogram.counts, ['engine.tickP50Ms', 0.5], ['engine.tickP99Ms', 0.99])
      }
    }
    this.previousEngine = snapshot
  }

  private readHttp(values: Record<string, number>, histograms: Record<string, HistogramSample>, atMs: number): void {
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
    if (requests > 0) {
      const slowest = this.http.takeSlowest()
      const counts = bucketCounts(this.previousHttp, current)
      putPercentiles(values, 'api.latencyMs', counts, ['api.latencyP50Ms', 0.5], ['api.latencyP99Ms', 0.99])
      histograms['api.latencyMs'] = {
        counts,
        slowestMs: slowest?.durationMs ?? null,
        slowestTraceId: slowest?.traceId ?? null
      }
    }
    this.previousHttp = current
  }
}
