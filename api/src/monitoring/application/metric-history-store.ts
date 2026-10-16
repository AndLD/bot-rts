import { Logger } from '../../shared/application/logger'
import { addCounts, emptyCounts, histogramOf, PERCENTILE_METRICS, percentileOf } from '../domain/histograms'
import { MetricHistory, SeriesResult } from './metric-history'
import { HistogramRow, MetricHistoryRepository, MinuteRow } from './metric-history.repository'
import { HistogramSample, MetricSample } from './ports'

export const METRIC_HISTORY_STORE = Symbol('MetricHistoryStore')

export interface SeriesQuery {
  metric: string
  fromMs: number
  toMs: number
  // One node, or every node when absent
  node?: string
}

// Where the console reads the history of the metrics from, and where a node puts what it measured (design §25.5)
export interface MetricHistoryStore {
  // The id of this node in the history
  readonly nodeId: string
  record(sample: MetricSample): Promise<void>
  series(query: SeriesQuery): Promise<SeriesResult>
  // The nodes that took part in the range
  nodes(fromMs: number, toMs: number): Promise<string[]>
  // How far back the finest tier and the coarse tier reach (in this order), in ms
  retune(retentionsMs: readonly number[]): void
  // Writes what is still open (at shutdown)
  flush(): Promise<void>
}

// The history in the memory of this process, as before: two tiers, this node only. The default for tests and for a single node.
export class MemoryMetricHistoryStore implements MetricHistoryStore {
  constructor(
    private readonly history: MetricHistory,
    readonly nodeId: string
  ) {}

  async record(sample: MetricSample): Promise<void> {
    this.history.record(sample.at.getTime(), sample.values)
  }

  async series({ metric, fromMs, toMs, node }: SeriesQuery): Promise<SeriesResult> {
    if (node !== undefined && node !== this.nodeId) {
      return { stepMs: 0, points: [] }
    }

    return this.history.series(metric, fromMs, toMs)
  }

  async nodes(): Promise<string[]> {
    return [this.nodeId]
  }

  retune(retentionsMs: readonly number[]): void {
    this.history.retune(retentionsMs)
  }

  async flush(): Promise<void> {
    // nothing is kept anywhere else
  }
}

const MINUTE_MS = 60_000

// The coarse resolution of a range: the longer the range, the wider the step, so that a chart never has more than a few hundred points
export function stepOf(rangeMs: number): number {
  const hour = 3_600_000

  if (rangeMs <= 6 * hour) return MINUTE_MS
  if (rangeMs <= 24 * hour) return 5 * MINUTE_MS
  if (rangeMs <= 7 * 24 * hour) return 30 * MINUTE_MS
  return 120 * MINUTE_MS
}

interface OpenMinute {
  minute: number
  sums: Map<string, number>
  counts: Map<string, number>
  histograms: Map<string, { counts: number[]; slowestMs: number | null; slowestTraceId: string | null }>
}

// Keeps the finest tier (10-second steps) in memory, as the live view of this node, and writes one row per metric and minute to the
// repository, so that every node's history is there for the console to read together (design §25.5). A minute is written when it is over.
export class PersistentMetricHistoryStore implements MetricHistoryStore {
  private open: OpenMinute | null = null
  // Minutes that could not be written yet, oldest first; the newest are kept when the repository stays away
  private unwritten: Array<{ minutes: MinuteRow[]; histograms: HistogramRow[] }> = []

  constructor(
    private readonly fine: MetricHistory,
    private readonly repository: MetricHistoryRepository,
    readonly nodeId: string,
    private readonly logger: Logger,
    private readonly maxUnwrittenMinutes = 120
  ) {}

  async record(sample: MetricSample): Promise<void> {
    const at = sample.at.getTime()
    const minute = Math.floor(at / MINUTE_MS) * MINUTE_MS
    this.fine.record(at, sample.values)

    if (this.open && this.open.minute !== minute) {
      this.close()
      await this.write()
    }
    this.open ??= { minute, sums: new Map(), counts: new Map(), histograms: new Map() }
    this.add(this.open, sample)
  }

