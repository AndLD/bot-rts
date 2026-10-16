import { QueryStats, QueryStatsSnapshot } from '../../persistence/application/query-stats'
import { HistogramDefinition, histogramOf, percentileOf } from '../domain/histograms'
import { Clock } from '../../shared/application/clock'
import { DatabaseStatsRepository } from '../application/database-stats.repository'
import { MetricReading, MetricSource } from '../application/ports'

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

// The database as the console shows it (design §25.5): how long the queries of this process take, how many were slow, how many
// connections are open of those the server allows, and how big the database is and how fast it grows. The sizes cost a scan of the
// statistics views, so they are read every few minutes, not every sample.
export class DatabaseMetricSource implements MetricSource {
  private previous: { snapshot: QueryStatsSnapshot; atMs: number } | null = null
  private sizes: { atMs: number; totalBytes: number; largestTableBytes: number } | null = null
  private firstSize: { atMs: number; totalBytes: number } | null = null

  constructor(
    private readonly queries: QueryStats,
    private readonly repository: DatabaseStatsRepository,
    private readonly clock: Clock,
    private readonly sizeEveryMs: number
  ) {}

  async read(): Promise<MetricReading> {
    const atMs = this.clock.now().getTime()
    const reading: MetricReading = { values: {} }

    this.readQueries(reading, atMs)
    await this.readConnections(reading)
    await this.readSizes(reading, atMs)

    return reading
  }

  private readQueries(reading: MetricReading, atMs: number): void {
    const snapshot = this.queries.snapshot()
    const { previous } = this
    this.previous = { snapshot, atMs }
    if (!previous) {
      return
    }
    const queries = snapshot.count - previous.snapshot.count
    const seconds = (atMs - previous.atMs) / 1000

    reading.values['database.slowQueries'] = snapshot.slowCount - previous.snapshot.slowCount
    if (seconds > 0) {
      reading.values['database.queriesPerSecond'] = queries / seconds
    }
    if (queries > 0) {
      const slowest = this.queries.slowQueries().find((query) => query.at.getTime() > previous.atMs)
      const counts = snapshot.buckets.map((count, index) => count - previous.snapshot.buckets[index])
      const histogram = histogramOf('db.queryMs') as HistogramDefinition

      reading.histograms = { 'db.queryMs': { counts, slowestMs: slowest?.durationMs ?? null, slowestTraceId: null } }
      for (const [metric, quantile] of [
        ['database.queryP50Ms', 0.5],
        ['database.queryP95Ms', 0.95],
        ['database.queryP99Ms', 0.99]
      ] as const) {
        reading.values[metric] = percentileOf(histogram, counts, quantile) as number
      }
    }
  }

  private async readConnections(reading: MetricReading): Promise<void> {
    const { open, max } = await this.repository.connections()

    reading.values['database.connections'] = open
    reading.values['database.connectionsRatio'] = max > 0 ? open / max : 0
  }

  private async readSizes(reading: MetricReading, atMs: number): Promise<void> {
    if (!this.sizes || atMs - this.sizes.atMs >= this.sizeEveryMs) {
      const { totalBytes, largestTableBytes } = await this.repository.sizes()

      this.sizes = { atMs, totalBytes, largestTableBytes }
      this.firstSize ??= { atMs, totalBytes }
    }
    reading.values['database.sizeBytes'] = this.sizes.totalBytes
    reading.values['database.largestTableBytes'] = this.sizes.largestTableBytes
    const first = this.firstSize as { atMs: number; totalBytes: number }
    // A rate needs an hour of history to mean anything
    if (this.sizes.atMs - first.atMs >= HOUR_MS) {
      reading.values['database.growthBytesPerDay'] =
        ((this.sizes.totalBytes - first.totalBytes) / (this.sizes.atMs - first.atMs)) * DAY_MS
    }
  }
}
