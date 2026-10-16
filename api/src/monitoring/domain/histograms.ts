// The distributions the console keeps (design §25.5): the latency of the API and the duration of the engine's tick, as the number of
// observations per bucket. A percentile over several nodes and several minutes comes from the merged buckets; the percentiles of
// the nodes are never averaged, which would be wrong.
export interface HistogramDefinition {
  id: string
  // Upper bounds in milliseconds, ascending; the bucket after the last holds what is above it
  boundsMs: readonly number[]
}

// The bounds of the API are the buckets of `HttpMetrics`, those of the tick are the buckets of `EngineMetrics` (`TICK_BOUNDS_MS`);
// a test holds them equal
export const HISTOGRAMS: readonly HistogramDefinition[] = [
  { id: 'api.latencyMs', boundsMs: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000] },
  { id: 'engine.tickMs', boundsMs: [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000] }
]

export const HISTOGRAM_IDS = HISTOGRAMS.map((histogram) => histogram.id)

// The metrics of the catalog that are a percentile of a distribution, and which one
export const PERCENTILE_METRICS: Readonly<Record<string, { histogram: string; quantile: number }>> = {
  'api.latencyP95Ms': { histogram: 'api.latencyMs', quantile: 0.95 },
  'engine.tickP95Ms': { histogram: 'engine.tickMs', quantile: 0.95 }
}

export const histogramOf = (id: string): HistogramDefinition | undefined =>
  HISTOGRAMS.find((histogram) => histogram.id === id)

export const emptyCounts = (histogram: HistogramDefinition): number[] => histogram.boundsMs.map(() => 0).concat(0)

// Adds `other` to `counts`, bucket by bucket
export function addCounts(counts: number[], other: readonly number[]): number[] {
  return counts.map((count, index) => count + (other[index] ?? 0))
}

// The upper bound of the bucket that holds the quantile; above the last bound it is that bound. Null when there is nothing counted.
export function percentileOf(
  histogram: HistogramDefinition,
  counts: readonly number[],
  quantile: number
): number | null {
  const total = counts.reduce((sum, count) => sum + count, 0)
  if (total === 0) {
    return null
  }
  const target = total * quantile
  let seen = 0
  const index = counts.findIndex((count) => (seen += count) >= target)

  return histogram.boundsMs[Math.min(index === -1 ? counts.length - 1 : index, histogram.boundsMs.length - 1)]
}
