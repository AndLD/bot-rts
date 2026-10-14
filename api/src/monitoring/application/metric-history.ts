export interface HistoryTier {
  stepMs: number
  retentionMs: number
}

export interface SeriesResult {
  stepMs: number
  points: Array<[number, number]>
}

// A fixed-size ring of timestamps plus one ring of values per metric, so memory is bounded by the retention
class TierStore {
  private readonly times: Float64Array
  private readonly values = new Map<string, Float64Array>()
  private head = 0
  private size = 0

  constructor(
    readonly stepMs: number,
    readonly capacity: number
  ) {
    this.times = new Float64Array(capacity)
  }

  push(at: number, sample: Readonly<Record<string, number>>): void {
    for (const metric of Object.keys(sample)) {
      if (!this.values.has(metric)) {
        this.values.set(metric, new Float64Array(this.capacity).fill(Number.NaN))
      }
    }
    this.times[this.head] = at
    for (const [metric, ring] of this.values) {
      ring[this.head] = metric in sample ? sample[metric] : Number.NaN
    }
    this.head = (this.head + 1) % this.capacity
    this.size = Math.min(this.size + 1, this.capacity)
  }

  oldest(): number | null {
    return this.size ? this.times[(this.head - this.size + this.capacity) % this.capacity] : null
  }

  read(metric: string, fromMs: number, toMs: number): Array<[number, number]> {
    const ring = this.values.get(metric)
    const points: Array<[number, number]> = []

    if (!ring) {
      return points
    }
    for (let offset = 0; offset < this.size; offset += 1) {
      const index = (this.head - this.size + offset + this.capacity) % this.capacity
      const time = this.times[index]
      if (time >= fromMs && time <= toMs && !Number.isNaN(ring[index])) {
        points.push([time, ring[index]])
      }
    }

    return points
  }
}

// A rolling time series with downsampling (design §25.5): the finest tier takes every sample, each coarser tier keeps the
// average of the samples that fall into one of its steps. History lives in the memory of this process.
export class MetricHistory {
  private readonly tiers: TierStore[]
  private readonly pending: Array<{ bucket: number; sums: Map<string, number>; counts: Map<string, number> } | null>

  constructor(tiers: readonly HistoryTier[]) {
    this.tiers = tiers.map((tier) => new TierStore(tier.stepMs, Math.max(1, Math.ceil(tier.retentionMs / tier.stepMs))))
    this.pending = tiers.map(() => null)
  }

  record(at: number, sample: Readonly<Record<string, number>>): void {
    this.tiers[0].push(at, sample)
    for (let level = 1; level < this.tiers.length; level += 1) {
      this.accumulate(level, at, sample)
    }
  }

  // The finest tier that reaches back to the start of the range; when none does (a young process, or a range longer than any
  // retention), the tier that reaches furthest back, preferring the finer one unless the other gains more than one of its steps
  series(metric: string, fromMs: number, toMs: number): SeriesResult {
    const tier = this.tiers.find((candidate) => (candidate.oldest() ?? Infinity) <= fromMs) ?? this.furthestReaching()

    return { stepMs: tier.stepMs, points: tier.read(metric, fromMs, toMs) }
  }

  private furthestReaching(): TierStore {
    return this.tiers.slice(1).reduce((best, tier) => {
      const reach = tier.oldest()
      const bestReach = best.oldest()

      return reach !== null && (bestReach === null || reach < bestReach - tier.stepMs) ? tier : best
    }, this.tiers[0])
  }

  private accumulate(level: number, at: number, sample: Readonly<Record<string, number>>): void {
    const tier = this.tiers[level]
    const bucket = Math.floor(at / tier.stepMs)
    const current = this.pending[level]

    if (current && current.bucket !== bucket) {
      tier.push(current.bucket * tier.stepMs, this.average(current))
      this.pending[level] = null
    }
    const open = (this.pending[level] ??= { bucket, sums: new Map(), counts: new Map() })
    for (const [metric, value] of Object.entries(sample)) {
      open.sums.set(metric, (open.sums.get(metric) ?? 0) + value)
      open.counts.set(metric, (open.counts.get(metric) ?? 0) + 1)
    }
  }

  private average({ sums, counts }: { sums: Map<string, number>; counts: Map<string, number> }) {
    return Object.fromEntries([...sums].map(([metric, sum]) => [metric, sum / (counts.get(metric) as number)]))
  }
}