  async series({ metric, fromMs, toMs, node }: SeriesQuery): Promise<SeriesResult> {
    const live = this.fine.series(metric, fromMs, toMs)
    // This node's own series, as long as its memory reaches back: ten-second steps
    if (node === this.nodeId && live.points.length > 0 && live.points[0][0] <= fromMs + live.stepMs) {
      return live
    }

    const stepMs = stepOf(toMs - fromMs)
    const percentile = PERCENTILE_METRICS[metric]
    if (percentile) {
      const points = await this.percentiles(percentile, fromMs, toMs, stepMs, node)
      if (points.length > 0) {
        return { stepMs, points }
      }
    }
    const rows = await this.repository.readMinutes(metric, fromMs, toMs, stepMs, node)

    return { stepMs, points: rows.map(({ at, sum, count }): [number, number] => [at, sum / count]) }
  }

  async nodes(fromMs: number, toMs: number): Promise<string[]> {
    return [...new Set([this.nodeId, ...(await this.repository.nodes(fromMs, toMs))])].sort()
  }

  retune(retentionsMs: readonly number[]): void {
    this.fine.retune([retentionsMs[0]])
  }

  async flush(): Promise<void> {
    this.close()
    await this.write()
  }

  private add(open: OpenMinute, { values, histograms }: MetricSample): void {
    for (const [metric, value] of Object.entries(values)) {
      open.sums.set(metric, (open.sums.get(metric) ?? 0) + value)
      open.counts.set(metric, (open.counts.get(metric) ?? 0) + 1)
    }
    for (const [id, sample] of Object.entries(histograms ?? {})) {
      const histogram = histogramOf(id)
      if (histogram) {
        open.histograms.set(
          id,
          merge(
            open.histograms.get(id) ?? { counts: emptyCounts(histogram), slowestMs: null, slowestTraceId: null },
            sample
          )
        )
      }
    }
  }

  // The open minute becomes rows waiting to be written
  private close(): void {
    const { open } = this
    if (!open) {
      return
    }
    const minute = new Date(open.minute)
    this.open = null
    this.unwritten = [
      ...this.unwritten,
      {
        minutes: [...open.sums].map(([metric, sum]) => ({
          node: this.nodeId,
          minute,
          metric,
          sum,
          count: open.counts.get(metric) as number
        })),
        histograms: [...open.histograms].map(([histogram, sample]) => ({
          node: this.nodeId,
          minute,
          histogram,
          ...sample
        }))
      }
    ].slice(-this.maxUnwrittenMinutes)
  }

  // Writes the waiting minutes in one batch; a failure is logged and the minutes wait for the next try
  private async write(): Promise<void> {
    const waiting = this.unwritten
    if (waiting.length === 0) {
      return
    }
    try {
      await this.repository.saveMinutes(waiting.flatMap(({ minutes }) => minutes))
      await this.repository.saveHistograms(waiting.flatMap(({ histograms }) => histograms))
      this.unwritten = this.unwritten.slice(waiting.length)
    } catch (error) {
      this.logger.error(`The monitoring history could not be written: ${(error as Error).message}`)
    }
  }

  private async percentiles(
    { histogram: id, quantile }: { histogram: string; quantile: number },
    fromMs: number,
    toMs: number,
    stepMs: number,
    node: string | undefined
  ): Promise<Array<[number, number]>> {
    const histogram = histogramOf(id)
    if (!histogram) {
      return []
    }
    const steps = new Map<number, number[]>()

    for (const point of await this.repository.readHistograms(id, fromMs, toMs, node)) {
      if (point.counts.length === histogram.boundsMs.length + 1) {
        const step = Math.floor(point.minute / stepMs) * stepMs
        steps.set(step, addCounts(steps.get(step) ?? emptyCounts(histogram), point.counts))
      }
    }

    return [...steps]
      .sort(([a], [b]) => a - b)
      .flatMap(([step, counts]): Array<[number, number]> => {
        const value = percentileOf(histogram, counts, quantile)
        return value === null ? [] : [[step, value]]
      })
  }
}

function merge(
  into: { counts: number[]; slowestMs: number | null; slowestTraceId: string | null },
  sample: HistogramSample
) {
  const isSlower = sample.slowestMs !== null && (into.slowestMs === null || sample.slowestMs > into.slowestMs)

  return {
    counts: addCounts(into.counts, sample.counts),
    slowestMs: isSlower ? sample.slowestMs : into.slowestMs,
    slowestTraceId: isSlower ? sample.slowestTraceId : into.slowestTraceId
  }
}
