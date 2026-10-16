import { HistogramSample } from './ports'

export const METRIC_HISTORY_REPOSITORY = Symbol('MetricHistoryRepository')

// One minute of one metric on one node: the sum and the number of its samples
export interface MinuteRow {
  node: string
  minute: Date
  metric: string
  sum: number
  count: number
}

// One minute of one distribution on one node
export interface HistogramRow extends HistogramSample {
  node: string
  minute: Date
  histogram: string
}

export interface ScalarPoint {
  at: number
  sum: number
  count: number
}

export interface HistogramPoint {
  minute: number
  counts: number[]
  slowestMs: number | null
  slowestTraceId: string | null
}

// Where the coarse tier of the monitoring history is kept, for every node (design §25.5). The rows are written once, when their minute
// is over, so that a write that is repeated after a failure changes nothing.
export interface MetricHistoryRepository {
  saveMinutes(rows: readonly MinuteRow[]): Promise<void>
  saveHistograms(rows: readonly HistogramRow[]): Promise<void>
  // The sums and counts of a metric from `fromMs` to `toMs`, merged over the nodes (or only one) into steps of `stepMs`
  readMinutes(metric: string, fromMs: number, toMs: number, stepMs: number, node?: string): Promise<ScalarPoint[]>
  // The minutes of a distribution, one entry per node and minute
  readHistograms(histogram: string, fromMs: number, toMs: number, node?: string): Promise<HistogramPoint[]>
  // The nodes that wrote anything in the range
  nodes(fromMs: number, toMs: number): Promise<string[]>
}
