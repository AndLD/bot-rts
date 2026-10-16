import {
  HistogramPoint,
  HistogramRow,
  MetricHistoryRepository,
  MinuteRow,
  ScalarPoint
} from '../../src/monitoring/application/metric-history.repository'

// The repository of the monitoring history in memory, for unit tests; it groups into steps the way the SQL of the real one does
export class InMemoryMetricHistoryRepository implements MetricHistoryRepository {
  readonly minutes: MinuteRow[] = []
  readonly histograms: HistogramRow[] = []
  // Makes the next writes fail, to see that the minutes wait for the next try
  isDown = false

  async saveMinutes(rows: readonly MinuteRow[]): Promise<void> {
    if (this.isDown) throw new Error('database down')
    for (const row of rows) {
      if (
        !this.minutes.some(
          (kept) => kept.node === row.node && +kept.minute === +row.minute && kept.metric === row.metric
        )
      ) {
        this.minutes.push(row)
      }
    }
  }

  async saveHistograms(rows: readonly HistogramRow[]): Promise<void> {
    if (this.isDown) throw new Error('database down')
    this.histograms.push(...rows)
  }

  async readMinutes(
    metric: string,
    fromMs: number,
    toMs: number,
    stepMs: number,
    node?: string
  ): Promise<ScalarPoint[]> {
    const steps = new Map<number, ScalarPoint>()

    for (const row of this.minutes) {
      const at = row.minute.getTime()
      if (row.metric === metric && at >= fromMs && at <= toMs && (node === undefined || row.node === node)) {
        const step = Math.floor(at / stepMs) * stepMs
        const point = steps.get(step) ?? { at: step, sum: 0, count: 0 }
        steps.set(step, { at: step, sum: point.sum + row.sum, count: point.count + row.count })
      }
    }

    return [...steps.values()].sort((a, b) => a.at - b.at)
  }

  async readHistograms(histogram: string, fromMs: number, toMs: number, node?: string): Promise<HistogramPoint[]> {
    return this.histograms
      .filter(
        (row) =>
          row.histogram === histogram &&
          +row.minute >= fromMs &&
          +row.minute <= toMs &&
          (node === undefined || row.node === node)
      )
      .map((row) => ({
        minute: row.minute.getTime(),
        counts: [...row.counts],
        slowestMs: row.slowestMs,
        slowestTraceId: row.slowestTraceId
      }))
  }

  async nodes(fromMs: number, toMs: number): Promise<string[]> {
    return [
      ...new Set(this.minutes.filter((row) => +row.minute >= fromMs && +row.minute <= toMs).map((row) => row.node))
    ].sort()
  }
}
